"""
Dataset Service — lưu ảnh sầu riêng trong cấu trúc YOLO.

Cấu trúc thư mục:
    dataset/
      images/
        export_criteria/
          A/           ← phân loại xuất khẩu A
          B/           ← phân loại xuất khẩu B
          C/           ← phân loại xuất khẩu C
          D/           ← phân loại xuất khẩu D
        condition/
          Xanh/        ← chưa chín
          Sượng/       ← gần chín
          Chín/        ← chín
          Sâu rầy/     ← có sâu rầy
          Hư/          ← hư hỏng
      labels/
        export_criteria/   (mirror cấu trúc images/export_criteria)
        condition/         (mirror cấu trúc images/condition)

Mỗi ảnh lưu trực tiếp trong folder {label}/ không có subfolder item_id.
"""
import io
import json
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Literal

from PIL import Image

# ── Base paths ────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).parent.parent / "dataset"
IMAGES_DIR = BASE_DIR / "images"
LABELS_DIR = BASE_DIR / "labels"

# ── Categories ──────────────────────────────────────────────────────────
EXPORT_CATEGORIES  = ["export_criteria", "condition"]
EXPORT_CLASSES     = ["A", "B", "C", "D"]
CONDITION_CLASSES  = ["Xanh", "Sượng", "Chín", "Sâu rầy", "Hư"]

# Map category → list of valid classes
CATEGORY_CLASSES = {
    "export_criteria": EXPORT_CLASSES,
    "condition":       CONDITION_CLASSES,
}

# Map class name → YOLO class ID
CLASS_IDS = {
    "A": 0, "B": 1, "C": 2, "D": 3,
    "Xanh": 0, "Sượng": 1, "Chín": 2, "Sâu rầy": 3, "Hư": 4,
}

FACE_NAMES = ["front", "left", "right", "back"]


def _ensure_dirs():
    """Tạo toàn bộ thư mục cần thiết."""
    for cat in EXPORT_CATEGORIES:
        classes = CATEGORY_CLASSES[cat]
        for cls in classes:
            (IMAGES_DIR / cat / cls).mkdir(parents=True, exist_ok=True)
            (LABELS_DIR / cat / cls).mkdir(parents=True, exist_ok=True)


def _generate_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S_%f")


def _save_image(file_bytes: bytes, dest: Path) -> tuple[int, int]:
    """Lưu ảnh, trả về (width, height)."""
    img = Image.open(io.BytesIO(file_bytes)).convert("RGB")
    img.save(dest, "JPEG", quality=95)
    return img.size


def _write_yolo_label(
    dest: Path,
    class_id: int,
    x_center: float = 0.5,
    y_center: float = 0.5,
    width: float = 0.9,
    height: float = 0.9,
    polygon: list[list[float]] | None = None,
):
    """Write a YOLO segmentation label: class_id x1 y1 x2 y2 ..."""
    if polygon and len(polygon) >= 3:
        coords = []
        for point in polygon:
            if len(point) < 2:
                continue
            coords.extend([float(point[0]), float(point[1])])
    else:
        x1 = x_center - width / 2
        y1 = y_center - height / 2
        x2 = x_center + width / 2
        y2 = y_center + height / 2
        coords = [x1, y1, x2, y1, x2, y2, x1, y2]

    coords = [min(1.0, max(0.0, value)) for value in coords]
    dest.parent.mkdir(parents=True, exist_ok=True)
    with open(dest, "w") as f:
        f.write(f"{class_id} {' '.join(f'{value:.6f}' for value in coords)}\n")


def _read_yolo_label(src: Path) -> list[dict]:
    """Đọc file label YOLO, trả về list of boxes."""
    if not src.exists():
        return []
    boxes = []
    with open(src) as f:
        for line in f:
            parts = line.strip().split()
            if len(parts) < 5:
                continue
            class_id = int(parts[0])
            values = [float(part) for part in parts[1:]]
            if len(parts) == 5:
                boxes.append({
                    "class_id":   class_id,
                    "x_center":   values[0],
                    "y_center":   values[1],
                    "width":      values[2],
                    "height":     values[3],
                })
                continue
            if len(values) >= 6 and len(values) % 2 == 0:
                xs = values[0::2]
                ys = values[1::2]
                boxes.append({
                    "class_id": class_id,
                    "polygon": [[xs[i], ys[i]] for i in range(len(xs))],
                    "x_center": (min(xs) + max(xs)) / 2,
                    "y_center": (min(ys) + max(ys)) / 2,
                    "width": max(xs) - min(xs),
                    "height": max(ys) - min(ys),
                })
    return boxes


# ── Public API ───────────────────────────────────────────────────────────

def save_item(
    category: Literal["export_criteria", "condition"],
    cls: str,                          # "A","B","C" hoặc "mature","immature","defective"
    front_img: bytes,
    left_img: bytes,
    right_img: bytes,
    back_img: bytes,
    boxes: dict[str, list[dict]] | None = None,
    # boxes = {"front": [{"class_id":0,"x_center":...}], "left": [...], ...}
    # Nếu None → dùng full-image box (class mặc định)
    default_class_id: int = 0,
) -> dict:
    """
    Lưu 1 item: 4 ảnh + 4 label theo cấu trúc YOLO.

    Args:
        category:  "export_criteria" | "condition"
        cls:       class name trong category đó
        front_img/left_img/right_img/back_img: JPEG bytes
        boxes:     dict từ API client, chứa box coords cho mỗi face
                   {"front": [...], "left": [...], ...}
                   Mỗi box = {class_id, x_center, y_center, width, height}
                   Nếu None → dùng full-image box với default_class_id
        default_class_id: class_id mặc định nếu không truyền boxes
    """
    _ensure_dirs()

    valid_classes = CATEGORY_CLASSES.get(category, [])
    if cls not in valid_classes:
        raise ValueError(f"'{cls}' không hợp lệ cho category '{category}'. "
                         f"Chọn một trong: {valid_classes}")

    item_id = _generate_id()
    img_cat_dir = IMAGES_DIR / category / cls / item_id
    lbl_cat_dir = LABELS_DIR / category / cls / item_id
    img_cat_dir.mkdir(parents=True, exist_ok=True)
    lbl_cat_dir.mkdir(parents=True, exist_ok=True)

    face_map = {
        "front": front_img,
        "left":  left_img,
        "right": right_img,
        "back":  back_img,
    }

    # boxes mặc định: full-image cho tất cả face
    if boxes is None:
        boxes = {face: [{"class_id": default_class_id,
                         "x_center": 0.5, "y_center": 0.5,
                         "width": 0.9, "height": 0.9}]
                 for face in FACE_NAMES}

    faces_saved = []
    for face, img_bytes in face_map.items():
        img_dest = img_cat_dir / f"{face}.jpg"
        lbl_dest = lbl_cat_dir / f"{face}.txt"

        iw, ih = _save_image(img_bytes, img_dest)

        face_boxes = boxes.get(face, [])
        # Ghi box đầu tiên (mỗi ảnh 1 object)
        if face_boxes:
            b = face_boxes[0]
            _write_yolo_label(
                lbl_dest,
                class_id   = b.get("class_id", default_class_id),
                x_center   = b.get("x_center", 0.5),
                y_center   = b.get("y_center", 0.5),
                width      = b.get("width", 0.9),
                height     = b.get("height", 0.9),
                polygon    = b.get("polygon"),
            )
        else:
            _write_yolo_label(lbl_dest, default_class_id)

        faces_saved.append({
            "face":       face,
            "image":      str(img_dest.relative_to(BASE_DIR)),
            "label":      str(lbl_dest.relative_to(BASE_DIR)),
        })

    return {
        "item_id":   item_id,
        "category":  category,
        "cls":       cls,
        "faces":     faces_saved,
        "count":     4,
    }


def get_items(
    category: str | None = None,
    cls: str | None = None,
) -> list[dict]:
    """
    Liệt kê items. Lọc theo category/cls nếu có.
    Mỗi file {item_id}_{face}.jpg = 1 item.
    Trả về list metadata (không đọc ảnh).
    """
    _ensure_dirs()
    items = []

    cats = [category] if category else EXPORT_CATEGORIES
    for cat in cats:
        classes = CATEGORY_CLASSES.get(cat, [])
        for c in classes:
            if cls and c != cls:
                continue
            img_dir = IMAGES_DIR / cat / c
            if not img_dir.exists():
                continue

            # Group files by item_id prefix: {item_id}_{face}.jpg
            item_map: dict[str, dict[str, str | None]] = {}
            for img_file in img_dir.glob("*.jpg"):
                # filename format: {item_id}_{face}.jpg
                name = img_file.stem  # e.g. "20260526_162543_951120_back"
                last_underscore_idx = name.rfind("_")
                if last_underscore_idx == -1:
                    continue
                item_id = name[:last_underscore_idx]  # e.g. "20260526_162543_951120"
                face = name[last_underscore_idx + 1:]  # e.g. "back"

                if item_id not in item_map:
                    item_map[item_id] = {face: str(img_file.relative_to(BASE_DIR))}
                else:
                    item_map[item_id][face] = str(img_file.relative_to(BASE_DIR))

            for item_id, face_imgs in item_map.items():
                faces = []
                for face in FACE_NAMES:
                    img_path_str = face_imgs.get(face)
                    lbl_path = LABELS_DIR / cat / c / f"{item_id}_{face}.txt"
                    boxes = []
                    if lbl_path.exists():
                        boxes = _read_yolo_label(lbl_path)
                    faces.append({
                        "face":   face,
                        "image":  img_path_str,
                        "boxes":  boxes,
                    })

                items.append({
                    "item_id":  item_id,
                    "category": cat,
                    "cls":      c,
                    "faces":    faces,
                })

    return sorted(items, key=lambda x: x["item_id"], reverse=True)


def delete_item(category: str, cls: str, item_id: str) -> bool:
    """Xóa tất cả ảnh + label của 1 item (4 face)."""
    deleted = False
    for face in FACE_NAMES:
        img_path = IMAGES_DIR / category / cls / f"{item_id}_{face}.jpg"
        lbl_path = LABELS_DIR / category / cls / f"{item_id}_{face}.txt"
        if img_path.exists():
            img_path.unlink()
            deleted = True
        if lbl_path.exists():
            lbl_path.unlink()
    return deleted


def get_dataset_stats() -> dict:
    """Thống kê số lượng ảnh theo category/label."""
    _ensure_dirs()
    stats = {}
    for cat in EXPORT_CATEGORIES:
        stats[cat] = {}
        for c in CATEGORY_CLASSES[cat]:
            count = len(list((IMAGES_DIR / cat / c).glob("*.jpg")))
            stats[cat][c] = count
    return stats


def export_dataset_zip(
    category: str | None = None,
    format: Literal["yolo", "flat"] = "yolo",
) -> io.BytesIO:
    """
    Export dataset thành ZIP.
    Giờ mỗi ảnh lưu trực tiếp trong folder {label}/ không có subfolder item_id.
    """
    _ensure_dirs()
    buf = io.BytesIO()

    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        cats = [category] if category else EXPORT_CATEGORIES
        for cat in cats:
            for cls in CATEGORY_CLASSES[cat]:
                img_dir = IMAGES_DIR / cat / cls
                if not img_dir.exists():
                    continue
                for img_file in sorted(img_dir.glob("*.jpg")):
                    # image: dataset/images/{cat}/{cls}/{filename}.jpg
                    arc_img = f"images/{cat}/{cls}/{img_file.name}"
                    zf.write(img_file, arc_img)

                    # label: dataset/labels/{cat}/{cls}/{filename}.txt
                    lbl_file = (LABELS_DIR / cat / cls / img_file.stem).with_suffix(".txt")
                    if lbl_file.exists():
                        arc_lbl = f"labels/{cat}/{cls}/{lbl_file.name}"
                        zf.write(lbl_file, arc_lbl)
    buf.seek(0)
    return buf


def build_data_yaml(
    category: Literal["export_criteria", "condition"],
    dest: Path | None = None,
) -> str:
    """
    Tạo data.yaml cho YOLO training.
    category="export_criteria" → classes: A, B, C, D
    category="condition"        → classes: Xanh, Sượng, Chín, Sâu rầy, Hư
    """
    classes = CATEGORY_CLASSES[category]
    paths = {
        "train":  str(IMAGES_DIR / category),
        "val":    str(IMAGES_DIR / category),
    }

    yaml_content = {
        "path": str(IMAGES_DIR / category),
        "train": ".",
        "val":   ".",
        "names": {i: name for i, name in enumerate(classes)},
    }

    yaml_str = (
        f"# YOLO data.yaml — category: {category}\n"
        f"path: {yaml_content['path']}\n"
        f"train: .\n"
        f"val: .\n"
        f"names:\n"
    )
    for i, name in enumerate(classes):
        yaml_str += f"  {i}: {name}\n"

    if dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "w", encoding="utf-8") as f:
            f.write(yaml_str)

    return yaml_str
