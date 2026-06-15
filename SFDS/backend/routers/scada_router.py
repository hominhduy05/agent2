"""
SCADA Router — WebSocket realtime detection, RTSP camera proxy.
Mounted into app_scada.py.
"""
import io
import time
import threading
import base64
from datetime import datetime
from dataclasses import dataclass, field
from typing import ClassVar

from fastapi import APIRouter, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from PIL import Image
import numpy as np

from core.pi_feed import get_latest_pi_feed, get_pi_feeds
from services.mqtt_publisher import publish_enterprise_event
from core.demo_label_override import (
    apply_demo_label_override,
    get_demo_status,
    is_demo_enabled,
    mark_demo_slot_empty,
    set_demo_enabled,
)
from core.sort_tracker import TrackerManager
from core.shared import (
    engine_obj, model_loaded, model_format,
    BoundingBox,
    SlotDetectionResponse, BatchDetectResponse,
    CameraConfigRequest,
)

router = APIRouter(prefix="", tags=["SCADA"])


# ---------------------------------------------------------------------------
# Global tracker manager
# ---------------------------------------------------------------------------
_tracker_mgr: TrackerManager | None = None


def get_tracker_mgr() -> TrackerManager:
    global _tracker_mgr
    if _tracker_mgr is None:
        _tracker_mgr = TrackerManager(num_slots=4, max_age=15, min_hits=1, iou_threshold=0.3)
    return _tracker_mgr


# ---------------------------------------------------------------------------
# Global RTSP config
# ---------------------------------------------------------------------------
CAMERA_RTSP_URLS: dict[int, str] = {0: "", 1: "", 2: "", 3: ""}
_slot_captures: dict[int, "RtspCapture"] = {}


@router.get("/api/scada/pi-feed/")
async def get_pi_feed() -> dict:
    return get_latest_pi_feed()


@router.get("/api/scada/pi-feeds/")
async def get_pi_feed_list() -> dict:
    return get_pi_feeds()


# ---------------------------------------------------------------------------
# RTSP capture helper
# ---------------------------------------------------------------------------
class RtspCapture:
    def __init__(self, slot: int, url: str):
        import cv2
        self.slot = slot
        self.url = url
        self.cap: cv2.VideoCapture | None = None
        self._lock = threading.Lock()
        self._last_frame: np.ndarray | None = None
        self._bg_thread: threading.Thread | None = None
        self._running = False

    def start(self):
        import cv2
        self.cap = cv2.VideoCapture(self.url)
        self._running = True
        self._bg_thread = threading.Thread(target=self._fetch_loop, daemon=True)
        self._bg_thread.start()

    def stop(self):
        self._running = False
        if self.cap:
            self.cap.release()
            self.cap = None
        with self._lock:
            self._last_frame = None

    def _fetch_loop(self):
        import cv2
        while self._running:
            if self.cap and self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret:
                    with self._lock:
                        self._last_frame = frame.copy()
            time.sleep(0.03)

    def get_frame(self) -> np.ndarray | None:
        with self._lock:
            return self._last_frame.copy() if self._last_frame is not None else None


# ---------------------------------------------------------------------------
# Detection session manager (WebSocket)
# ---------------------------------------------------------------------------
class _DetectionSession:
    def __init__(self, slot: int):
        self.slot = slot
        self.confidence = 0.25
        self.active = False
        self._lock = threading.Lock()


class _DetectionSessionManager:
    _sessions: dict[int, _DetectionSession] = {}
    _ws_clients: dict[int, list[WebSocket]] = {}
    _lock: ClassVar[threading.Lock] = threading.Lock()

    @classmethod
    def register(cls, slot: int, ws: WebSocket, conf: float):
        with cls._lock:
            if slot not in cls._sessions:
                cls._sessions[slot] = _DetectionSession(slot)
            cls._sessions[slot].active = True
            cls._sessions[slot].confidence = conf
            if slot not in cls._ws_clients:
                cls._ws_clients[slot] = []
            cls._ws_clients[slot].append(ws)

    @classmethod
    def unregister(cls, slot: int, ws: WebSocket):
        with cls._lock:
            if slot in cls._ws_clients:
                cls._ws_clients[slot] = [w for w in cls._ws_clients[slot] if w is not ws]
                if not cls._ws_clients[slot]:
                    if slot in cls._sessions:
                        cls._sessions[slot].active = False
                    del cls._ws_clients[slot]

    @classmethod
    async def push_result(cls, slot: int, result_data: dict):
        with cls._lock:
            if slot not in cls._ws_clients:
                return
            dead = []
            for ws in cls._ws_clients[slot]:
                try:
                    await ws.send_json(result_data)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                if ws in cls._ws_clients.get(slot, []):
                    cls._ws_clients[slot].remove(ws)


# ---------------------------------------------------------------------------
# WebSocket realtime detection
# ---------------------------------------------------------------------------
CLASS_NAME_TO_ID = {
    "defective": 0,
    "immature": 1,
    "mature": 2,
    "none": 3,
    # DEMO ONLY: fixed display grades generated by core/demo_label_override.py.
    "demo_grade_b": 901,
    "demo_grade_a": 902,
    "demo_grade_c": 903,
    "demo_grade_d": 904,
}


@router.get("/api/scada/demo-mode/")
async def get_scada_demo_mode() -> dict:
    return get_demo_status()


@router.post("/api/scada/demo-mode/")
async def set_scada_demo_mode(payload: dict) -> dict:
    enabled = bool(payload.get("enabled", False))
    set_demo_enabled(enabled, reset_sequence=True)
    return get_demo_status()


@dataclass
class _QualityGateState:
    phase: str = "idle"
    stable_frames: int = 0
    empty_frames: int = 0
    last_center: tuple[float, float] | None = None
    last_area_ratio: float = 0.0
    best_score: float = -1.0
    best_raw: list[dict] = field(default_factory=list)

    def reset_tracking(self):
        self.phase = "idle"
        self.stable_frames = 0
        self.empty_frames = 0
        self.last_center = None
        self.last_area_ratio = 0.0
        self.best_score = -1.0
        self.best_raw = []


_quality_states: dict[int, _QualityGateState] = {}
_quality_lock = threading.Lock()

QUALITY_REQUIRED_STABLE_FRAMES = 2
QUALITY_EMPTY_RESET_FRAMES = 3
QUALITY_MIN_AREA_RATIO = 0.02
QUALITY_MAX_AREA_RATIO = 0.75   
QUALITY_MIN_EDGE_MARGIN_RATIO = 0.035
QUALITY_MAX_CENTER_SHIFT_RATIO = 0.08
QUALITY_MAX_AREA_SHIFT_RATIO = 0.5
QUALITY_MIN_BLUR_SCORE = 40.0
QUALITY_ROI = {
    "x1": 0.18,
    "y1": 0.16,
    "x2": 0.82,
    "y2": 0.84,
}
DEMO_QUALITY_ROI = {
    "x1": 0.08,
    "y1": 0.08,
    "x2": 0.92,
    "y2": 0.92,
}


def _publish_detection_completed(
    slot: int,
    detections: list[dict],
    width: int,
    height: int,
    conf: float,
    *,
    track_ids: list[int] | None = None,
    quality: dict | None = None,
):
    counts = {
        "mature": sum(1 for d in detections if d.get("class_name") == "mature"),
        "immature": sum(1 for d in detections if d.get("class_name") == "immature"),
        "defective": sum(1 for d in detections if d.get("class_name") == "defective"),
    }
    publish_enterprise_event(
        "detection.completed",
        {
            "detections": detections,
            "detection_count": len(detections),
            "counts": counts,
            "track_ids": track_ids or [],
            "image": {"width": width, "height": height},
            "model": {"format": model_format},
            "confidence_threshold": conf,
            "quality": quality or {},
        },
        camera_slot=slot,
        topic="detection/completed",
    )


def get_quality_state(slot: int) -> _QualityGateState:
    with _quality_lock:
        if slot not in _quality_states:
            _quality_states[slot] = _QualityGateState()
        return _quality_states[slot]


def reset_quality_state(slot: int):
    with _quality_lock:
        _quality_states[slot] = _QualityGateState()


def _blur_score(image: Image.Image) -> float:
    import cv2
    arr = np.array(image)
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _best_detection(detections: list[dict]) -> dict | None:
    if not detections:
        return None
    return max(
        detections,
        key=lambda d: (
            float(d.get("confidence", 0.0)),
            max(0.0, float(d["x2"]) - float(d["x1"])) * max(0.0, float(d["y2"]) - float(d["y1"])),
        ),
    )


def _edge_margin_ratio(det: dict, width: int, height: int) -> float:
    margins = [
        float(det["x1"]) / max(width, 1),
        float(det["y1"]) / max(height, 1),
        (width - float(det["x2"])) / max(width, 1),
        (height - float(det["y2"])) / max(height, 1),
    ]
    return max(0.0, min(margins))


def _center_inside_roi(center: tuple[float, float]) -> bool:
    roi = DEMO_QUALITY_ROI if is_demo_enabled() else QUALITY_ROI
    return (
        roi["x1"] <= center[0] <= roi["x2"]
        and roi["y1"] <= center[1] <= roi["y2"]
    )


def _quality_gate(slot: int, raw: list[dict], image: Image.Image, width: int, height: int, frame_conf: float) -> dict:
    state = get_quality_state(slot)
    active_roi = DEMO_QUALITY_ROI if is_demo_enabled() else QUALITY_ROI
    blur = _blur_score(image)
    candidate = _best_detection(raw)

    if candidate is None:
        state.empty_frames += 1
        if state.empty_frames >= QUALITY_EMPTY_RESET_FRAMES:
            mark_demo_slot_empty(slot)
            state.reset_tracking()
        return {
            "ready": False,
            "phase": state.phase if state.phase != "idle" else "waiting",
            "reason": "waiting_for_fruit",
            "blur_score": round(blur, 2),
            "stable_frames": state.stable_frames,
            "roi": active_roi,
            "raw_detection_count": len(raw),
            "confidence_threshold": frame_conf,
        }

    state.empty_frames = 0
    x1, y1 = float(candidate["x1"]), float(candidate["y1"])
    x2, y2 = float(candidate["x2"]), float(candidate["y2"])
    box_w, box_h = max(0.0, x2 - x1), max(0.0, y2 - y1)
    area_ratio = (box_w * box_h) / max(float(width * height), 1.0)
    center = ((x1 + x2) / 2 / max(width, 1), (y1 + y2) / 2 / max(height, 1))
    edge_margin = _edge_margin_ratio(candidate, width, height)
    was_captured = state.phase == "captured"

    if state.last_center is None:
        stable = False
    else:
        dx = center[0] - state.last_center[0]
        dy = center[1] - state.last_center[1]
        center_shift = (dx * dx + dy * dy) ** 0.5
        area_shift = abs(area_ratio - state.last_area_ratio) / max(state.last_area_ratio, 1e-6)
        stable = center_shift <= QUALITY_MAX_CENTER_SHIFT_RATIO and area_shift <= QUALITY_MAX_AREA_SHIFT_RATIO

    state.stable_frames = state.stable_frames + 1 if stable else 1
    state.last_center = center
    state.last_area_ratio = area_ratio
    if not was_captured:
        state.phase = "tracking"

    has_good_area = QUALITY_MIN_AREA_RATIO <= area_ratio <= QUALITY_MAX_AREA_RATIO
    is_in_roi = _center_inside_roi(center)
    is_inside_frame = edge_margin >= QUALITY_MIN_EDGE_MARGIN_RATIO
    is_sharp = blur >= QUALITY_MIN_BLUR_SCORE
    is_stable = state.stable_frames >= QUALITY_REQUIRED_STABLE_FRAMES
    is_confident = float(candidate.get("confidence", 0.0)) >= frame_conf

    if was_captured:
        if is_demo_enabled():
            if has_good_area and is_in_roi and is_inside_frame and is_confident:
                return {
                    "ready": True,
                    "phase": "captured",
                    "reason": "demo_tracking",
                    "detections": [dict(obj) for obj in raw],
                    "blur_score": round(blur, 2),
                    "stable_frames": state.stable_frames,
                    "area_ratio": round(area_ratio, 4),
                    "edge_margin_ratio": round(edge_margin, 4),
                    "roi": active_roi,
                    "raw_detection_count": len(raw),
                    "confidence_threshold": frame_conf,
                }
            mark_demo_slot_empty(slot)
            state.reset_tracking()
            return {
                "ready": False,
                "phase": "waiting",
                "reason": "fruit_outside_roi" if not is_in_roi else "waiting_for_fruit",
                "blur_score": round(blur, 2),
                "stable_frames": 0,
                "roi": active_roi,
                "raw_detection_count": len(raw),
                "confidence_threshold": frame_conf,
            }
        if state.empty_frames >= QUALITY_EMPTY_RESET_FRAMES:
            state.reset_tracking()
        return {
            "ready": False,
            "phase": "cooldown",
            "reason": "fruit_already_captured",
            "blur_score": round(blur, 2),
            "stable_frames": state.stable_frames,
            "roi": active_roi,
            "raw_detection_count": len(raw),
            "confidence_threshold": frame_conf,
        }

    quality_score = (
        float(candidate.get("confidence", 0.0)) * 100.0
        + min(blur, 300.0) / 15.0
        + min(area_ratio, 0.3) * 100.0
        + min(edge_margin, 0.2) * 50.0
    )
    if has_good_area and is_in_roi and is_inside_frame and is_sharp and quality_score > state.best_score:
        state.best_score = quality_score
        state.best_raw = [dict(obj) for obj in raw]

    checks = {
        "area_ok": has_good_area,
        "roi_ok": is_in_roi,
        "inside_frame": is_inside_frame,
        "sharp": is_sharp,
        "stable": is_stable,
        "confidence_ok": is_confident,
    }

    if all(checks.values()) and state.best_raw:
        detections = state.best_raw
        state.phase = "captured"
        return {
            "ready": True,
            "phase": "captured",
            "reason": "frame_accepted",
            "detections": detections,
            "blur_score": round(blur, 2),
            "stable_frames": state.stable_frames,
            "area_ratio": round(area_ratio, 4),
            "edge_margin_ratio": round(edge_margin, 4),
            "roi": active_roi,
            "raw_detection_count": len(raw),
            "confidence_threshold": frame_conf,
        }

    reason = "waiting_for_stable_frame"
    if not has_good_area:
        reason = "fruit_too_small_or_large"
    elif not is_in_roi:
        reason = "fruit_outside_roi"
    elif not is_inside_frame:
        reason = "fruit_too_close_to_edge"
    elif not is_sharp:
        reason = "frame_blurry"
    elif not is_stable:
        reason = "waiting_for_stability"
    elif not is_confident:
        reason = "low_confidence"

    return {
        "ready": False,
        "phase": "tracking",
        "reason": reason,
        "checks": checks,
        "blur_score": round(blur, 2),
        "stable_frames": state.stable_frames,
        "required_stable_frames": QUALITY_REQUIRED_STABLE_FRAMES,
        "area_ratio": round(area_ratio, 4),
        "edge_margin_ratio": round(edge_margin, 4),
        "roi": active_roi,
        "raw_detection_count": len(raw),
        "confidence_threshold": frame_conf,
    }


@router.websocket("/ws/scada/detect/{slot}/")
async def ws_scada_detect(ws: WebSocket, slot: int):
    if not (0 <= slot <= 3):
        await ws.close(code=1008, reason="slot must be 0-3")
        return

    await ws.accept()
    print(f"[WS] Client connected slot={slot}")
    conf = 0.25
    _DetectionSessionManager.register(slot, ws, conf)
    reset_quality_state(slot)

    try:
        while True:
            try:
                msg = await ws.receive_json()
            except RuntimeError:
                break
            msg_type = msg.get("type")

            if msg_type == "set_confidence":
                conf = float(msg.get("value", 0.25))
                continue

            if msg_type == "frame":
                try:
                    img_data = base64.b64decode(msg["data"])
                    image = Image.open(io.BytesIO(img_data)).convert("RGB")
                    width, height = image.size
                except Exception:
                    continue

                frame_conf = float(msg.get("confidence", conf))

                if engine_obj is None:
                    await ws.send_json({"type": "error", "message": "Model not loaded"})
                    continue

                try:
                    raw = engine_obj.predict(image, conf=frame_conf, iou=0.45)
                except Exception as e:
                    print(f"[WS] Inference error slot {slot}: {e}")
                    await ws.send_json({"type": "error", "message": f"Inference error: {e}"})
                    continue

                try:
                    quality = _quality_gate(slot, raw, image, width, height, frame_conf)

                    if not quality["ready"]:
                        await ws.send_json({
                            "type": "quality_status",
                            "slot": slot,
                            "image_width": width,
                            "image_height": height,
                            "timestamp": datetime.utcnow().isoformat(),
                            **quality,
                        })
                        continue

                    final_detections = quality["detections"]
                    # DEMO ONLY: replace model class labels with B -> A -> C -> D.
                    final_detections = apply_demo_label_override(final_detections, slot=slot)

                    mature = immature = defective = 0
                    for obj in final_detections:
                        cls = obj.get("class_name", "")
                        if cls == "mature":
                            mature += 1
                        elif cls == "immature":
                            immature += 1
                        elif cls == "defective":
                            defective += 1

                    result = {
                        "type": "result",
                        "slot": slot,
                        "detections": [
                            {
                                "x1": o["x1"], "y1": o["y1"],
                                "x2": o["x2"], "y2": o["y2"],
                                "confidence": o["confidence"],
                                "class_id": o.get("class_id", CLASS_NAME_TO_ID.get(o["class_name"], 3)),
                                "class_name": o["class_name"],
                            }
                            for o in final_detections
                        ],
                        "image_width": width,
                        "image_height": height,
                        "raw_detection_count": len(raw),
                        "tracked_detection_count": len(final_detections),
                        "confidence_threshold": frame_conf,
                        "quality": {
                            "phase": quality["phase"],
                            "reason": quality["reason"],
                            "blur_score": quality["blur_score"],
                            "stable_frames": quality["stable_frames"],
                            "area_ratio": quality.get("area_ratio"),
                            "edge_margin_ratio": quality.get("edge_margin_ratio"),
                        },
                        "unique_mature": mature,
                        "unique_immature": immature,
                        "unique_defective": defective,
                        "timestamp": datetime.utcnow().isoformat(),
                    }

                    _publish_detection_completed(
                        slot,
                        final_detections,
                        width,
                        height,
                        frame_conf,
                        quality=result["quality"],
                    )
                    await _DetectionSessionManager.push_result(slot, result)
                except Exception as e:
                    print(f"[WS] Quality gate error slot {slot}: {e}")
                    continue

            elif msg_type == "ping":
                await ws.send_json({"type": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        _DetectionSessionManager.unregister(slot, ws)


# ---------------------------------------------------------------------------
# RTSP Camera config
# ---------------------------------------------------------------------------
@router.get("/api/scada/cameras/")
async def get_camera_config() -> dict:
    return {
        "cameras": {
            str(slot): {"url": url, "online": False}
            for slot, url in CAMERA_RTSP_URLS.items()
        }
    }


@router.post("/api/scada/cameras/")
async def update_camera_config(body: CameraConfigRequest) -> dict:
    global _slot_captures
    for slot_str, url in body.cameras.items():
        slot = int(slot_str)
        if slot not in CAMERA_RTSP_URLS:
            raise HTTPException(status_code=400, detail=f"Invalid slot: {slot}")
        CAMERA_RTSP_URLS[slot] = url
        if slot in _slot_captures:
            _slot_captures[slot].stop()
            del _slot_captures[slot]
    return {"status": "ok", "cameras": CAMERA_RTSP_URLS}


# ---------------------------------------------------------------------------
# RTSP frame proxy
# ---------------------------------------------------------------------------
@router.get("/api/scada/frame/{slot}/")
async def get_camera_frame(slot: int) -> StreamingResponse:
    if not (0 <= slot <= 3):
        raise HTTPException(status_code=400, detail="slot must be 0-3")

    rtsp_url = CAMERA_RTSP_URLS.get(slot, "")
    if not rtsp_url:
        raise HTTPException(status_code=404, detail="Camera not configured for this slot")

    global _slot_captures

    if slot not in _slot_captures:
        cap = RtspCapture(slot, rtsp_url)
        cap.start()
        _slot_captures[slot] = cap
        time.sleep(0.1)

    frame = _slot_captures[slot].get_frame()
    if frame is None:
        raise HTTPException(status_code=502, detail="Cannot read frame from camera")

    import cv2
    _, img_encoded = cv2.imencode(".jpg", frame)
    return StreamingResponse(
        io.BytesIO(img_encoded.tobytes()),
        media_type="image/jpeg",
    )


# ---------------------------------------------------------------------------
# RTSP detect endpoint
# ---------------------------------------------------------------------------
@router.post("/api/scada/detect/{slot}/", response_model=BatchDetectResponse)
async def detect_camera_frame(
    slot: int,
    conf: float = Form(0.25),
) -> BatchDetectResponse:
    if not (0 <= slot <= 3):
        raise HTTPException(status_code=400, detail="slot must be 0-3")

    if engine_obj is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")

    rtsp_url = CAMERA_RTSP_URLS.get(slot, "")
    if not rtsp_url:
        raise HTTPException(status_code=404, detail="Camera not configured for this slot")

    global _slot_captures

    if slot not in _slot_captures:
        cap = RtspCapture(slot, rtsp_url)
        cap.start()
        _slot_captures[slot] = cap
        time.sleep(0.1)

    frame = _slot_captures[slot].get_frame()
    if frame is None:
        raise HTTPException(status_code=502, detail="Cannot read frame from camera")

    import cv2
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = Image.fromarray(rgb)
    width, height = image.size

    raw = engine_obj.predict(image, conf=conf, iou=0.45)
    tracked = get_tracker_mgr().update(slot, raw)
    # DEMO ONLY: replace model class labels with B -> A -> C -> D.
    tracked = apply_demo_label_override(tracked, slot=slot)

    unique_mature, unique_immature, unique_defective = 0, 0, 0
    track_ids = []
    seen_ids: set[int] = set()
    for obj in tracked:
        tid = obj.get("track_id")
        if tid is None or tid in seen_ids:
            continue
        seen_ids.add(tid)
        track_ids.append(tid)
        cls = obj.get("class_name", "")
        if cls == "mature":
            unique_mature += 1
        elif cls == "immature":
            unique_immature += 1
        elif cls == "defective":
            unique_defective += 1

    _publish_detection_completed(
        slot,
        tracked,
        width,
        height,
        conf,
        track_ids=track_ids,
    )

    return BatchDetectResponse(
        results=[
            SlotDetectionResponse(
                slot_index=slot,
                detections=[
                    BoundingBox(
                        x1=o["x1"], y1=o["y1"], x2=o["x2"], y2=o["y2"],
                        confidence=o["confidence"],
                        class_id=o.get("class_id", CLASS_NAME_TO_ID.get(o["class_name"], 3)),
                        class_name=o["class_name"],
                    )
                    for o in tracked
                ],
                image_width=width,
                image_height=height,
                model_format=model_format,
                detection_count=len(tracked),
                unique_mature=unique_mature,
                unique_immature=unique_immature,
                unique_defective=unique_defective,
                track_ids=track_ids,
            )
        ],
        total_unique_objects=len(track_ids),
        timestamp=datetime.utcnow().isoformat(),
    )


# ---------------------------------------------------------------------------
# RTSP camera start/stop
# ---------------------------------------------------------------------------
@router.post("/api/scada/cameras/{slot}/start/")
async def start_camera(slot: int) -> dict:
    if not (0 <= slot <= 3):
        raise HTTPException(status_code=400, detail="slot must be 0-3")

    global _slot_captures
    rtsp_url = CAMERA_RTSP_URLS.get(slot, "")
    if not rtsp_url:
        raise HTTPException(status_code=404, detail="Camera not configured for this slot")

    if slot not in _slot_captures:
        cap = RtspCapture(slot, rtsp_url)
        cap.start()
        _slot_captures[slot] = cap
    return {"status": "started", "slot": slot, "url": rtsp_url}


@router.post("/api/scada/cameras/{slot}/stop/")
async def stop_camera(slot: int) -> dict:
    global _slot_captures
    if slot in _slot_captures:
        _slot_captures[slot].stop()
        del _slot_captures[slot]
    return {"status": "stopped", "slot": slot}
