from ultralytics import YOLO
import torch
from pathlib import Path

MODEL_PATH = Path(__file__).parent.parent / "model" / "durian_yolo26m_seg.pt"
OUT_DIR    = MODEL_PATH.parent


def export_onnx():
    print("Exporting ONNX...")
    model = YOLO(str(MODEL_PATH))
    onnx_path = model.export(
        format="onnx",
        imgsz=640,
        simplify=True,
        opset=12,
    )
    dest = OUT_DIR / "durian_yolo26m_seg.onnx"
    Path(onnx_path).rename(dest)
    print(f"ONNX saved: {dest}")
    return str(dest)


def export_torchscript():
    print("Exporting TorchScript...")
    model = YOLO(str(MODEL_PATH))
    ts_path = model.export(
        format="torchscript",
        imgsz=640,
    )
    dest = OUT_DIR / "durian_yolo26m_seg.torchscript"
    Path(ts_path).rename(dest)
    print(f"TorchScript saved: {dest}")
    return str(dest)


def export_tensorrt():
    print("Exporting TensorRT...")
    import tensorrt as trt

    TRT_PATH = OUT_DIR / "durian_yolo26m_seg.engine"
    onnx_file = OUT_DIR / "durian_yolo26m_seg.onnx"
    if not onnx_file.exists():
        print("ONNX not found, exporting first...")
        export_onnx()

    logger = trt.Logger(trt.Logger.WARNING)
    builder = trt.Builder(logger)
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, logger)

    with open(onnx_file, "rb") as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                print(f"ONNX parse error {i}: {parser.get_error(i)}")
            raise RuntimeError("Failed to parse ONNX file")

    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 1 << 30)
    config.set_flag(trt.BuilderFlag.FP16)

    engine_bytes = builder.build_serialized_network(network, config)
    with open(TRT_PATH, "wb") as f:
        f.write(engine_bytes)

    print(f"TensorRT engine saved: {TRT_PATH}  ({TRT_PATH.stat().st_size / 1024 / 1024:.1f} MB)")
    return str(TRT_PATH)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["onnx", "torchscript", "tensorrt", "all"], default="all")
    args = parser.parse_args()

    results = {}
    if args.format in ("onnx", "all"):
        results["onnx"] = export_onnx()
    if args.format in ("torchscript", "all"):
        results["torchscript"] = export_torchscript()
    if args.format in ("tensorrt", "all"):
        results["tensorrt"] = export_tensorrt()

    print("\nDone:", results)
