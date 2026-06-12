#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

CONFIG_FILE="${CONFIG_FILE:-config.pi.json}"
CAMERA_INDEX="${CAMERA_INDEX:-0}"

if [ ! -d ".venv" ]; then
  echo "[WARN] .venv not found. Run ./start.sh first."
  exit 1
fi

# shellcheck source=/dev/null
. .venv/bin/activate

python - "$CONFIG_FILE" "$CAMERA_INDEX" <<'PY'
import json
import sys
from pathlib import Path
from urllib.parse import urljoin

import cv2
import onnxruntime as ort
import requests

config_path = Path(sys.argv[1])
camera_index = int(sys.argv[2])

if not config_path.exists():
    raise SystemExit(f"[ERROR] Missing config: {config_path}")

config = json.loads(config_path.read_text(encoding="utf-8"))
model_path = config_path.parent / config["fruit_crop"]["model_path"]
print(f"[INFO] Config: {config_path}")
print(f"[INFO] Model: {model_path}")
if not model_path.exists():
    raise SystemExit("[ERROR] ONNX model not found")

session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
print(f"[INFO] ONNX input: {session.get_inputs()[0].shape}")
print(f"[INFO] ONNX output: {session.get_outputs()[0].shape}")

base_url = config["pc_server"]["base_url"].rstrip("/") + "/"
health_url = urljoin(base_url, "health/")
try:
    response = requests.get(health_url, timeout=3)
    print(f"[INFO] PC backend health: HTTP {response.status_code}")
except Exception as exc:
    print(f"[WARN] Cannot reach PC backend {health_url}: {exc}")

cap = cv2.VideoCapture(camera_index)
if not cap.isOpened():
    raise SystemExit(f"[ERROR] Cannot open camera index {camera_index}")
ok, frame = cap.read()
cap.release()
if not ok or frame is None:
    raise SystemExit(f"[ERROR] Cannot read camera index {camera_index}")
print(f"[INFO] Camera {camera_index}: OK, frame={frame.shape[1]}x{frame.shape[0]}")
print("[INFO] Health check done.")
PY
