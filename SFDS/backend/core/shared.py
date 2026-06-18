from datetime import datetime
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, Field
from PIL import Image
import numpy as np
import torch

from ultralytics import YOLO

# ---------------------------------------------------------------------------
# Model configuration
# ---------------------------------------------------------------------------
MODEL_DIR   = Path(__file__).parent.parent / "model"
PT_PATH     = MODEL_DIR / "durian_yolo26m_seg.pt"
ABC_PATH    = MODEL_DIR / "durian_abc.pt"
ONNX_PATH   = MODEL_DIR / "durian_yolo26m_seg.onnx"
TRT_ENGINE  = MODEL_DIR / "durian_yolo26m_seg.engine"
CLASS_NAMES = ["defective", "immature", "mature"]
ABC_CLASS_NAMES = ["A", "B", "C"]


# ---------------------------------------------------------------------------
# YOLO Engine
# ---------------------------------------------------------------------------
class YOLOEngine:
    def __init__(self, model_path: Path, device: str):
        self.model = YOLO(str(model_path))
        self.device = device

    def predict(self, image: Image.Image, conf: float, iou: float):
        results = self.model.predict(image, conf=conf, iou=iou, device=self.device, verbose=False)
        parsed = []
        for r in (results or []):
            if r.boxes is None or len(r.boxes) == 0:
                continue
            polygons = []
            if getattr(r, "masks", None) is not None and getattr(r.masks, "xy", None) is not None:
                polygons = r.masks.xy or []
            for i in range(len(r.boxes)):
                xyxy = r.boxes.xyxy[i].cpu().numpy()
                c = float(r.boxes.conf[i].cpu().numpy())
                cls_id = int(r.boxes.cls[i].cpu().numpy())
                polygon = None
                if i < len(polygons):
                    points = polygons[i]
                    if len(points) > 0:
                        step = max(1, len(points) // 220)
                        polygon = [
                            [float(x), float(y)]
                            for x, y in points[::step]
                        ]
                parsed.append(dict(
                    x1=float(xyxy[0]), y1=float(xyxy[1]),
                    x2=float(xyxy[2]), y2=float(xyxy[3]),
                    confidence=round(c, 4),
                    class_id=cls_id,
                    class_name=CLASS_NAMES[cls_id] if cls_id < len(CLASS_NAMES) else "unknown",
                    polygon=polygon,
                ))
        return parsed


# ---------------------------------------------------------------------------
# TensorRT Engine
# ---------------------------------------------------------------------------
class TRTEngine:
    def __init__(self, model_path: Path, imgsz: int = 640):
        import onnxruntime as ort
        import cv2
        self.cv2 = cv2
        self.imgsz = imgsz
        self.class_names = CLASS_NAMES

        sess_opts = ort.SessionOptions()
        sess_opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        sess_opts.intra_op_num_threads = 4

        providers = [
            ("CUDAExecutionProvider", {
                "device_id": 0,
                "arena_extend_strategy": "kSameAsRequested",
                "cudnn_conv_algo_search": "DEFAULT",
            }),
        ]
        self.session = ort.InferenceSession(str(model_path), sess_opts, providers=providers)
        self.input_name = self.session.get_inputs()[0].name
        self.output_names = [o.name for o in self.session.get_outputs()]
        print("  [TRT] Loaded via ONNX Runtime CUDA provider (GPU)")

    def _preprocess(self, image: Image.Image):
        img = self.cv2.cvtColor(np.array(image), self.cv2.COLOR_RGB2BGR)
        h, w = img.shape[:2]
        scale = self.imgsz / max(h, w)
        new_w, new_h = int(w * scale), int(h * scale)
        resized = self.cv2.resize(img, (new_w, new_h))
        canvas = np.full((self.imgsz, self.imgsz, 3), 114, dtype=np.uint8)
        xo = (self.imgsz - new_w) // 2
        yo = (self.imgsz - new_h) // 2
        canvas[yo:yo + new_h, xo:xo + new_w] = resized
        tensor = canvas.astype(np.float32) / 255.0
        tensor = tensor.transpose(2, 0, 1)[np.newaxis, ...]
        return tensor.astype(np.float32), scale, xo, yo, float(w), float(h)

    def predict(self, image: Image.Image, conf: float, iou: float):
        tensor, scale, xo, yo, orig_w, orig_h = self._preprocess(image)
        outputs = self.session.run(self.output_names, {self.input_name: tensor})
        output = outputs[0]
        if output.shape[1] == 7:
            output = output.transpose(0, 2, 1)
        boxes = []
        for row in output[0]:
            obj_conf = float(row[4])
            if obj_conf < conf:
                continue
            cls_probs = row[5:]
            cls_id = int(np.argmax(cls_probs))
            cls_conf = float(cls_probs[cls_id])
            cx, cy, bw, bh = map(float, row[:4])
            x1 = max(0.0, min(orig_w, cx - bw / 2))
            y1 = max(0.0, min(orig_h, cy - bh / 2))
            x2 = max(0.0, min(orig_w, cx + bw / 2))
            y2 = max(0.0, min(orig_h, cy + bh / 2))
            boxes.append(dict(
                x1=x1, y1=y1, x2=x2, y2=y2,
                confidence=round(cls_conf * obj_conf, 4),
                class_id=cls_id,
                class_name=self.class_names[cls_id] if cls_id < len(self.class_names) else "unknown",
            ))
        return boxes


# ---------------------------------------------------------------------------
# Auto-select engine
# ---------------------------------------------------------------------------
def build_engine() -> tuple:
    has_cuda = torch.cuda.is_available()
    print(f"[INFO] GPU available: {has_cuda}")

    if PT_PATH.exists():
        device = "cuda" if has_cuda else "cpu"
        print(f"[INFO] Loading PyTorch on {device}...")
        return YOLOEngine(PT_PATH, device), "pytorch", device

    if ONNX_PATH.exists():
        device = "cuda" if has_cuda else "cpu"
        print(f"[INFO] Loading ONNX on {device} (CUDA GPU)...")
        return YOLOEngine(ONNX_PATH, device), "onnx", device

    raise FileNotFoundError(
        f"No model found. Checked:\n  - {TRT_ENGINE}\n  - {ONNX_PATH}\n  - {PT_PATH}\n"
        f"Run export_model.py first."
    )


# ---------------------------------------------------------------------------
# Global model instances
# ---------------------------------------------------------------------------
try:
    engine_obj, model_format, device_name = build_engine()
    model_loaded = True
except Exception as e:
    engine_obj, model_format, device_name = None, "none", "unknown"
    model_loaded = False
    print(f"[ERROR] Model not loaded: {e}")

abc_engine_obj = None
if ABC_PATH.exists():
    try:
        abc_device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[INFO] Loading ABC model on {abc_device}...")
        abc_engine_obj = YOLOEngine(ABC_PATH, abc_device)
        print("[INFO] ABC model loaded OK")
    except Exception as e:
        print(f"[ERROR] ABC model not loaded: {e}")


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class BoundingBox(BaseModel):
    x1: float; y1: float; x2: float; y2: float
    confidence: float; class_id: int; class_name: str
    polygon: Optional[List[List[float]]] = None
    track_id: Optional[int] = None
    weight_kg: Optional[float] = None
    weight_unit: Optional[str] = None
    fruit_id: Optional[str] = None
    scale_age_seconds: Optional[float] = None
    scale_stable: Optional[bool] = None
    visual_grade: Optional[str] = None
    weight_grade: Optional[str] = None
    final_grade: Optional[str] = None
    classification_source: Optional[str] = None


class DetectionResponse(BaseModel):
    detections: List[BoundingBox]
    image_width: int; image_height: int
    device: str; model_format: str; detection_count: int
    session_id: Optional[int] = None
    scale: Optional[dict] = None


# Auth schemas
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class EmployeeCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(default="inspector", pattern="^(admin|inspector)$")


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = Field(None, pattern="^(admin|inspector)$")
    is_active: Optional[bool] = None
    password: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: int; username: str; full_name: str; role: str; is_active: bool; created_at: datetime
    class Config:
        from_attributes = True


# Session / Inspection schemas
class SessionCreate(BaseModel):
    employee_id: int
    total_inspected: int = 0
    mature_count: int = 0
    immature_count: int = 0
    defective_count: int = 0
    avg_confidence: float = 0.0
    notes: Optional[str] = None


class SessionResponse(BaseModel):
    id: int; employee_id: int; timestamp: datetime
    total_inspected: int; mature_count: int; immature_count: int
    defective_count: int; avg_confidence: float; device: str; notes: Optional[str]
    employee_name: Optional[str] = None
    class Config:
        from_attributes = True


# KPI schemas
class KPITargetUpdate(BaseModel):
    metric_name: str
    target_value: float
    display_name: Optional[str] = None
    period: Optional[str] = None
    unit: Optional[str] = None


class KPITargetResponse(BaseModel):
    id: int; metric_name: str; display_name: str
    target_value: float; period: str; unit: str
    created_at: datetime; updated_at: datetime
    class Config:
        from_attributes = True


# Report schemas
class SummaryReport(BaseModel):
    total_inspected: int
    mature_count: int
    immature_count: int
    defective_count: int
    quality_rate: float
    avg_confidence: float
    period: str
    start_date: str
    end_date: str
    daily_breakdown: List[dict]


# Shift schemas
class ShiftCreate(BaseModel):
    shift_name: str
    employee_id: int


class ShiftResponse(BaseModel):
    id: int; employee_id: int; shift_name: str; start_time: datetime; end_time: Optional[datetime] = None
    employee_name: Optional[str] = None
    class Config:
        from_attributes = True


# Alarm schemas
class AlarmCreate(BaseModel):
    code: str = Field(..., max_length=20)
    message: str = Field(..., max_length=500)
    severity: str = Field(default="INFO", pattern="^(INFO|WARN|CRITICAL)$")


class AlarmResponse(BaseModel):
    id: int; code: str; message: str; severity: str
    is_active: bool; acknowledged_by: Optional[int]; created_at: datetime
    acknowledged_at: Optional[datetime]
    class Config:
        from_attributes = True


# OEE / Trace schemas
class OeeResponse(BaseModel):
    availability: float
    performance: float
    quality: float
    oee: float
    session_id: Optional[int] = None
    shift_name: Optional[str] = None
    period: str


class TraceQuery(BaseModel):
    id: int; shift_id: Optional[int]; session_id: Optional[int]
    employee_id: Optional[int]; grade: str; confidence: float
    is_rejected: bool; reject_reason: Optional[str]
    camera_timestamp: datetime; batch_id: Optional[str]
    class Config:
        from_attributes = True


# SCADA status schema
class ScadaStatus(BaseModel):
    camera_online: bool
    conveyor_running: bool
    conveyor_speed: float
    active_shift: Optional[ShiftResponse] = None
    active_alarms: int
    total_inspected_today: int
    quality_rate_today: float


# Detection schemas
class SlotDetectionResponse(BaseModel):
    slot_index: int
    detections: List[BoundingBox]
    image_width: int
    image_height: int
    model_format: str
    detection_count: int
    unique_mature: int = 0
    unique_immature: int = 0
    unique_defective: int = 0
    track_ids: List[int] = []
    scale: Optional[dict] = None


class BatchDetectResponse(BaseModel):
    results: List[SlotDetectionResponse]
    total_unique_objects: int
    timestamp: str
    scale: Optional[dict] = None


class CameraConfigRequest(BaseModel):
    cameras: dict[str, str]
