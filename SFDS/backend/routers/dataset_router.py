"""
Dataset Router — Detection, Dataset CRUD (save, list, delete, export).
Mounted into main.py.
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
from services.sorting_controller import (
    dispatch_sorting_commands,
    record_sorting_batch_camera_processed,
)
from core.demo_label_override import (
    apply_demo_label_override,
    clear_demo_track_labels,
    is_demo_enabled,
    mark_demo_slot_empty,
)
from core.inference_scheduler import run_inference
from core.scale_state import attach_scale_to_detections, get_scale_snapshot
from db.repositories import save_detection_event, save_sorting_command
from services.sfds_logger import log_sorting_event
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
    batch_id: str | None = None,
    sorting_commands: list[dict] | None = None,
    scale: dict | None = None,
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
            "batch_id": batch_id,
            "scale": scale or {},
            "sorting_commands": sorting_commands or [],
        },
        camera_slot=slot_index,
        topic="detection/completed",
    )
    if slot_index is None:
        return
    try:
        save_detection_event(
            slot=slot_index,
            detections=detections,
            width=width,
            height=height,
            confidence_threshold=conf,
            batch_id=batch_id,
            scale=scale,
            sorting_commands=sorting_commands,
            source="webcam_detect",
        )
    except Exception as exc:
        log_sorting_event("persist_detection_failed", source="webcam_detect", error=str(exc))


def _persist_sorting_commands(commands: list[dict]) -> None:
    for command in commands:
        try:
            save_sorting_command(command)
        except Exception as exc:
            log_sorting_event(
                "persist_sorting_command_failed",
                source="webcam_detect",
                command_id=command.get("command_id"),
                error=str(exc),
            )


# ---------------------------------------------------------------------------
# Detection endpoint
# ---------------------------------------------------------------------------
@router.post("/detect/", response_model=DetectionResponse)
async def detect_objects(
    file: UploadFile = File(...),
    conf: float = Form(0.25),
    observe_only: bool = Form(False),
    slot_index: int | None = Form(None),
    batch_id: str | None = Form(None),
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
    detections = await run_inference(engine_obj.predict, image, conf=conf, iou=0.45)
    if observe_only:
        if not detections:
            mark_demo_slot_empty(slot_index)
            clear_demo_track_labels(slot_index)
    else:
        detections = apply_demo_label_override(detections, slot=slot_index)
    scale = get_scale_snapshot() if is_demo_enabled() else None
    detections = attach_scale_to_detections(detections, scale)
    sorting_commands: list[dict] = []
    if not observe_only:
        if slot_index is not None:
            record_sorting_batch_camera_processed(
                batch_id,
                camera_slot=slot_index,
                detection_count=len(detections),
                raw_detection_count=len(detections),
                image_width=width,
                image_height=height,
            )
            sorting_commands = dispatch_sorting_commands(
                camera_slot=slot_index,
                detections=detections,
                image_width=width,
                image_height=height,
                source="webcam_detect",
                confidence_threshold=conf,
                batch_id=batch_id,
                scale=scale,
            )
            _persist_sorting_commands(sorting_commands)
        _publish_detection_completed(
            detections,
            width,
            height,
            conf,
            slot_index=slot_index,
            batch_id=batch_id,
            sorting_commands=sorting_commands,
            scale=scale,
        )

    return DetectionResponse(
        detections=[BoundingBox(**d) for d in detections],
        image_width=width,
        image_height=height,
        device=device_name,
        model_format=model_format,
        detection_count=len(detections),
        batch_id=batch_id,
        scale=scale,
        sorting_commands=sorting_commands,
    )


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

    def clamp01(value: float) -> float:
        return max(0.0, min(1.0, value))

    def fmt(value: float) -> str:
        return f"{clamp01(value):.6f}".rstrip("0").rstrip(".")

    def rect_to_segment(x1, y1, x2, y2):
        x1n = x1 / w
        y1n = y1 / h
        x2n = x2 / w
        y2n = y2 / h
        return [x1n, y1n, x2n, y1n, x2n, y2n, x1n, y2n]

    def polygon_to_segment(points):
        segment = []
        for point in points or []:
            if not isinstance(point, (list, tuple)) or len(point) < 2:
                continue
            try:
                segment.extend([float(point[0]) / w, float(point[1]) / h])
            except (TypeError, ValueError):
                continue
        return segment if len(segment) >= 6 else []

    default_segment = rect_to_segment(w * 0.05, h * 0.05, w * 0.95, h * 0.95)

    def make_yolo_label(box_list, default_class_id):
        if not box_list:
            return f"{default_class_id} " + " ".join(fmt(v) for v in default_segment)

        b = box_list[0]
        segment = polygon_to_segment(b.get("polygon"))
        if not segment:
            try:
                segment = rect_to_segment(
                    float(b["x1"]),
                    float(b["y1"]),
                    float(b["x2"]),
                    float(b["y2"]),
                )
            except (KeyError, TypeError, ValueError):
                segment = default_segment
        return f"{default_class_id} " + " ".join(fmt(v) for v in segment)

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
