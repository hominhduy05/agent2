from __future__ import annotations

import argparse
import time
from collections import deque
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import onnxruntime as ort


def parse_size(value: str) -> int | tuple[int, int]:
    if "x" not in value.lower():
        return int(value)
    width, height = value.lower().split("x", 1)
    return int(width), int(height)


def size_to_hw(imgsz: int | tuple[int, int]) -> tuple[int, int]:
    if isinstance(imgsz, int):
        return imgsz, imgsz
    return imgsz[1], imgsz[0]


def preprocess(image: np.ndarray, imgsz: int | tuple[int, int]) -> tuple[np.ndarray, float, int, int]:
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


def class_allowed(class_id: int, class_name: str, class_ids: set[int], class_names: set[str]) -> bool:
    if class_ids and class_id not in class_ids:
        return False
    if class_names and class_name.lower() not in class_names:
        return False
    return True


def parse_output(
    output: np.ndarray,
    image_width: int,
    image_height: int,
    scale: float,
    pad_x: int,
    pad_y: int,
    conf: float,
    iou: float,
    class_labels: list[str],
    class_ids: set[int],
    class_names: set[str],
) -> list[dict[str, Any]]:
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

        class_name = class_labels[class_id] if 0 <= class_id < len(class_labels) else str(class_id)
        if not class_allowed(class_id, class_name, class_ids, class_names):
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
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "confidence": score,
            "class_id": class_id,
            "class_name": class_name,
            "area": box_w * box_h,
        })

    if not candidates:
        return []

    keep = cv2.dnn.NMSBoxes(boxes, scores, conf, iou)
    if len(keep) == 0:
        return []

    indices = np.array(keep).reshape(-1).tolist()
    return sorted((candidates[index] for index in indices), key=lambda det: (det["confidence"], det["area"]), reverse=True)


def draw_overlay(
    frame: np.ndarray,
    detections: list[dict[str, Any]],
    fps: float,
    infer_ms: float,
    pre_ms: float,
    post_ms: float,
) -> None:
    for index, det in enumerate(detections):
        color = (0, 220, 255) if index == 0 else (180, 180, 180)
        x1, y1 = int(det["x1"]), int(det["y1"])
        x2, y2 = int(det["x2"]), int(det["y2"])
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label = f'{det["class_name"]} {det["confidence"] * 100:.0f}%'
        cv2.putText(frame, label, (x1, max(20, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

    lines = [
        f"FPS: {fps:.1f}",
        f"infer: {infer_ms:.1f} ms",
        f"pre/post: {pre_ms:.1f}/{post_ms:.1f} ms",
        f"detections: {len(detections)}",
    ]
    for row, text in enumerate(lines):
        y = 24 + row * 22
        cv2.putText(frame, text, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4)
        cv2.putText(frame, text, (12, y), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)


def crop_best(frame: np.ndarray, det: dict[str, Any], padding_ratio: float) -> np.ndarray:
    h, w = frame.shape[:2]
    box_w = det["x2"] - det["x1"]
    box_h = det["y2"] - det["y1"]
    pad = int(round(max(box_w, box_h) * padding_ratio))
    x1 = max(0, min(w - 1, int(round(det["x1"])) - pad))
    y1 = max(0, min(h - 1, int(round(det["y1"])) - pad))
    x2 = max(x1 + 1, min(w, int(round(det["x2"])) + pad))
    y2 = max(y1 + 1, min(h, int(round(det["y2"])) + pad))
    return frame[y1:y2, x1:x2].copy()


def load_class_labels(model_path: Path, fallback: list[str]) -> list[str]:
    labels_path = model_path.with_suffix(".labels.json")
    if not labels_path.exists():
        return fallback

    import json

    try:
        payload = json.loads(labels_path.read_text(encoding="utf-8"))
    except Exception:
        return fallback
    labels = payload.get("class_labels")
    return [str(item) for item in labels] if isinstance(labels, list) else fallback


def main() -> int:
    parser = argparse.ArgumentParser(description="Test a YOLOv8 ONNX fruit locator with a local webcam.")
    parser.add_argument("--model", default="models/durian_fruit_locator.onnx", help="Path to ONNX model.")
    parser.add_argument("--camera", default="0", help="Camera index or URL.")
    parser.add_argument("--imgsz", default="640", help="Inference size: 640 or WIDTHxHEIGHT.")
    parser.add_argument("--conf", type=float, default=0.35, help="Confidence threshold.")
    parser.add_argument("--iou", type=float, default=0.45, help="NMS IoU threshold.")
    parser.add_argument("--threads", type=int, default=2, help="ONNX Runtime CPU threads.")
    parser.add_argument("--width", type=int, default=640, help="Camera capture width.")
    parser.add_argument("--height", type=int, default=480, help="Camera capture height.")
    parser.add_argument("--fps", type=int, default=30, help="Camera requested FPS.")
    parser.add_argument("--padding-ratio", type=float, default=0.12, help="Padding used for crop preview.")
    parser.add_argument("--class-labels", default="durian", help="Comma-separated labels by class id.")
    parser.add_argument("--class-ids", default="", help="Optional comma-separated allowed class ids.")
    parser.add_argument("--class-names", default="", help="Optional comma-separated allowed class names.")
    parser.add_argument("--duration", type=float, default=0.0, help="Auto-stop after N seconds. 0 means run until q/Esc.")
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    if not model_path.exists():
        raise FileNotFoundError(f"ONNX model not found: {model_path}")

    labels = [item.strip() for item in args.class_labels.split(",") if item.strip()]
    labels = load_class_labels(model_path, labels)
    class_ids = {int(item.strip()) for item in args.class_ids.split(",") if item.strip()}
    class_names = {item.strip().lower() for item in args.class_names.split(",") if item.strip()}
    imgsz = parse_size(args.imgsz)

    options = ort.SessionOptions()
    options.intra_op_num_threads = args.threads
    session = ort.InferenceSession(str(model_path), sess_options=options, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    source: int | str = int(args.camera) if args.camera.isdigit() else args.camera
    cap = cv2.VideoCapture(source)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    cap.set(cv2.CAP_PROP_FPS, args.fps)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        raise RuntimeError(f"Cannot open camera: {args.camera}")

    print(f"Model: {model_path}")
    print(f"Input: {session.get_inputs()[0].shape} -> Output: {session.get_outputs()[0].shape}")
    print("Press q or Esc to stop.")

    frame_times = deque(maxlen=30)
    infer_times = deque(maxlen=30)
    start = time.perf_counter()

    try:
        while True:
            frame_start = time.perf_counter()
            ok, frame = cap.read()
            if not ok or frame is None:
                print("Cannot read frame.")
                break

            t0 = time.perf_counter()
            tensor, scale, pad_x, pad_y = preprocess(frame, imgsz)
            t1 = time.perf_counter()
            outputs = session.run([output_name], {input_name: tensor})
            t2 = time.perf_counter()
            detections = parse_output(
                outputs[0],
                frame.shape[1],
                frame.shape[0],
                scale,
                pad_x,
                pad_y,
                args.conf,
                args.iou,
                labels,
                class_ids,
                class_names,
            )
            t3 = time.perf_counter()

            frame_times.append(time.perf_counter() - frame_start)
            infer_times.append(t2 - t1)
            fps = 1.0 / max(sum(frame_times) / len(frame_times), 1e-6)
            infer_ms = (sum(infer_times) / len(infer_times)) * 1000.0
            pre_ms = (t1 - t0) * 1000.0
            post_ms = (t3 - t2) * 1000.0

            preview = frame.copy()
            draw_overlay(preview, detections, fps, infer_ms, pre_ms, post_ms)
            cv2.imshow("ONNX camera test", preview)

            if detections:
                crop = crop_best(frame, detections[0], args.padding_ratio)
                cv2.imshow("best crop", crop)

            key = cv2.waitKey(1) & 0xFF
            if key in (27, ord("q")):
                break
            if args.duration > 0 and (time.perf_counter() - start) >= args.duration:
                break
    finally:
        cap.release()
        cv2.destroyAllWindows()

    if infer_times:
        avg_infer = (sum(infer_times) / len(infer_times)) * 1000.0
        avg_fps = 1.0 / max(sum(frame_times) / len(frame_times), 1e-6)
        print(f"Average FPS: {avg_fps:.2f}")
        print(f"Average inference: {avg_infer:.2f} ms")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
