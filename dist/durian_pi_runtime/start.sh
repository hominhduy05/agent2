#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$APP_DIR"

CONFIG_FILE="${CONFIG_FILE:-config.pi.json}"
DEFAULT_PC_IP="__CHANGE_ME_PC_IP__"
PREVIEW_MODE="${PREVIEW:-}"
CREATED_CONFIG="false"

info() {
  printf '[INFO] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

fail() {
  printf '[ERROR] %s\n' "$1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --preview)
      PREVIEW_MODE="true"
      shift
      ;;
    --no-preview)
      PREVIEW_MODE="false"
      shift
      ;;
    --config)
      CONFIG_FILE="$2"
      shift 2
      ;;
    -h|--help)
      cat <<'EOF'
Usage: ./start.sh [--preview] [--no-preview] [--config config.pi.json]

--preview     Show camera windows for angle adjustment.
--no-preview  Run headless.
--config      Use another config file.
EOF
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      ;;
  esac
done

command -v python3 >/dev/null 2>&1 || fail "python3 not found. Install it with: sudo apt install -y python3 python3-venv"

if ! python3 - <<'PY' >/dev/null 2>&1
import cv2
PY
then
  warn "System OpenCV is missing. Installing python3-opencv for camera/preview support."
  sudo apt update
  sudo apt install -y python3-opencv
fi

if [ ! -f "$CONFIG_FILE" ]; then
  info "Creating $CONFIG_FILE from config.example.json"
  cp config.example.json "$CONFIG_FILE"
  CREATED_CONFIG="true"
fi

if [ -t 0 ] && grep -q "$DEFAULT_PC_IP" "$CONFIG_FILE"; then
  printf 'Nhap IP may PC dang chay backend port 9000 (vi du 192.168.1.50): '
  read -r PC_IP
  if [ -n "${PC_IP:-}" ]; then
    python3 - "$CONFIG_FILE" "$PC_IP" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
pc_ip = sys.argv[2].strip()
data = json.loads(config_path.read_text(encoding="utf-8"))
data.setdefault("pc_server", {})["base_url"] = f"http://{pc_ip}:9000"
config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"[INFO] Updated pc_server.base_url=http://{pc_ip}:9000")
PY
  else
    warn "No PC IP entered; keeping current config."
  fi
fi

if [ -z "$PREVIEW_MODE" ] && [ "$CREATED_CONFIG" = "true" ] && [ -n "${DISPLAY:-}" ]; then
  printf 'Bat khung preview camera de can chinh goc? [y/N]: '
  read -r PREVIEW_ANSWER
  case "${PREVIEW_ANSWER:-}" in
    y|Y|yes|YES)
      PREVIEW_MODE="true"
      ;;
    *)
      PREVIEW_MODE="false"
      ;;
  esac
fi

if [ -n "$PREVIEW_MODE" ]; then
  python3 - "$CONFIG_FILE" "$PREVIEW_MODE" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
preview = sys.argv[2].strip().lower() in {"1", "true", "yes", "y", "on"}
data = json.loads(config_path.read_text(encoding="utf-8"))
data["preview"] = preview
config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"[INFO] Updated preview={preview}")
PY
fi

if [ ! -f "models/durian_fruit_locator.onnx" ]; then
  fail "Missing models/durian_fruit_locator.onnx"
fi

VENV_DIR="$APP_DIR/.venv"
VENV_PY="$VENV_DIR/bin/python"

if [ -d "$VENV_DIR" ] && [ ! -x "$VENV_PY" ]; then
  warn "Existing .venv is incomplete. Recreating it."
  rm -rf "$VENV_DIR"
fi

if [ ! -d "$VENV_DIR" ]; then
  info "Creating Python virtual environment"
  if ! python3 -m venv --system-site-packages "$VENV_DIR"; then
    fail "Could not create .venv. Run: sudo apt install -y python3-venv python3-full"
  fi
fi

if [ ! -x "$VENV_PY" ]; then
  fail "Virtual environment python not found at $VENV_PY"
fi

if ! "$VENV_PY" -m pip --version >/dev/null 2>&1; then
  warn "pip is missing inside .venv. Trying ensurepip."
  "$VENV_PY" -m ensurepip --upgrade >/dev/null 2>&1 || true
fi

if ! "$VENV_PY" - <<'PY' >/dev/null 2>&1
import cv2
import onnxruntime
import requests
PY
then
  info "Installing Python dependencies"
  if ! "$VENV_PY" -m pip install --upgrade pip; then
    warn "Could not upgrade pip inside .venv."
    warn "If you see 'externally-managed-environment', remove the broken venv and install venv support:"
    warn "  rm -rf .venv && sudo apt install -y python3-venv python3-full"
    exit 1
  fi
  if ! "$VENV_PY" -m pip install -r requirements.txt; then
    warn "pip install failed."
    warn "If the failing package is onnxruntime/numpy, use Python 3.11/3.12 or the latest runtime zip."
    warn "If you see 'externally-managed-environment', remove the broken venv and install venv support:"
    warn "  rm -rf .venv && sudo apt install -y python3-venv python3-full"
    exit 1
  fi
fi

if ! "$VENV_PY" - <<'PY' >/dev/null 2>&1
import cv2
import onnxruntime
import requests
PY
then
  fail "Python dependencies are still missing after install. Check the pip/apt logs above."
fi

info "Starting Raspberry Pi durian camera runner"
"$VENV_PY" pi_runner.py --config "$CONFIG_FILE"
