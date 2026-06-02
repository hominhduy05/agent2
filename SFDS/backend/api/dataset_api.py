"""
Dataset API — FastAPI endpoints cho dataset sầu riêng.

NOTE: These endpoints are now in app_scada.py (port 9000).
This file is kept for backwards compatibility if needed.
"""
import io
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from PIL import Image

from core.auth import get_current_user

from services.dataset_service import (
    get_items,
    get_dataset_stats,
    export_dataset_zip,
    build_data_yaml,
    BASE_DIR,
    IMAGES_DIR,
    LABELS_DIR,
    CLASS_IDS,
    CATEGORY_CLASSES,
    EXPORT_CATEGORIES,
)

router = APIRouter(prefix="/api/dataset", tags=["Dataset"])


def register(app: FastAPI):
    app.include_router(router)


# ── Schemas ────────────────────────────────────────────────────────────────────

class BoundingBoxSchema(BaseModel):
    x1: float; y1: float; x2: float; y2: float
    confidence: float; class_id: int; class_name: str


class DetectionResultSchema(BaseModel):
    detections: list[BoundingBoxSchema]
    image_width: int; image_height: int


# ── YOLOv8 detect endpoint ───────────────────────────────────────────────────

@router.post("/detect/", response_model=DetectionResultSchema)
async def detect_bounding_boxes(
    file: UploadFile = File(...),
    conf: float = Form(0.3),
    current_user=Depends(get_current_user),
):
    """Dùng YOLOv8 model để detect bounding box trái sầu riêng."""
    from core.shared import engine_obj

    if engine_obj is None:
        raise HTTPException(503, "Model chưa được load")

    contents = await file.read()
    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Ảnh không hợp lệ")

    w, h = img.size
    detections = engine_obj.predict(img, conf=conf, iou=0.45)

    return DetectionResultSchema(
        detections=[
            BoundingBoxSchema(
                x1=d["x1"], y1=d["y1"],
                x2=d["x2"], y2=d["y2"],
                confidence=d["confidence"],
                class_id=d["class_id"],
                class_name=d["class_name"],
            )
            for d in detections
        ],
        image_width=w,
        image_height=h,
    )


# ── Save single face (saves to both export_criteria + condition simultaneously) ─

@router.post("/save-face/")
async def save_face(
    face: Literal["front", "left", "right", "back"] = Form(...),
    grade: str = Form(...),
    condition: str = Form(...),
    file: UploadFile = File(...),
    boxes: str = Form("[]"),          # JSON string: [{"x1":0,"y1":0,"x2":100,"y2":100}]
    img_width: int = Form(0),
    img_height: int = Form(0),
    current_user=Depends(get_current_user),
):
    """
    Lưu một ảnh vào CẢ 2 category cùng lúc, ghi YOLO label chuẩn.
      - export_criteria/{grade}/{item_id}_{face}.jpg
      - condition/{condition}/{item_id}_{face}.jpg

    boxes là pixel coords (x1, y1, x2, y2). Convert sang YOLO format:
      x_center = ((x1 + x2) / 2) / img_width
      y_center = ((y1 + y2) / 2) / img_height
      width    = (x2 - x1) / img_width
      height   = (y2 - y1) / img_height
    Nếu boxes rỗng → dùng full-image box (0.5 0.5 0.9 0.9).
    """
    import json as _json

    valid_grades = CATEGORY_CLASSES["export_criteria"]
    valid_conditions = CATEGORY_CLASSES["condition"]

    if grade not in valid_grades:
        raise HTTPException(400, f"Grade '{grade}' không hợp lệ. Chọn: {valid_grades}")
    if condition not in valid_conditions:
        raise HTTPException(400, f"Condition '{condition}' không hợp lệ. Chọn: {valid_conditions}")

    item_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")

    # Use actual image dimensions if not provided
    actual_w, actual_h = img.size
    w = img_width if img_width > 0 else actual_w
    h = img_height if img_height > 0 else actual_h

    # Parse boxes from JSON
    try:
        box_list = _json.loads(boxes) if boxes else []
    except Exception:
        box_list = []

    def pixel_to_yolo(x1, y1, x2, y2):
        """Convert pixel coords → YOLO normalized coords."""
        xc = ((x1 + x2) / 2) / w
        yc = ((y1 + y2) / 2) / h
        bw = (x2 - x1) / w
        bh = (y2 - y1) / h
        return round(xc, 6), round(yc, 6), round(bw, 6), round(bh, 6)

    # Full-image fallback
    default_yolo = "0.5 0.5 0.9 0.9"

    def make_yolo_label(box_list, default_class_id):
        if not box_list:
            return default_yolo
        b = box_list[0]
        xc, yc, bw, bh = pixel_to_yolo(b["x1"], b["y1"], b["x2"], b["y2"])
        return f"{default_class_id} {xc} {yc} {bw} {bh}"

    grade_label  = make_yolo_label(box_list, CLASS_IDS[grade])
    cond_label   = make_yolo_label(box_list, CLASS_IDS[condition])

    # ── Save to export_criteria ───────────────────────────────
    img_dir_grade = IMAGES_DIR / "export_criteria" / grade
    lbl_dir_grade = LABELS_DIR / "export_criteria" / grade
    img_dir_grade.mkdir(parents=True, exist_ok=True)
    lbl_dir_grade.mkdir(parents=True, exist_ok=True)
    img_filename = f"{item_id}_{face}.jpg"
    img_path_grade = img_dir_grade / img_filename
    lbl_path_grade = lbl_dir_grade / f"{item_id}_{face}.txt"
    img.save(img_path_grade, "JPEG", quality=95)
    with open(lbl_path_grade, "w") as f:
        f.write(grade_label + "\n")

    # ── Save to condition ───────────────────────────────────
    img_dir_cond = IMAGES_DIR / "condition" / condition
    lbl_dir_cond = LABELS_DIR / "condition" / condition
    img_dir_cond.mkdir(parents=True, exist_ok=True)
    lbl_dir_cond.mkdir(parents=True, exist_ok=True)
    img_path_cond = img_dir_cond / img_filename
    lbl_path_cond = lbl_dir_cond / f"{item_id}_{face}.txt"
    img.save(img_path_cond, "JPEG", quality=95)
    with open(lbl_path_cond, "w") as f:
        f.write(cond_label + "\n")

    return {
        "ok": True,
        "face": face,
        "item_id": item_id,
        "yolo_grade": grade_label,
        "yolo_condition": cond_label,
        "export_criteria": {"label": grade, "image": str(img_path_grade.relative_to(BASE_DIR))},
        "condition":       {"label": condition, "image": str(img_path_cond.relative_to(BASE_DIR))},
    }


# ── Dataset CRUD ──────────────────────────────────────────────────────────────

@router.get("/items/")
async def list_items(
    category: Literal["export_criteria", "condition"] = Query(...),
    cls: str = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    current_user=Depends(get_current_user),
):
    items = get_items(category=category, cls=cls)
    return {"items": items[offset:offset + limit], "total": len(items)}


@router.get("/stats/")
async def list_stats(current_user=Depends(get_current_user)):
    return get_dataset_stats()


@router.delete("/items/{category}/{label}/{filename}/")
async def remove_item(
    category: str,
    label: str,
    filename: str,
    current_user=Depends(get_current_user),
):
    if category not in EXPORT_CATEGORIES:
        raise HTTPException(400, "Category không hợp lệ")

    valid_classes = CATEGORY_CLASSES.get(category, [])
    if label not in valid_classes:
        raise HTTPException(400, "Label không hợp lệ")

    img_path = IMAGES_DIR / category / label / filename
    lbl_path = LABELS_DIR / category / label / filename.replace(".jpg", ".txt")

    deleted = False
    if img_path.exists():
        img_path.unlink()
        deleted = True
    if lbl_path.exists():
        lbl_path.unlink()

    if not deleted:
        raise HTTPException(404, "File không tìm thấy")

    return {"ok": True}


@router.get("/export/")
async def export_zip(
    category: Literal["export_criteria", "condition"] = Query(...),
    current_user=Depends(get_current_user),
):
    zip_bytes = export_dataset_zip(category)
    filename = f"durian_dataset_{category}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/data-yaml/")
async def get_data_yaml(
    category: Literal["export_criteria", "condition"] = Query(...),
    current_user=Depends(get_current_user),
):
    yaml_str = build_data_yaml(category)
    return {"yaml": yaml_str, "category": category}
