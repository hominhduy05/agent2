from __future__ import annotations

import argparse
import ast
import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
SPLITS = ("train", "valid", "test")


@dataclass
class SplitStats:
    images: int = 0
    kept: int = 0
    missing_label: int = 0
    empty_label: int = 0
    invalid_label: int = 0
    box_labels: int = 0
    segment_labels: int = 0


def _repo_backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def _parse_data_yaml(data_yaml: Path) -> tuple[int, list[str]]:
    nc = None
    names = None

    for raw_line in data_yaml.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("nc:"):
            nc = int(line.split(":", 1)[1].strip())
        elif line.startswith("names:"):
            names = ast.literal_eval(line.split(":", 1)[1].strip())

    if nc is None or names is None:
        raise ValueError(f"Cannot read nc/names from {data_yaml}")
    if nc != len(names):
        raise ValueError(f"data.yaml nc={nc}, but names has {len(names)} items")
    return nc, names


def _fs_path(path: Path) -> str:
    resolved = str(path.resolve())
    if os.name == "nt" and not resolved.startswith("\\\\?\\"):
        return "\\\\?\\" + resolved
    return resolved


def _path_exists(path: Path) -> bool:
    return os.path.exists(_fs_path(path))


def _read_text(path: Path) -> str:
    with open(_fs_path(path), "r", encoding="utf-8") as file:
        return file.read()


def _format_num(value: float) -> str:
    value = min(1.0, max(0.0, value))
    return f"{value:.6f}".rstrip("0").rstrip(".")


def _box_to_rect_segment(parts: list[str]) -> list[str]:
    cls, x, y, w, h = parts
    x = float(x)
    y = float(y)
    w = float(w)
    h = float(h)
    x1 = x - w / 2
    y1 = y - h / 2
    x2 = x + w / 2
    y2 = y + h / 2
    return [cls, *(_format_num(v) for v in (x1, y1, x2, y1, x2, y2, x1, y2))]


def _normalize_label(label_path: Path) -> tuple[list[str], str]:
    lines: list[str] = []
    label_kind = "empty"

    for raw_line in _read_text(label_path).splitlines():
        line = raw_line.strip()
        if not line:
            continue

        parts = line.split()
        if len(parts) == 5:
            lines.append(" ".join(_box_to_rect_segment(parts)))
            label_kind = "box"
        elif len(parts) >= 7 and len(parts[1:]) % 2 == 0:
            # Already YOLO segmentation format: class + x1 y1 x2 y2 ...
            lines.append(" ".join(parts))
            if label_kind != "box":
                label_kind = "segment"
        else:
            return [], "invalid"

    return lines, label_kind


def _link_or_copy(src: Path, dest: Path) -> None:
    if _path_exists(dest):
        return
    try:
        os.link(_fs_path(src), _fs_path(dest))
    except OSError:
        shutil.copy2(_fs_path(src), _fs_path(dest))


def prepare_dataset(
    source_root: Path,
    output_root: Path,
    include_empty: bool = False,
    label_mode: str = "all",
) -> dict:
    source_root = source_root.resolve()
    output_root = output_root.resolve()
    data_yaml = source_root / "data.yaml"
    nc, names = _parse_data_yaml(data_yaml)

    output_root.mkdir(parents=True, exist_ok=True)
    report: dict = {
        "source": str(source_root),
        "output": str(output_root),
        "note": (
            "BBox labels were converted to rectangular YOLO segmentation polygons. "
            "Images with missing, empty, or invalid labels were excluded unless include_empty is true."
        ),
        "include_empty": include_empty,
        "label_mode": label_mode,
        "nc": nc,
        "names": names,
        "splits": {},
        "skipped": {split: [] for split in SPLITS},
    }

    for split in SPLITS:
        stats = SplitStats()
        source_img_dir = source_root / split / "images"
        source_lbl_dir = source_root / split / "labels"
        output_img_dir = output_root / split / "images"
        output_lbl_dir = output_root / split / "labels"
        output_img_dir.mkdir(parents=True, exist_ok=True)
        output_lbl_dir.mkdir(parents=True, exist_ok=True)

        images = sorted(path for path in source_img_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS)
        stats.images = len(images)

        for image_path in images:
            label_path = source_lbl_dir / f"{image_path.stem}.txt"
            if not _path_exists(label_path):
                stats.missing_label += 1
                report["skipped"][split].append({"image": image_path.name, "reason": "missing_label"})
                continue

            label_lines, label_kind = _normalize_label(label_path)
            if label_kind == "invalid":
                stats.invalid_label += 1
                report["skipped"][split].append({"image": image_path.name, "reason": "invalid_label"})
                continue
            if label_kind == "empty" and not include_empty:
                stats.empty_label += 1
                report["skipped"][split].append({"image": image_path.name, "reason": "empty_label"})
                continue
            if label_mode == "segments-only" and label_kind == "box":
                stats.box_labels += 1
                report["skipped"][split].append({"image": image_path.name, "reason": "box_label_not_segmentation"})
                continue
            if label_kind == "box":
                stats.box_labels += 1
            elif label_kind == "segment":
                stats.segment_labels += 1
            elif label_kind == "empty":
                stats.empty_label += 1

            output_image_path = output_img_dir / image_path.name
            output_label_path = output_lbl_dir / f"{image_path.stem}.txt"
            _link_or_copy(image_path, output_image_path)
            output_label_path.write_text("\n".join(label_lines) + ("\n" if label_lines else ""), encoding="utf-8")
            stats.kept += 1

        report["splits"][split] = stats.__dict__

    yaml_lines = [
        f"path: {output_root.as_posix()}",
        "train: train/images",
        "val: valid/images",
        "test: test/images",
        "",
        f"nc: {nc}",
        f"names: {names!r}",
        "",
    ]
    (output_root / "data.yaml").write_text("\n".join(yaml_lines), encoding="utf-8")
    (output_root / "label_audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return report


def main() -> None:
    backend_dir = _repo_backend_dir()
    parser = argparse.ArgumentParser(
        description="Prepare a clean YOLO segmentation dataset for YOLO26 training."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=backend_dir / "Durian Thesis.v3i.yolo26",
        help="Source Roboflow YOLO dataset root.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=backend_dir / "Durian Thesis.v3i.yolo26_prepared_seg",
        help="Output dataset root.",
    )
    parser.add_argument(
        "--include-empty",
        action="store_true",
        help="Keep empty labels as negative samples. Default excludes them.",
    )
    parser.add_argument(
        "--label-mode",
        choices=("all", "segments-only"),
        default="all",
        help="all converts bbox labels to rectangular polygons; segments-only keeps only true polygon labels.",
    )
    args = parser.parse_args()

    report = prepare_dataset(
        args.source,
        args.output,
        include_empty=args.include_empty,
        label_mode=args.label_mode,
    )
    print(json.dumps({"output": report["output"], "splits": report["splits"]}, ensure_ascii=False, indent=2))
    print(f"Prepared data.yaml: {Path(report['output']) / 'data.yaml'}")
    print(f"Audit report: {Path(report['output']) / 'label_audit.json'}")


if __name__ == "__main__":
    main()
