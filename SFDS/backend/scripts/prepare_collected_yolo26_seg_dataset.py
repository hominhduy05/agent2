from __future__ import annotations

import argparse
import json
import random
import shutil
from dataclasses import dataclass
from pathlib import Path

from prepare_yolo26_seg_dataset import IMAGE_EXTENSIONS, _normalize_label


CATEGORY_CLASSES = {
    "export_criteria": ["A", "B", "C", "D"],
    "condition": ["Xanh", "Sượng", "Chín", "Sâu rầy", "Hư"],
}
SPLITS = ("train", "valid", "test")


@dataclass
class CollectedSample:
    image: Path
    label_lines: list[str]
    label_kind: str
    class_name: str
    output_name: str


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def _safe_name(value: str) -> str:
    return (
        value.lower()
        .replace(" ", "_")
        .replace("/", "_")
        .replace("\\", "_")
    )


def _split_samples(
    samples: list[CollectedSample],
    val_ratio: float,
    test_ratio: float,
    seed: int,
) -> dict[str, list[CollectedSample]]:
    shuffled = list(samples)
    random.Random(seed).shuffle(shuffled)

    total = len(shuffled)
    if total == 0:
        return {"train": [], "valid": [], "test": []}
    if total < 5:
        return {"train": shuffled, "valid": shuffled, "test": []}

    test_count = int(round(total * test_ratio)) if total >= 10 else 0
    val_count = int(round(total * val_ratio))
    if total > 1 and val_count == 0:
        val_count = 1
    if val_count + test_count >= total:
        test_count = max(0, total - val_count - 1)

    test = shuffled[:test_count]
    valid = shuffled[test_count:test_count + val_count]
    train = shuffled[test_count + val_count:]
    return {"train": train, "valid": valid, "test": test}


def prepare_collected_dataset(
    source_root: Path,
    output_root: Path,
    category: str = "export_criteria",
    include_empty: bool = False,
    label_mode: str = "all",
    val_ratio: float = 0.15,
    test_ratio: float = 0.10,
    seed: int = 42,
) -> dict:
    if category not in CATEGORY_CLASSES:
        raise ValueError(f"Unsupported category: {category}")

    source_root = source_root.resolve()
    output_root = output_root.resolve()
    classes = CATEGORY_CLASSES[category]
    samples: list[CollectedSample] = []
    skipped: list[dict] = []

    for class_index, class_name in enumerate(classes):
        image_dir = source_root / "images" / category / class_name
        label_dir = source_root / "labels" / category / class_name
        if not image_dir.exists():
            continue

        for image_path in sorted(path for path in image_dir.iterdir() if path.suffix.lower() in IMAGE_EXTENSIONS):
            label_path = label_dir / f"{image_path.stem}.txt"
            if not label_path.exists():
                skipped.append({"image": str(image_path), "reason": "missing_label"})
                continue

            label_lines, label_kind = _normalize_label(label_path)
            if label_kind == "invalid":
                skipped.append({"image": str(image_path), "reason": "invalid_label"})
                continue
            if label_kind == "empty" and not include_empty:
                skipped.append({"image": str(image_path), "reason": "empty_label"})
                continue
            if label_mode == "segments-only" and label_kind == "box":
                skipped.append({"image": str(image_path), "reason": "box_label_not_segmentation"})
                continue

            output_name = f"{class_index}_{_safe_name(class_name)}_{image_path.name}"
            samples.append(
                CollectedSample(
                    image=image_path,
                    label_lines=label_lines,
                    label_kind=label_kind,
                    class_name=class_name,
                    output_name=output_name,
                )
            )

    split_samples = _split_samples(samples, val_ratio, test_ratio, seed)

    if output_root.exists():
        shutil.rmtree(output_root)
    for split in SPLITS:
        (output_root / split / "images").mkdir(parents=True, exist_ok=True)
        (output_root / split / "labels").mkdir(parents=True, exist_ok=True)

    report = {
        "source": str(source_root),
        "output": str(output_root),
        "category": category,
        "include_empty": include_empty,
        "label_mode": label_mode,
        "names": classes,
        "skipped": skipped,
        "splits": {},
    }

    for split, split_items in split_samples.items():
        stats = {"kept": 0, "box_labels": 0, "segment_labels": 0, "empty_label": 0}
        for sample in split_items:
            out_image = output_root / split / "images" / sample.output_name
            out_label = output_root / split / "labels" / f"{Path(sample.output_name).stem}.txt"
            shutil.copy2(sample.image, out_image)
            out_label.write_text(
                "\n".join(sample.label_lines) + ("\n" if sample.label_lines else ""),
                encoding="utf-8",
            )
            stats["kept"] += 1
            if sample.label_kind == "box":
                stats["box_labels"] += 1
            elif sample.label_kind == "segment":
                stats["segment_labels"] += 1
            elif sample.label_kind == "empty":
                stats["empty_label"] += 1
        report["splits"][split] = stats

    yaml_lines = [
        f"path: {output_root.as_posix()}",
        "train: train/images",
        "val: valid/images",
        "test: test/images",
        "",
        f"nc: {len(classes)}",
        f"names: {classes!r}",
        "",
    ]
    (output_root / "data.yaml").write_text("\n".join(yaml_lines), encoding="utf-8")
    (output_root / "label_audit.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return report


def main() -> None:
    backend_dir = _backend_dir()
    parser = argparse.ArgumentParser(
        description="Prepare app-collected dataset for YOLO26 segmentation training."
    )
    parser.add_argument("--source", type=Path, default=backend_dir / "dataset")
    parser.add_argument("--output", type=Path, default=backend_dir / "dataset_yolo26_seg")
    parser.add_argument("--category", choices=tuple(CATEGORY_CLASSES), default="export_criteria")
    parser.add_argument("--include-empty", action="store_true")
    parser.add_argument("--label-mode", choices=("all", "segments-only"), default="all")
    parser.add_argument("--val-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.10)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    report = prepare_collected_dataset(
        args.source,
        args.output / args.category,
        category=args.category,
        include_empty=args.include_empty,
        label_mode=args.label_mode,
        val_ratio=args.val_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
    )
    print(json.dumps({"output": report["output"], "splits": report["splits"]}, ensure_ascii=False, indent=2))
    print(f"Prepared data.yaml: {Path(report['output']) / 'data.yaml'}")
    print(f"Audit report: {Path(report['output']) / 'label_audit.json'}")


if __name__ == "__main__":
    main()
