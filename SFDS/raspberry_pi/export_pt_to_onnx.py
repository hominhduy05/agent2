from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path
from typing import Any

import numpy as np


def parse_size(value: str) -> int | tuple[int, int]:
    if "x" not in value.lower():
        return int(value)
    width, height = value.lower().split("x", 1)
    return int(width), int(height)


def size_to_hw(imgsz: int | tuple[int, int]) -> tuple[int, int]:
    if isinstance(imgsz, int):
        return imgsz, imgsz
    return imgsz[1], imgsz[0]


def find_default_weights() -> Path | None:
    preferred = [
        Path("best.pt"),
        Path("models/best.pt"),
        Path("model/best.pt"),
        Path("durian_yolov8.pt"),
        Path("model/durian_yolov8.pt"),
        Path("models/durian_yolov8.pt"),
        Path("durian_fruit_locator.pt"),
        Path("models/durian_fruit_locator.pt"),
        Path("model/durian_fruit_locator.pt"),
    ]
    for path in preferred:
        if path.exists():
            return path.resolve()

    candidates = (
        sorted(Path(".").glob("*.pt"))
        + sorted(Path("model").glob("*.pt"))
        + sorted(Path("models").glob("*.pt"))
    )
    if len(candidates) == 1:
        return candidates[0].resolve()
    return None


def class_labels_from_model(model: Any) -> list[str]:
    names = getattr(model, "names", {})
    if isinstance(names, dict):
        return [str(names[index]) for index in sorted(names)]
    if isinstance(names, (list, tuple)):
        return [str(name) for name in names]
    return []


def export_onnx(
    weights: Path,
    output: Path,
    imgsz: int | tuple[int, int],
    opset: int,
    simplify: bool,
    dynamic: bool,
) -> Path:
    from ultralytics import YOLO

    model = YOLO(str(weights))
    export_kwargs: dict[str, Any] = {
        "format": "onnx",
        "imgsz": imgsz,
        "opset": opset,
        "simplify": simplify,
        "dynamic": dynamic,
        "half": False,
        "nms": False,
        "verbose": False,
    }

    try:
        exported = Path(model.export(**export_kwargs))
    except TypeError as exc:
        if "unexpected" not in str(exc).lower() and "keyword" not in str(exc).lower():
            raise
        removed = []
        for key in ("verbose", "nms"):
            if key in export_kwargs:
                removed.append(key)
            export_kwargs.pop(key, None)
        print(f"[WARN] Ultralytics version rejected an export option; removed {removed} and retrying.")
        exported = Path(model.export(**export_kwargs))
    except Exception as exc:
        if not simplify:
            raise
        print(f"[WARN] Export with simplify=True failed: {exc}")
        print("[WARN] Retrying with simplify=False. You can install onnxslim/onnxsim later if needed.")
        export_kwargs["simplify"] = False
        exported = Path(model.export(**export_kwargs))

    output.parent.mkdir(parents=True, exist_ok=True)
    if exported.resolve() != output.resolve():
        if output.exists():
            output.unlink()
        shutil.move(str(exported), str(output))

    labels_path = output.with_suffix(".labels.json")
    labels_path.write_text(
        json.dumps(
            {
                "class_labels": class_labels_from_model(model),
                "imgsz": imgsz,
                "opset": opset,
                "dynamic": dynamic,
                "nms": False,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return output


def check_onnx_model(path: Path) -> None:
    import onnx

    model = onnx.load(str(path))
    onnx.checker.check_model(model)


def make_session(path: Path, threads: int):
    import onnxruntime as ort

    options = ort.SessionOptions()
    options.intra_op_num_threads = threads
    return ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])


def inspect_session(session: Any) -> dict[str, Any]:
    return {
        "inputs": [
            {"name": item.name, "shape": item.shape, "type": item.type}
            for item in session.get_inputs()
        ],
        "outputs": [
            {"name": item.name, "shape": item.shape, "type": item.type}
            for item in session.get_outputs()
        ],
        "providers": session.get_providers(),
    }


def preprocess(image: np.ndarray, imgsz: int | tuple[int, int]) -> tuple[np.ndarray, float, int, int]:
    import cv2

    target_h, target_w = size_to_hw(imgsz)
    h, w = image.shape[:2]
    scale = min(target_w / max(w, 1), target_h / max(h, 1))
    new_w, new_h = int(round(w * scale)), int(round(h * scale))
    resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    canvas = np.full((target_h, target_w, 3), 114, dtype=np.uint8)
    pad_x = (target_w - new_w) // 2
    pad_y = (target_h - new_h) // 2
    canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized

    rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
    tensor = rgb.astype(np.float32) / 255.0
    tensor = np.transpose(tensor, (2, 0, 1))[np.newaxis, ...]
    return tensor, scale, pad_x, pad_y


def parse_yolov8_output(
    output: np.ndarray,
    image_width: int,
    image_height: int,
    scale: float,
    pad_x: int,
    pad_y: int,
    conf: float,
    iou: float,
) -> list[dict[str, Any]]:
    import cv2

    pred = np.squeeze(output)
    if pred.ndim != 2:
        return []

    was_transposed = False
    if pred.shape[0] < pred.shape[1] and pred.shape[0] >= 5:
        pred = pred.T
        was_transposed = True

    boxes: list[list[int]] = []
    scores: list[float] = []
    candidates: list[dict[str, Any]] = []

    for row in pred:
        if row.shape[0] < 5:
            continue

        if row.shape[0] == 6 and not was_transposed:
            x1, y1, x2, y2 = map(float, row[:4])
            score = float(row[4])
            class_id = int(row[5])
        else:
            class_scores = row[4:]
            class_id = int(np.argmax(class_scores))
            score = float(class_scores[class_id])
            cx, cy, bw, bh = map(float, row[:4])
            x1, y1 = cx - bw / 2.0, cy - bh / 2.0
            x2, y2 = cx + bw / 2.0, cy + bh / 2.0

        if score < conf:
            continue

        x1 = (x1 - pad_x) / max(scale, 1e-6)
        y1 = (y1 - pad_y) / max(scale, 1e-6)
        x2 = (x2 - pad_x) / max(scale, 1e-6)
        y2 = (y2 - pad_y) / max(scale, 1e-6)
        x1 = max(0.0, min(float(image_width), x1))
        y1 = max(0.0, min(float(image_height), y1))
        x2 = max(0.0, min(float(image_width), x2))
        y2 = max(0.0, min(float(image_height), y2))
        box_w, box_h = x2 - x1, y2 - y1
        if box_w <= 1.0 or box_h <= 1.0:
            continue

        boxes.append([int(round(x1)), int(round(y1)), int(round(box_w)), int(round(box_h))])
        scores.append(score)
        candidates.append({
            "x1": round(x1, 2),
            "y1": round(y1, 2),
            "x2": round(x2, 2),
            "y2": round(y2, 2),
            "confidence": round(score, 4),
            "class_id": class_id,
        })

    if not candidates:
        return []

    keep = cv2.dnn.NMSBoxes(boxes, scores, conf, iou)
    if len(keep) == 0:
        return []
    indices = np.array(keep).reshape(-1).tolist()
    return [candidates[index] for index in indices]


def smoke_test(session: Any, imgsz: int | tuple[int, int]) -> None:
    target_h, target_w = size_to_hw(imgsz)
    dummy = np.zeros((1, 3, target_h, target_w), dtype=np.float32)
    outputs = session.run([session.get_outputs()[0].name], {session.get_inputs()[0].name: dummy})
    if not outputs or outputs[0] is None:
        raise RuntimeError("ONNX Runtime did not return any output")


def test_sample_image(
    session: Any,
    image_path: Path,
    imgsz: int | tuple[int, int],
    conf: float,
    iou: float,
    debug_output: Path | None,
) -> list[dict[str, Any]]:
    import cv2

    image = cv2.imread(str(image_path))
    if image is None:
        raise RuntimeError(f"Cannot read sample image: {image_path}")

    tensor, scale, pad_x, pad_y = preprocess(image, imgsz)
    outputs = session.run([session.get_outputs()[0].name], {session.get_inputs()[0].name: tensor})
    detections = parse_yolov8_output(
        outputs[0],
        image.shape[1],
        image.shape[0],
        scale,
        pad_x,
        pad_y,
        conf,
        iou,
    )

    if debug_output:
        preview = image.copy()
        for det in detections:
            x1, y1 = int(det["x1"]), int(det["y1"])
            x2, y2 = int(det["x2"]), int(det["y2"])
            cv2.rectangle(preview, (x1, y1), (x2, y2), (0, 220, 255), 2)
            cv2.putText(
                preview,
                f'{det["class_id"]} {det["confidence"]:.2f}',
                (x1, max(18, y1 - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 220, 255),
                2,
            )
        debug_output.parent.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(debug_output), preview)

    return detections


def main() -> int:
    parser = argparse.ArgumentParser(description="Export a YOLOv8 .pt fruit locator model to ONNX for Raspberry Pi.")
    parser.add_argument("--weights", help="Path to trained .pt model, for example best.pt. If omitted, the script tries to find best.pt automatically.")
    parser.add_argument("--output", default="models/durian_fruit_locator.onnx", help="Output .onnx path.")
    parser.add_argument("--imgsz", default="640", help="Export image size: 640 or WIDTHxHEIGHT.")
    parser.add_argument("--opset", type=int, default=12, help="ONNX opset. 12 is a safe Raspberry Pi default.")
    parser.add_argument("--no-simplify", action="store_true", help="Disable ONNX simplification.")
    parser.add_argument("--dynamic", action="store_true", help="Export dynamic input shape. Fixed shape is faster/easier on Pi.")
    parser.add_argument("--threads", type=int, default=2, help="ONNX Runtime CPU threads for validation.")
    parser.add_argument("--sample", help="Optional sample image to test detections after export.")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold for sample-image validation.")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold for sample-image validation.")
    parser.add_argument("--debug-output", help="Optional output image with validation boxes drawn.")
    args = parser.parse_args()

    weights = Path(args.weights).resolve() if args.weights else find_default_weights()
    output = Path(args.output).resolve()
    imgsz = parse_size(args.imgsz)

    if weights is None:
        raise FileNotFoundError(
            "No .pt weights found. Put best.pt in this folder or run:\n"
            "  python export_pt_to_onnx.py --weights path/to/best.pt"
        )
    if not weights.exists():
        raise FileNotFoundError(f"Weights not found: {weights}")
    if weights.suffix.lower() != ".pt":
        raise ValueError("--weights must point to a .pt file")

    print(f"[1/5] Exporting {weights} -> {output}")
    onnx_path = export_onnx(
        weights=weights,
        output=output,
        imgsz=imgsz,
        opset=args.opset,
        simplify=not args.no_simplify,
        dynamic=args.dynamic,
    )

    print("[2/5] Checking ONNX graph")
    check_onnx_model(onnx_path)

    print("[3/5] Loading with ONNX Runtime CPU")
    session = make_session(onnx_path, args.threads)
    session_info = inspect_session(session)
    print(json.dumps(session_info, ensure_ascii=False, indent=2))

    print("[4/5] Running dummy inference")
    smoke_test(session, imgsz)

    if args.sample:
        print("[5/5] Running sample-image validation")
        detections = test_sample_image(
            session=session,
            image_path=Path(args.sample).resolve(),
            imgsz=imgsz,
            conf=args.conf,
            iou=args.iou,
            debug_output=Path(args.debug_output).resolve() if args.debug_output else None,
        )
        print(json.dumps({"detections": detections}, ensure_ascii=False, indent=2))
    else:
        print("[5/5] No sample image provided; skipped visual detection validation")

    print("\nDone.")
    print(f"ONNX: {onnx_path}")
    print(f"Labels: {onnx_path.with_suffix('.labels.json')}")
    print("Use this in config.pi.json:")
    print(json.dumps({
        "backend": "onnx",
        "model_path": str(onnx_path),
        "confidence": args.conf,
        "iou": args.iou,
        "imgsz": imgsz,
        "threads": args.threads,
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
