"""
Dataset Router — Detection, Dataset CRUD (save, list, delete, export).
Mounted into app_scada.py.
"""
import io
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

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
from services.mqtt_publisher import publish_enterprise_event
from core.demo_label_override import is_demo_enabled
from core.pi_feed import update_pi_feed
from core.scale_state import attach_scale_to_detections, get_scale_snapshot
from core.shared import (
    engine_obj, model_loaded, model_format, device_name,
    BoundingBox, DetectionResponse,
)

router = APIRouter(prefix="", tags=["Dataset"])


def _publish_detection_completed(
    detections: list[dict],
    width: int,
    height: int,
    conf: float,
    *,
    slot_index: int | None = None,
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
            "image": {"width": width, "height": height},
            "model": {"format": model_format, "device": device_name},
            "confidence_threshold": conf,
        },
        camera_slot=slot_index,
        topic="detection/completed",
    )


# ---------------------------------------------------------------------------
# Detection endpoint
# ---------------------------------------------------------------------------
@router.post("/detect/", response_model=DetectionResponse)
async def detect_objects(
    file: UploadFile = File(...),
    conf: float = Form(0.25),
):
    if not model_loaded or engine_obj is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    if not (0 < conf <= 1):
        raise HTTPException(status_code=400, detail="conf must be between 0 and 1")

    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    width, height = image.size
    detections = engine_obj.predict(image, conf=conf, iou=0.45)
    scale = get_scale_snapshot() if is_demo_enabled() else None
    detections = attach_scale_to_detections(detections, scale)
    _publish_detection_completed(detections, width, height, conf)

    return DetectionResponse(
        detections=[BoundingBox(**d) for d in detections],
        image_width=width,
        image_height=height,
        device=device_name,
        model_format=model_format,
        detection_count=len(detections),
        scale=scale,
    )


@router.post("/api/detect/batch/")
async def batch_detect_objects(
    slot_index: int = Form(0),
    file: UploadFile = File(...),
    conf: float = Form(0.25),
    pi_id: str = Form("pi4"),
    feed_slot: int | None = Form(None),
):
    if not model_loaded or engine_obj is None:
        raise HTTPException(status_code=503, detail="Model not loaded.")
    if not (0 <= slot_index <= 3):
        raise HTTPException(status_code=400, detail="slot_index must be 0-3")

    contents = await file.read()
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image file")

    width, height = image.size
    detections = engine_obj.predict(image, conf=conf, iou=0.45)
    scale = get_scale_snapshot() if is_demo_enabled() else None
    detections = attach_scale_to_detections(detections, scale)
    _publish_detection_completed(detections, width, height, conf, slot_index=slot_index)
    update_pi_feed(
        pi_id=pi_id,
        source_camera_id=slot_index,
        feed_slot=feed_slot,
        image_bytes=contents,
        image_width=width,
        image_height=height,
        detections=detections,
        conf=conf,
        model_format=model_format,
    )

    CLASS_NAME_TO_ID = {"defective": 0, "immature": 1, "mature": 2, "none": 3}
    unique_mature   = sum(1 for d in detections if d["class_name"] == "mature")
    unique_immature = sum(1 for d in detections if d["class_name"] == "immature")
    unique_defective = sum(1 for d in detections if d["class_name"] == "defective")

    return {
        "results": [{
            "slot_index": slot_index,
            "detections": [
                {
                    "x1": d["x1"], "y1": d["y1"],
                    "x2": d["x2"], "y2": d["y2"],
                    "confidence": d["confidence"],
                    "class_id": CLASS_NAME_TO_ID.get(d["class_name"], 3),
                    "class_name": d["class_name"],
                }
                for d in detections
            ],
            "image_width": width,
            "image_height": height,
            "model_format": model_format,
            "detection_count": len(detections),
            "unique_mature": unique_mature,
            "unique_immature": unique_immature,
            "unique_defective": unique_defective,
            "track_ids": [],
            "scale": scale,
        }],
        "total_unique_objects": len(detections),
        "timestamp": datetime.utcnow().isoformat(),
        "scale": scale,
    }


# ---------------------------------------------------------------------------
# Dataset CRUD
# ---------------------------------------------------------------------------
@router.post("/api/dataset/save-face/")
async def save_face(
    face: str = Form(...),
    grade: str = Form(...),
    condition: str = Form(...),
    file: UploadFile = File(...),
    boxes: str = Form("[]"),
    img_width: int = Form(0),
    img_height: int = Form(0),
):
    valid_grades = CATEGORY_CLASSES["export_criteria"]
    valid_conditions = CATEGORY_CLASSES["condition"]

    if grade not in valid_grades:
        raise HTTPException(400, f"Grade '{grade}' khong hop le. Chon: {valid_grades}")
    if condition not in valid_conditions:
        raise HTTPException(400, f"Condition '{condition}' khong hop le. Chon: {valid_conditions}")

    item_id = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")

    actual_w, actual_h = img.size
    w = img_width if img_width > 0 else actual_w
    h = img_height if img_height > 0 else actual_h

    try:
        box_list = json.loads(boxes) if boxes else []
    except Exception:
        box_list = []

    def pixel_to_yolo(x1, y1, x2, y2):
        xc = ((x1 + x2) / 2) / w
        yc = ((y1 + y2) / 2) / h
        bw = (x2 - x1) / w
        bh = (y2 - y1) / h
        return round(xc, 6), round(yc, 6), round(bw, 6), round(bh, 6)

    default_yolo = "0.5 0.5 0.9 0.9"

    def make_yolo_label(box_list, default_class_id):
        if not box_list:
            return default_yolo
        b = box_list[0]
        xc, yc, bw, bh = pixel_to_yolo(b["x1"], b["y1"], b["x2"], b["y2"])
        return f"{default_class_id} {xc} {yc} {bw} {bh}"

    grade_label = make_yolo_label(box_list, CLASS_IDS[grade])
    cond_label  = make_yolo_label(box_list, CLASS_IDS[condition])

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


@router.get("/api/dataset/items/")
async def list_items(
    category: str = Query(...),
    cls: str = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    items = get_items(category=category, cls=cls)
    return {"items": items[offset:offset + limit], "total": len(items)}


@router.get("/api/dataset/stats/")
async def list_stats():
    return get_dataset_stats()


@router.delete("/api/dataset/items/{category}/{label}/{filename}/")
async def remove_item(
    category: str,
    label: str,
    filename: str,
):
    if category not in EXPORT_CATEGORIES:
        raise HTTPException(400, "Category khong hop le")
    valid_classes = CATEGORY_CLASSES.get(category, [])
    if label not in valid_classes:
        raise HTTPException(400, "Label khong hop le")

    img_path = IMAGES_DIR / category / label / filename
    lbl_path = LABELS_DIR / category / label / filename.replace(".jpg", ".txt")

    deleted = False
    if img_path.exists():
        img_path.unlink()
        deleted = True
    if lbl_path.exists():
        lbl_path.unlink()

    if not deleted:
        raise HTTPException(404, "File khong tim thay")

    return {"ok": True}


@router.get("/api/dataset/export/")
async def export_zip(
    category: str = Query(...),
):
    zip_bytes = export_dataset_zip(category)
    filename = f"durian_dataset_{category}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    return StreamingResponse(
        zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/dataset/data-yaml/")
async def get_data_yaml(
    category: str = Query(...),
):
    yaml_str = build_data_yaml(category)
    return {"yaml": yaml_str, "category": category}
