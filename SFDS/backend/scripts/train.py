from ultralytics import YOLO
import torch

def main():
    # Check GPU
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"CUDA version: {torch.version.cuda}")

    # Auto-detect device: GPU if available, else CPU
    device = 0 if torch.cuda.is_available() else "cpu"
    batch_size = 16 if torch.cuda.is_available() else 4
    amp_enabled = torch.cuda.is_available()
    print(f"Training device: {device}  |  batch size: {batch_size}  |  AMP: {amp_enabled}")

    # Load pretrained YOLOv8s model
    model = YOLO("yolov8s.pt")

    # Training config
    results = model.train(
        data=r"c:\durian\Durian Thesis.v3i.yolov8\data.yaml",
        epochs=100,
        imgsz=640,
        batch=batch_size,
        device=device,
        project=r"c:\durian\backend",
        name="runs",
        exist_ok=True,
        optimizer="AdamW",
        lr0=0.001,
        patience=20,
        mosaic=1.0,
        mixup=0.1,
        amp=amp_enabled,
        pretrained=True,
        verbose=True,
    )

    # Save best model explicitly
    best_path = results.save_dir / "weights" / "best.pt"
    import shutil
    dest = r"c:\durian\backend\model\durian_yolov8.pt"
    shutil.copy(best_path, dest)
    print(f"\nModel saved to: {dest}")

    # Print final metrics
    metrics = model.val()
    print("\n=== Final Validation Metrics ===")
    print(f"Precision: {metrics.box.mp:.4f}")
    print(f"Recall:    {metrics.box.mr:.4f}")
    print(f"mAP@0.5:   {metrics.box.map50:.4f}")
    print(f"mAP@0.5:0.95: {metrics.box.map:.4f}")

if __name__ == "__main__":
    main()
