import argparse
import json
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import cv2
import numpy as np
import requests


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_source(source: Any) -> int | str:
    if isinstance(source, int):
        return source
    if isinstance(source, str) and source.isdigit():
        return int(source)
    return str(source)


def apply_capture_settings(cap: cv2.VideoCapture, capture_cfg: dict[str, Any]) -> None:
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, int(capture_cfg.get("width", 640)))
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, int(capture_cfg.get("height", 480)))
    cap.set(cv2.CAP_PROP_FPS, int(capture_cfg.get("fps", 15)))
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    fourcc = str(capture_cfg.get("fourcc", "MJPG"))
    if fourcc:
        cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*fourcc[:4]))


def camera_has_frame(source: int | str, capture_cfg: dict[str, Any], attempts: int = 8) -> bool:
    cap = cv2.VideoCapture(source)
    try:
        apply_capture_settings(cap, capture_cfg)
        if not cap.isOpened():
            return False

        for _ in range(max(attempts, 1)):
            ok, frame = cap.read()
            if ok and frame is not None:
                return True
            time.sleep(0.08)
        return False
    finally:
        cap.release()


class CameraCapture:
    def __init__(self, camera_id: int, name: str, source: int | str, capture_cfg: dict[str, Any]) -> None:
        self.camera_id = camera_id
        self.name = name
        self.source = source
        self.capture_cfg = capture_cfg
        self._cap: cv2.VideoCapture | None = None
        self._lock = threading.Lock()
        self._frame = None
        self._running = False
        self._thread: threading.Thread | None = None
        self.last_error = ""

    def start(self) -> None:
        self._running = True
        self._thread = threading.Thread(target=self._loop, name=f"camera-{self.camera_id}", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        if self._cap is not None:
            self._cap.release()

    def latest(self):
        with self._lock:
            return None if self._frame is None else self._frame.copy()

    def _open(self) -> cv2.VideoCapture:
        cap = cv2.VideoCapture(self.source)
        apply_capture_settings(cap, self.capture_cfg)
        return cap

    def _loop(self) -> None:
        while self._running:
            if self._cap is None or not self._cap.isOpened():
                self._cap = self._open()
                if not self._cap.isOpened():
                    self.last_error = "cannot_open_camera"
                    time.sleep(1.0)
                    continue

            ok, frame = self._cap.read()
            if not ok or frame is None:
                self.last_error = "cannot_read_frame"
                self._cap.release()
                self._cap = None
                time.sleep(0.2)
                continue

            self.last_error = ""
            with self._lock:
                self._frame = frame


class PcDetectClient:
    def __init__(self, cfg: dict[str, Any]) -> None:
        base_url = str(cfg.get("base_url", "http://127.0.0.1:9000")).rstrip("/") + "/"
        endpoint = str(cfg.get("endpoint", "/api/detect/batch/")).lstrip("/")
        self.url = urljoin(base_url, endpoint)
        self.timeout = float(cfg.get("timeout_seconds", 8.0))
        self.confidence = float(cfg.get("confidence", 0.25))
        self.pi_id = str(cfg.get("pi_id", "pi4"))
        self.slot_offset = int(cfg.get("slot_offset", 0))
        self.session = requests.Session()

    def detect(self, camera_id: int, jpeg_bytes: bytes) -> dict[str, Any]:
        files = {
            "file": (f"camera_{camera_id}_{int(time.time() * 1000)}.jpg", jpeg_bytes, "image/jpeg")
        }
        data = {
            "slot_index": str(camera_id),
            "conf": str(self.confidence),
            "pi_id": self.pi_id,
            "feed_slot": str(self.slot_offset + camera_id),
        }
        started = time.perf_counter()
        response = self.session.post(self.url, files=files, data=data, timeout=self.timeout)
        elapsed_ms = (time.perf_counter() - started) * 1000.0
        response.raise_for_status()
        payload = response.json()
        payload["_pc_roundtrip_ms"] = round(elapsed_ms, 2)
        return payload


def clamp_int(value: float, low: int, high: int) -> int:
    return max(low, min(high, int(round(value))))


def normalized_roi_to_pixels(roi_cfg: dict[str, Any], width: int, height: int) -> tuple[int, int, int, int]:
    x1 = clamp_int(float(roi_cfg.get("x1", 0.0)) * width, 0, width - 1)
    y1 = clamp_int(float(roi_cfg.get("y1", 0.0)) * height, 0, height - 1)
    x2 = clamp_int(float(roi_cfg.get("x2", 1.0)) * width, x1 + 1, width)
    y2 = clamp_int(float(roi_cfg.get("y2", 1.0)) * height, y1 + 1, height)
    return x1, y1, x2, y2


class FruitCropper:
    """Fruit locator for Pi-side crop before PC inference."""

    def __init__(self, cfg: dict[str, Any], config_dir: Path | None = None) -> None:
        self.enabled = bool(cfg.get("enabled", False))
        self.backend = str(cfg.get("backend", "opencv")).lower()
        self.padding_ratio = float(cfg.get("padding_ratio", 0.12))
        self.min_area_ratio = float(cfg.get("min_area_ratio", 0.03))
        self.max_area_ratio = float(cfg.get("max_area_ratio", 0.85))
        self.min_saturation = int(cfg.get("min_saturation", 35))
        self.min_value = int(cfg.get("min_value", 35))
        self.roi = cfg.get("roi", {"x1": 0.05, "y1": 0.05, "x2": 0.95, "y2": 0.95})
        self.fallback_to_full_frame = bool(cfg.get("fallback_to_full_frame", False))
        self.yolo_model = None
        self.onnx_session = None
        self.onnx_input_name = ""
        self.onnx_output_names: list[str] = []
        self.class_labels = [str(v) for v in cfg.get("class_labels", cfg.get("class_names", []))]
        self.yolo_confidence = float(cfg.get("confidence", 0.35))
        self.yolo_iou = float(cfg.get("iou", 0.45))
        self.yolo_imgsz = int(cfg.get("imgsz", 640))
        self.yolo_class_ids = {int(v) for v in cfg.get("class_ids", [])}
        self.yolo_class_names = {str(v).lower() for v in cfg.get("class_names", [])}

        if self.enabled and self.backend in {"onnx", "yolo"}:
            model_path = Path(str(cfg.get("model_path", "")))
            if str(model_path) == ".":
                raise RuntimeError(f"fruit_crop.model_path is required when backend is {self.backend}")
            if not model_path.is_absolute() and config_dir is not None:
                model_path = config_dir / model_path
            if not model_path.exists():
                raise RuntimeError(f"Fruit locator model not found: {model_path}")

        if self.enabled and self.backend == "onnx":
            try:
                import onnxruntime as ort
            except Exception as exc:
                raise RuntimeError("Install onnxruntime to use fruit_crop.backend='onnx'") from exc

            session_options = ort.SessionOptions()
            session_options.intra_op_num_threads = int(cfg.get("threads", 2))
            self.onnx_session = ort.InferenceSession(
                str(model_path),
                sess_options=session_options,
                providers=["CPUExecutionProvider"],
            )
            self.onnx_input_name = self.onnx_session.get_inputs()[0].name
            self.onnx_output_names = [output.name for output in self.onnx_session.get_outputs()]

        if self.enabled and self.backend == "yolo":
            try:
                from ultralytics import YOLO
            except Exception as exc:
                raise RuntimeError("Install ultralytics to use fruit_crop.backend='yolo'") from exc
            self.yolo_model = YOLO(str(model_path))

    def locate(self, frame) -> dict[str, Any] | None:
        if self.backend == "onnx":
            return self._locate_onnx(frame)
        if self.backend == "yolo":
            return self._locate_yolo(frame)
        return self._locate_opencv(frame)

    def _class_allowed(self, class_id: int, class_name: str) -> bool:
        if self.yolo_class_ids and class_id not in self.yolo_class_ids:
            return False
        if self.yolo_class_names and class_name.lower() not in self.yolo_class_names:
            return False
        return True

    def _class_name(self, class_id: int) -> str:
        if 0 <= class_id < len(self.class_labels):
            return self.class_labels[class_id]
        return str(class_id)

    def _preprocess_onnx(self, image) -> tuple[np.ndarray, float, int, int]:
        h, w = image.shape[:2]
        scale = min(self.yolo_imgsz / max(w, 1), self.yolo_imgsz / max(h, 1))
        new_w, new_h = int(round(w * scale)), int(round(h * scale))
        resized = cv2.resize(image, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        canvas = np.full((self.yolo_imgsz, self.yolo_imgsz, 3), 114, dtype=np.uint8)
        pad_x = (self.yolo_imgsz - new_w) // 2
        pad_y = (self.yolo_imgsz - new_h) // 2
        canvas[pad_y:pad_y + new_h, pad_x:pad_x + new_w] = resized
        rgb = cv2.cvtColor(canvas, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0
        tensor = np.transpose(tensor, (2, 0, 1))[np.newaxis, ...]
        return tensor, scale, pad_x, pad_y

    def _parse_onnx_output(
        self,
        output: np.ndarray,
        roi_width: int,
        roi_height: int,
        scale: float,
        pad_x: int,
        pad_y: int,
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
                confidence = float(row[4])
                class_id = int(row[5])
            else:
                class_scores = row[4:]
                class_id = int(np.argmax(class_scores))
                confidence = float(class_scores[class_id])
                cx, cy, bw, bh = map(float, row[:4])
                x1, y1 = cx - bw / 2.0, cy - bh / 2.0
                x2, y2 = cx + bw / 2.0, cy + bh / 2.0

            if confidence < self.yolo_confidence:
                continue

            class_name = self._class_name(class_id)
            if not self._class_allowed(class_id, class_name):
                continue

            x1 = (x1 - pad_x) / max(scale, 1e-6)
            y1 = (y1 - pad_y) / max(scale, 1e-6)
            x2 = (x2 - pad_x) / max(scale, 1e-6)
            y2 = (y2 - pad_y) / max(scale, 1e-6)
            x1 = max(0.0, min(float(roi_width), x1))
            y1 = max(0.0, min(float(roi_height), y1))
            x2 = max(0.0, min(float(roi_width), x2))
            y2 = max(0.0, min(float(roi_height), y2))
            box_w, box_h = x2 - x1, y2 - y1
            if box_w <= 1.0 or box_h <= 1.0:
                continue

            boxes.append([int(round(x1)), int(round(y1)), int(round(box_w)), int(round(box_h))])
            scores.append(confidence)
            candidates.append({
                "x1": x1,
                "y1": y1,
                "x2": x2,
                "y2": y2,
                "confidence": confidence,
                "class_id": class_id,
                "class_name": class_name,
            })

        if not candidates:
            return []

        keep = cv2.dnn.NMSBoxes(boxes, scores, self.yolo_confidence, self.yolo_iou)
        if len(keep) == 0:
            return []
        indices = np.array(keep).reshape(-1).tolist()
        return [candidates[i] for i in indices]

    def _locate_onnx(self, frame) -> dict[str, Any] | None:
        if self.onnx_session is None:
            return None

        height, width = frame.shape[:2]
        roi_x1, roi_y1, roi_x2, roi_y2 = normalized_roi_to_pixels(self.roi, width, height)
        roi_frame = frame[roi_y1:roi_y2, roi_x1:roi_x2]
        if roi_frame.size == 0:
            return None

        tensor, scale, pad_x, pad_y = self._preprocess_onnx(roi_frame)
        outputs = self.onnx_session.run(self.onnx_output_names, {self.onnx_input_name: tensor})
        parsed = self._parse_onnx_output(outputs[0], roi_frame.shape[1], roi_frame.shape[0], scale, pad_x, pad_y)

        best: dict[str, Any] | None = None
        best_score = -1.0
        frame_area = max(float(width * height), 1.0)
        for det in parsed:
            x1 = float(det["x1"]) + roi_x1
            y1 = float(det["y1"]) + roi_y1
            x2 = float(det["x2"]) + roi_x1
            y2 = float(det["y2"]) + roi_y1
            box_w = max(0.0, x2 - x1)
            box_h = max(0.0, y2 - y1)
            area_ratio = (box_w * box_h) / frame_area
            if area_ratio < self.min_area_ratio or area_ratio > self.max_area_ratio:
                continue

            confidence = float(det["confidence"])
            score = confidence * 100.0 + area_ratio * 10.0
            if score > best_score:
                best_score = score
                best = {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "area_ratio": round(area_ratio, 4),
                    "fill_ratio": 1.0,
                    "score": round(score, 4),
                    "confidence": round(confidence, 4),
                    "class_id": int(det["class_id"]),
                    "class_name": str(det["class_name"]),
                    "roi": {"x1": roi_x1, "y1": roi_y1, "x2": roi_x2, "y2": roi_y2},
                }

        return best

    def _locate_yolo(self, frame) -> dict[str, Any] | None:
        if self.yolo_model is None:
            return None

        height, width = frame.shape[:2]
        roi_x1, roi_y1, roi_x2, roi_y2 = normalized_roi_to_pixels(self.roi, width, height)
        roi_frame = frame[roi_y1:roi_y2, roi_x1:roi_x2]
        if roi_frame.size == 0:
            return None

        results = self.yolo_model.predict(
            roi_frame,
            conf=self.yolo_confidence,
            iou=self.yolo_iou,
            imgsz=self.yolo_imgsz,
            verbose=False,
        )

        best: dict[str, Any] | None = None
        best_score = -1.0
        frame_area = max(float(width * height), 1.0)
        names = getattr(self.yolo_model, "names", {})

        for result in results or []:
            boxes = getattr(result, "boxes", None)
            if boxes is None or len(boxes) == 0:
                continue

            result_names = getattr(result, "names", names)
            for idx in range(len(boxes)):
                xyxy = boxes.xyxy[idx].cpu().numpy()
                confidence = float(boxes.conf[idx].cpu().numpy())
                class_id = int(boxes.cls[idx].cpu().numpy())
                class_name = str(result_names.get(class_id, class_id)) if isinstance(result_names, dict) else str(class_id)
                if not self._class_allowed(class_id, class_name):
                    continue

                x1 = float(xyxy[0]) + roi_x1
                y1 = float(xyxy[1]) + roi_y1
                x2 = float(xyxy[2]) + roi_x1
                y2 = float(xyxy[3]) + roi_y1
                box_w = max(0.0, x2 - x1)
                box_h = max(0.0, y2 - y1)
                area_ratio = (box_w * box_h) / frame_area
                if area_ratio < self.min_area_ratio or area_ratio > self.max_area_ratio:
                    continue

                score = confidence * 100.0 + area_ratio * 10.0
                if score > best_score:
                    best_score = score
                    best = {
                        "x1": x1,
                        "y1": y1,
                        "x2": x2,
                        "y2": y2,
                        "area_ratio": round(area_ratio, 4),
                        "fill_ratio": 1.0,
                        "score": round(score, 4),
                        "confidence": round(confidence, 4),
                        "class_id": class_id,
                        "class_name": class_name,
                        "roi": {"x1": roi_x1, "y1": roi_y1, "x2": roi_x2, "y2": roi_y2},
                    }

        return best

    def _locate_opencv(self, frame) -> dict[str, Any] | None:
        height, width = frame.shape[:2]
        roi_x1, roi_y1, roi_x2, roi_y2 = normalized_roi_to_pixels(self.roi, width, height)
        roi_frame = frame[roi_y1:roi_y2, roi_x1:roi_x2]
        if roi_frame.size == 0:
            return None

        blurred = cv2.GaussianBlur(roi_frame, (5, 5), 0)
        hsv = cv2.cvtColor(blurred, cv2.COLOR_BGR2HSV)
        color_mask = cv2.inRange(
            hsv,
            np.array([0, self.min_saturation, self.min_value], dtype=np.uint8),
            np.array([179, 255, 255], dtype=np.uint8),
        )

        gray = cv2.cvtColor(blurred, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 60, 160)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        edge_mask = cv2.dilate(edges, kernel, iterations=1)

        mask = cv2.bitwise_or(color_mask, edge_mask)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=2)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel, iterations=1)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        frame_area = max(float(width * height), 1.0)
        frame_center = (width / 2.0, height / 2.0)
        best: dict[str, Any] | None = None
        best_score = -1.0

        for contour in contours:
            area = float(cv2.contourArea(contour))
            area_ratio = area / frame_area
            if area_ratio < self.min_area_ratio or area_ratio > self.max_area_ratio:
                continue

            x, y, w, h = cv2.boundingRect(contour)
            x1, y1 = roi_x1 + x, roi_y1 + y
            x2, y2 = x1 + w, y1 + h
            box_area = max(float(w * h), 1.0)
            fill_ratio = area / box_area
            cx, cy = (x1 + x2) / 2.0, (y1 + y2) / 2.0
            center_distance = ((cx - frame_center[0]) ** 2 + (cy - frame_center[1]) ** 2) ** 0.5
            center_weight = 1.0 - min(center_distance / max(width, height), 1.0)
            score = area_ratio * 100.0 + fill_ratio * 10.0 + center_weight * 5.0

            if score > best_score:
                best_score = score
                best = {
                    "x1": x1,
                    "y1": y1,
                    "x2": x2,
                    "y2": y2,
                    "area_ratio": round(area_ratio, 4),
                    "fill_ratio": round(fill_ratio, 4),
                    "score": round(score, 4),
                    "roi": {"x1": roi_x1, "y1": roi_y1, "x2": roi_x2, "y2": roi_y2},
                }

        return best

    def crop(self, frame) -> tuple[Any | None, dict[str, Any] | None]:
        if not self.enabled:
            return frame, None

        candidate = self.locate(frame)
        if candidate is None:
            if self.fallback_to_full_frame:
                return frame, {"status": "fallback_full_frame", "reason": "fruit_not_found"}
            return None, {"status": "skipped", "reason": "fruit_not_found"}

        height, width = frame.shape[:2]
        box_w = candidate["x2"] - candidate["x1"]
        box_h = candidate["y2"] - candidate["y1"]
        pad = int(round(max(box_w, box_h) * self.padding_ratio))
        crop_x1 = clamp_int(candidate["x1"] - pad, 0, width - 1)
        crop_y1 = clamp_int(candidate["y1"] - pad, 0, height - 1)
        crop_x2 = clamp_int(candidate["x2"] + pad, crop_x1 + 1, width)
        crop_y2 = clamp_int(candidate["y2"] + pad, crop_y1 + 1, height)

        crop = frame[crop_y1:crop_y2, crop_x1:crop_x2].copy()
        metadata = {
            "status": "cropped",
            "backend": self.backend,
            "bbox": {
                "x1": int(candidate["x1"]),
                "y1": int(candidate["y1"]),
                "x2": int(candidate["x2"]),
                "y2": int(candidate["y2"]),
            },
            "crop_box": {"x1": crop_x1, "y1": crop_y1, "x2": crop_x2, "y2": crop_y2},
            "original_width": width,
            "original_height": height,
            "crop_width": crop_x2 - crop_x1,
            "crop_height": crop_y2 - crop_y1,
            "area_ratio": candidate["area_ratio"],
            "fill_ratio": candidate["fill_ratio"],
            "score": candidate["score"],
            "locator_confidence": candidate.get("confidence"),
            "locator_class_id": candidate.get("class_id"),
            "locator_class_name": candidate.get("class_name"),
            "roi": candidate["roi"],
        }
        return crop, metadata


def encode_jpeg(frame, quality: int) -> bytes:
    ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), int(quality)])
    if not ok:
        raise RuntimeError("cannot_encode_jpeg")
    return encoded.tobytes()


def draw_local_crop_preview(frame, crop_meta: dict[str, Any] | None, title: str) -> None:
    if not crop_meta:
        return

    roi = crop_meta.get("roi")
    if isinstance(roi, dict):
        cv2.rectangle(
            frame,
            (int(roi["x1"]), int(roi["y1"])),
            (int(roi["x2"]), int(roi["y2"])),
            (120, 120, 120),
            1,
        )

    bbox = crop_meta.get("bbox")
    if isinstance(bbox, dict):
        x1, y1, x2, y2 = int(bbox["x1"]), int(bbox["y1"]), int(bbox["x2"]), int(bbox["y2"])
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 220, 255), 2)
        cv2.putText(frame, "fruit crop", (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 255), 2)

    if crop_meta.get("status") == "skipped":
        cv2.putText(frame, "fruit not found", (12, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 80, 255), 2)

    cv2.imshow(title, frame)


def draw_preview(frame, detections: list[dict[str, Any]], title: str) -> None:
    colors = {"mature": (34, 197, 94), "immature": (0, 159, 245), "defective": (68, 68, 239)}
    for det in detections:
        color = colors.get(str(det.get("class_name")), (255, 255, 255))
        x1, y1, x2, y2 = int(det["x1"]), int(det["y1"]), int(det["x2"]), int(det["y2"])
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label = f'{det["class_name"]} {float(det["confidence"]) * 100:.0f}%'
        cv2.putText(frame, label, (x1, max(18, y1 - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)
    cv2.imshow(title, frame)


def extract_detections(response: dict[str, Any], camera_id: int) -> list[dict[str, Any]]:
    results = response.get("results")
    if isinstance(results, list):
        for item in results:
            if int(item.get("slot_index", camera_id)) == camera_id:
                detections = item.get("detections", [])
                return detections if isinstance(detections, list) else []
    detections = response.get("detections", [])
    return detections if isinstance(detections, list) else []


def save_failed_frame(frame, failed_dir: Path, camera_id: int) -> None:
    failed_dir.mkdir(parents=True, exist_ok=True)
    filename = f"camera_{camera_id}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.jpg"
    cv2.imwrite(str(failed_dir / filename), frame)


def load_config(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    parser = argparse.ArgumentParser(description="Raspberry Pi camera sender for PC-side durian detection.")
    parser.add_argument("--config", default="config.example.json", help="Path to JSON config.")
    args = parser.parse_args()

    config_path = Path(args.config).resolve()
    config = load_config(config_path)
    client = PcDetectClient(config.get("pc_server", {}))
    cropper = FruitCropper(config.get("fruit_crop", {}), config_path.parent)

    capture_cfg = config.get("capture", {})
    skip_unavailable = bool(config.get("skip_unavailable_cameras", True))
    cameras: list[CameraCapture] = []
    skipped_cameras: list[dict[str, Any]] = []
    for cam_cfg in config.get("cameras", []):
        if not cam_cfg.get("enabled", True):
            continue
        camera_id = int(cam_cfg["id"])
        source = normalize_source(cam_cfg.get("source", cam_cfg["id"]))
        if skip_unavailable and not camera_has_frame(source, capture_cfg):
            skipped_cameras.append({
                "id": camera_id,
                "name": str(cam_cfg.get("name", f"camera_{camera_id}")),
                "source": str(source),
                "reason": "camera_unavailable",
            })
            continue

        cam = CameraCapture(
            camera_id=camera_id,
            name=str(cam_cfg.get("name", f"camera_{camera_id}")),
            source=source,
            capture_cfg=capture_cfg,
        )
        cameras.append(cam)

    if not cameras:
        print(json.dumps({
            "type": "no_available_cameras",
            "timestamp": utc_now(),
            "skipped_cameras": skipped_cameras,
        }, ensure_ascii=False), file=sys.stderr)
        return 2

    running = True

    def handle_stop(_signum: int, _frame: Any) -> None:
        nonlocal running
        running = False

    signal.signal(signal.SIGINT, handle_stop)
    signal.signal(signal.SIGTERM, handle_stop)

    for cam in cameras:
        cam.start()

    min_interval = 1.0 / max(float(config.get("send_fps_per_camera", 3.0)), 0.1)
    next_due = {cam.camera_id: 0.0 for cam in cameras}
    jpeg_quality = int(config.get("jpeg_quality", 82))
    preview = bool(config.get("preview", False))
    preview_sent = bool(config.get("preview_sent", False))
    save_failed = bool(config.get("save_failed_frames", False))
    failed_dir = (config_path.parent / str(config.get("failed_frame_dir", "failed_frames"))).resolve()

    print(json.dumps({
        "type": "runtime_started",
        "timestamp": utc_now(),
        "pc_detect_url": client.url,
        "fruit_crop_enabled": cropper.enabled,
        "cameras": [{"id": c.camera_id, "name": c.name, "source": str(c.source)} for c in cameras],
        "skipped_cameras": skipped_cameras,
    }), flush=True)

    try:
        while running:
            now = time.monotonic()
            did_work = False
            for cam in cameras:
                if now < next_due[cam.camera_id]:
                    continue
                next_due[cam.camera_id] = now + min_interval

                frame = cam.latest()
                if frame is None:
                    if cam.last_error:
                        print(json.dumps({
                            "type": "camera_status",
                            "timestamp": utc_now(),
                            "camera_id": cam.camera_id,
                            "camera_name": cam.name,
                            "status": cam.last_error,
                        }), flush=True)
                    continue

                did_work = True
                try:
                    frame_to_send, crop_meta = cropper.crop(frame)
                    if preview:
                        source_preview = frame.copy()
                        if crop_meta:
                            draw_local_crop_preview(source_preview, crop_meta, f"{cam.name} source")
                        else:
                            cv2.imshow(f"{cam.name} source", source_preview)

                    if frame_to_send is None:
                        print(json.dumps({
                            "type": "crop_status",
                            "timestamp": utc_now(),
                            "camera_id": cam.camera_id,
                            "camera_name": cam.name,
                            "status": crop_meta.get("status") if crop_meta else "skipped",
                            "reason": crop_meta.get("reason") if crop_meta else "fruit_not_found",
                        }, ensure_ascii=False), flush=True)
                        continue

                    jpeg = encode_jpeg(frame_to_send, jpeg_quality)
                    response = client.detect(cam.camera_id, jpeg)
                    detections = extract_detections(response, cam.camera_id)
                    print(json.dumps({
                        "type": "pc_detection_result",
                        "timestamp": utc_now(),
                        "camera_id": cam.camera_id,
                        "camera_name": cam.name,
                        "sent_image": "crop" if crop_meta and crop_meta.get("status") == "cropped" else "full_frame",
                        "crop": crop_meta,
                        "detection_count": len(detections),
                        "detections": detections,
                        "pc_roundtrip_ms": response.get("_pc_roundtrip_ms"),
                        "raw_response": response,
                    }, ensure_ascii=False), flush=True)

                    if preview and preview_sent:
                        preview_frame = frame_to_send.copy()
                        draw_preview(preview_frame, detections, f"{cam.name} sent")
                except Exception as exc:
                    if save_failed:
                        save_failed_frame(frame, failed_dir, cam.camera_id)
                    print(json.dumps({
                        "type": "send_error",
                        "timestamp": utc_now(),
                        "camera_id": cam.camera_id,
                        "camera_name": cam.name,
                        "message": str(exc),
                    }, ensure_ascii=False), flush=True)

            if preview and cv2.waitKey(1) == 27:
                running = False
            if not did_work:
                time.sleep(0.01)
    finally:
        for cam in cameras:
            cam.stop()
        if preview:
            cv2.destroyAllWindows()

    print(json.dumps({"type": "runtime_stopped", "timestamp": utc_now()}), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
