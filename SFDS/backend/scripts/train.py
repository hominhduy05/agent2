from __future__ import annotations

import argparse
import os
import shutil
import sys
import urllib.request
from pathlib import Path

ULTRALYTICS_CONFIG_DIR = Path(__file__).resolve().parents[2] / "Ultralytics"
ULTRALYTICS_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("YOLO_CONFIG_DIR", str(ULTRALYTICS_CONFIG_DIR))

import torch
import ultralytics
from ultralytics import YOLO
from ultralytics.nn.modules import head as ultralytics_head

from prepare_yolo26_seg_dataset import prepare_dataset


YOLO26M_SEG_URL = "https://github.com/ultralytics/assets/releases/download/v8.4.0/yolo26m-seg.pt"


def _backend_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def _download_model(dest: Path) -> Path:
    if dest.exists():
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading YOLO26m-seg weights to {dest}")
    urllib.request.urlretrieve(YOLO26M_SEG_URL, dest)
    return dest


def _print_environment(device: int | str, batch_size: int, amp_enabled: bool) -> None:
    print(f"Ultralytics version: {ultralytics.__version__}")
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"CUDA version: {torch.version.cuda}")
    print(f"Training device: {device} | batch size: {batch_size} | AMP: {amp_enabled}")


def _resolve_device(requested_device: str) -> tuple[int | str, bool]:
    if requested_device == "cpu":
        return "cpu", False
    if torch.cuda.is_available():
        return 0, True

    message = (
        "CUDA GPU is not available in this Python environment.\n"
        "Your NVIDIA driver may be fine, but PyTorch must be installed with CUDA support.\n"
        "For this conda env, run:\n"
        "  python -m pip install --upgrade ultralytics\n"
        "  python -m pip uninstall -y torch torchvision torchaudio\n"
        "  python -m pip install torch==2.5.1 torchvision==0.20.1 torchaudio==2.5.1 --index-url https://download.pytorch.org/whl/cu124\n"
        "Then verify:\n"
        "  python -c \"import torch; print(torch.__version__); print(torch.cuda.is_available()); print(torch.cuda.get_device_name(0))\"\n"
        "Use --device cpu only if you intentionally want CPU training."
    )
    if requested_device == "auto":
        raise RuntimeError(message)
    raise RuntimeError(message)


def _check_yolo26_support() -> None:
    if hasattr(ultralytics_head, "Segment26"):
        return

    raise RuntimeError(
        "This Python environment has ultralytics "
        f"{ultralytics.__version__}, but YOLO26 segmentation weights require Segment26 support.\n"
        "Update Ultralytics in the same environment, then run this script again:\n"
        "  python -m pip install --upgrade ultralytics\n"
        "If you use conda, activate the training environment first, then run the command above."
    )


def parse_args() -> argparse.Namespace:
    backend_dir = _backend_dir()
    parser = argparse.ArgumentParser(
        description="Train the durian model with YOLO26m-seg and outdoor-oriented augmentations."
    )
    parser.add_argument(
        "--source-data",
        type=Path,
        default=backend_dir / "Durian Thesis.v3i.yolo26",
        help="Original Roboflow dataset root.",
    )
    parser.add_argument(
        "--prepared-data",
        type=Path,
        default=None,
        help="Cleaned segmentation dataset root generated before training.",
    )
    parser.add_argument(
        "--weights",
        type=Path,
        default=backend_dir / "model" / "pretrained" / "yolo26m-seg.pt",
        help="Path to YOLO26m-seg pretrained weights.",
    )
    parser.add_argument("--epochs", type=int, default=None, help="Override preset epochs.")
    parser.add_argument("--imgsz", type=int, default=None, help="Override preset image size.")
    parser.add_argument("--batch", type=int, default=0, help="0 = auto based on CUDA availability.")
    parser.add_argument(
        "--device",
        choices=("auto", "gpu", "cpu"),
        default="auto",
        help="Training device. Default requires CUDA GPU when available; use cpu only intentionally.",
    )
    parser.add_argument(
        "--preset",
        choices=("fast", "balanced", "strong"),
        default="fast",
        help="Training preset. fast is for quick GPU runs, strong keeps the heavier outdoor augmentations.",
    )
    parser.add_argument("--patience", type=int, default=35)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--include-empty", action="store_true", help="Keep empty labels as negative images.")
    parser.add_argument(
        "--label-mode",
        choices=("all", "segments-only"),
        default="all",
        help="all uses bbox labels converted to rectangles; segments-only trains masks only from true polygon labels.",
    )
    parser.add_argument("--skip-prepare", action="store_true", help="Use prepared-data as-is.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    backend_dir = _backend_dir()
    _check_yolo26_support()
    prepared_data = args.prepared_data or (
        backend_dir / (
            "Durian Thesis.v3i.yolo26_prepared_segments_only"
            if args.label_mode == "segments-only"
            else "Durian Thesis.v3i.yolo26_prepared_seg"
        )
    )

    if not args.skip_prepare:
        report = prepare_dataset(
            args.source_data,
            prepared_data,
            include_empty=args.include_empty,
            label_mode=args.label_mode,
        )
        print("Prepared dataset:")
        for split, stats in report["splits"].items():
            print(f"  {split}: kept={stats['kept']} box_labels={stats['box_labels']} skipped_empty={stats['empty_label']} missing={stats['missing_label']} invalid={stats['invalid_label']}")

    data_yaml = prepared_data / "data.yaml"
    if not data_yaml.exists():
        raise FileNotFoundError(f"Prepared data.yaml not found: {data_yaml}")

    weights = _download_model(args.weights)
    device, amp_enabled = _resolve_device(args.device)
    batch_size = args.batch or (8 if device != "cpu" else 2)
    _print_environment(device, batch_size, amp_enabled)

    preset_epochs = {"fast": 60, "balanced": 100, "strong": 150}
    preset_imgsz = {"fast": 640, "balanced": 704, "strong": 768}
    epochs = args.epochs or preset_epochs[args.preset]
    imgsz = args.imgsz or preset_imgsz[args.preset]
    use_strong_aug = args.preset == "strong"
    use_balanced_aug = args.preset == "balanced"

    model = YOLO(str(weights))
    results = model.train(
        data=str(data_yaml),
        task="segment",
        epochs=epochs,
        imgsz=imgsz,
        batch=batch_size,
        device=device,
        project=str(backend_dir / "runs"),
        name="durian_yolo26m_seg",
        exist_ok=True,
        optimizer="AdamW",
        lr0=0.0008,
        lrf=0.01,
        cos_lr=True,
        weight_decay=0.0005,
        warmup_epochs=4,
        patience=args.patience,
        workers=args.workers,
        amp=amp_enabled,
        cache="ram",
        pretrained=True,
        verbose=True,
        multi_scale=use_strong_aug,
        close_mosaic=10 if args.preset == "fast" else 20,
        hsv_h=0.015 if args.preset == "fast" else 0.025,
        hsv_s=0.55 if args.preset == "fast" else 0.75,
        hsv_v=0.35 if args.preset == "fast" else 0.55,
        degrees=8.0 if args.preset == "fast" else (12.0 if use_balanced_aug else 18.0),
        translate=0.10 if args.preset == "fast" else (0.12 if use_balanced_aug else 0.16),
        scale=0.45 if args.preset == "fast" else (0.55 if use_balanced_aug else 0.70),
        shear=2.0 if args.preset == "fast" else (4.0 if use_balanced_aug else 6.0),
        perspective=0.0003 if args.preset == "fast" else (0.0005 if use_balanced_aug else 0.0008),
        flipud=0.0 if args.preset == "fast" else 0.10,
        fliplr=0.50,
        mosaic=0.60 if args.preset == "fast" else 1.0,
        mixup=0.0 if args.preset == "fast" else (0.05 if use_balanced_aug else 0.12),
        copy_paste=0.05 if args.preset == "fast" else (0.15 if use_balanced_aug else 0.25),
        erasing=0.05 if args.preset == "fast" else (0.12 if use_balanced_aug else 0.20),
    )

    best_path = Path(results.save_dir) / "weights" / "best.pt"
    dest = backend_dir / "model" / "durian_yolo26m_seg.pt"
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(best_path, dest)
    print(f"\nBest model saved to: {dest}")

    metrics = model.val(data=str(data_yaml), task="segment", device=device)
    print("\n=== Final Validation Metrics ===")
    if hasattr(metrics, "box"):
        print(f"Box Precision: {metrics.box.mp:.4f}")
        print(f"Box Recall:    {metrics.box.mr:.4f}")
        print(f"Box mAP@0.5:   {metrics.box.map50:.4f}")
        print(f"Box mAP@0.5:0.95: {metrics.box.map:.4f}")
    if hasattr(metrics, "seg"):
        print(f"Mask Precision: {metrics.seg.mp:.4f}")
        print(f"Mask Recall:    {metrics.seg.mr:.4f}")
        print(f"Mask mAP@0.5:   {metrics.seg.map50:.4f}")
        print(f"Mask mAP@0.5:0.95: {metrics.seg.map:.4f}")


if __name__ == "__main__":
    try:
        main()
    except ModuleNotFoundError as exc:
        if exc.name == "ultralytics":
            print("Missing dependency: ultralytics. Run: pip install -r backend/requirements.txt", file=sys.stderr)
        raise
