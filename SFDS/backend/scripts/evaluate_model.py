from ultralytics import YOLO
import torch
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "model" / "durian_yolov8.pt"
DATA_YAML  = Path(__file__).parent.parent / "Durian Thesis.v3i.yolov8" / "data.yaml"

CLASS_NAMES = ["defective", "immature", "mature"]


def evaluate():
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Evaluating on: {device}\n")

    model = YOLO(str(MODEL_PATH))

    # Run validation with plots enabled (saves confusion matrix, F1, PR curves)
    metrics = model.val(
        data=str(DATA_YAML),
        device=device,
        plots=True,
        verbose=True,
    )

    print("\n" + "=" * 50)
    print("OVERALL METRICS")
    print("=" * 50)
    print(f"  Precision:       {metrics.box.mp:.4f}")
    print(f"  Recall:          {metrics.box.mr:.4f}")
    print(f"  mAP@0.5:         {metrics.box.map50:.4f}")
    print(f"  mAP@0.5:0.95:    {metrics.box.map:.4f}")

    print("\n" + "=" * 50)
    print("PER-CLASS METRICS")
    print("=" * 50)
    print(f"  {'Class':<12} {'Precision':>10} {'Recall':>10} {'AP@0.5':>10}")
    print(f"  {'-' * 12} {'-' * 10} {'-' * 10} {'-' * 10}")

    for i, name in enumerate(CLASS_NAMES):
        p = float(metrics.box.p[i]) if i < len(metrics.box.p) else 0.0
        r = float(metrics.box.r[i]) if i < len(metrics.box.r) else 0.0
        m = float(metrics.box.ap50[i]) if i < len(metrics.box.ap50) else 0.0
        status = "OK" if m >= 0.70 else "LOW "
        print(f"  {name:<12} {p:>10.4f} {r:>10.4f} {m:>10.4f}  [{status}]")

    print("\n" + "=" * 50)
    print("CONVERSION READINESS CHECK")
    print("=" * 50)
    thresholds = {
        "mAP@0.5":        (metrics.box.map50,  0.80),
        "mAP@0.5:0.95":   (metrics.box.map,   0.70),
        "Precision":      (metrics.box.mp,     0.75),
        "Recall":         (metrics.box.mr,     0.75),
    }
    all_pass = True
    for name, (value, threshold) in thresholds.items():
        passed = value >= threshold
        if not passed:
            all_pass = False
        symbol = "PASS" if passed else "WARN"
        print(f"  {name:<20} {value:.4f}  >= {threshold}  [{symbol}]")

    if all_pass:
        print("\n  Model is READY for conversion.")
    else:
        print("\n  Model has issues - review per-class metrics above before converting.")

    return metrics


if __name__ == "__main__":
    evaluate()
