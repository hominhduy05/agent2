from __future__ import annotations

from dataclasses import asdict, dataclass
import os
import threading
import time
from typing import Any


DEFAULT_BAUD = 115200
DEFAULT_ACK_TIMEOUT_SECONDS = 0.6


@dataclass
class Esp32RelayStatus:
    enabled: bool = False
    connected: bool = False
    port: str | None = None
    baud: int = DEFAULT_BAUD
    mode: str = "arm"
    last_command: str | None = None
    last_response: str | None = None
    last_error: str | None = None
    updated_at: float | None = None


_status = Esp32RelayStatus()
_lock = threading.Lock()
_serial: Any = None


def get_esp32_relay_status() -> dict:
    return asdict(_status)


def _resolve_auto_port() -> str:
    from serial.tools import list_ports

    ports = list(list_ports.comports())
    for item in ports:
        text = f"{item.device} {item.description} {item.manufacturer or ''}".lower()
        if "usb" in text or "ch340" in text or "cp210" in text or "silicon labs" in text:
            return item.device
    if ports:
        return ports[0].device
    raise RuntimeError("No serial ports found")


def _resolve_port(port: str) -> str:
    return _resolve_auto_port() if port.strip().lower() == "auto" else port


def _serial_config() -> tuple[str, int, str, float]:
    port = os.getenv("ESP32_RELAY_PORT", "").strip()
    baud = int(os.getenv("ESP32_RELAY_BAUD", str(DEFAULT_BAUD)))
    mode = os.getenv("ESP32_RELAY_COMMAND_MODE", "arm").strip().lower()
    ack_timeout = float(os.getenv("ESP32_RELAY_ACK_TIMEOUT_SECONDS", str(DEFAULT_ACK_TIMEOUT_SECONDS)))
    return port, baud, mode, ack_timeout


def _get_serial():
    global _serial

    port, baud, mode, _ = _serial_config()
    _status.enabled = bool(port)
    _status.port = port or None
    _status.baud = baud
    _status.mode = mode if mode in {"arm", "pulse"} else "arm"

    if not port:
        _status.connected = False
        _status.last_error = "ESP32_RELAY_PORT is not set"
        return None

    try:
        import serial
    except Exception as exc:
        _status.connected = False
        _status.last_error = f"Missing pyserial: {exc}"
        return None

    if _serial is not None and getattr(_serial, "is_open", False):
        return _serial

    resolved_port = _resolve_port(port)
    _status.port = resolved_port
    _serial = serial.Serial(resolved_port, baudrate=baud, timeout=0.1, write_timeout=0.5)
    time.sleep(1.5)
    _status.connected = True
    _status.last_error = None
    return _serial


def _read_ack(ser, command_id: str, timeout_seconds: float) -> str | None:
    deadline = time.time() + max(0.05, timeout_seconds)
    last_line = None
    while time.time() < deadline:
        raw = ser.readline()
        if not raw:
            continue
        line = raw.decode("utf-8", errors="ignore").strip()
        if not line:
            continue
        last_line = line
        if command_id in line or line.startswith("ACK") or line.startswith("ERR") or line.startswith("BUSY"):
            return line
    return last_line


def send_sorting_command(command: dict[str, Any]) -> dict:
    global _serial

    relay_channel = command.get("relay_channel")
    if relay_channel is None:
        return {"sent": False, "reason": "no_relay_channel"}

    port, _, mode, ack_timeout = _serial_config()
    if not port:
        _status.enabled = False
        _status.last_error = "ESP32_RELAY_PORT is not set"
        return {"sent": False, "reason": "ESP32_RELAY_PORT is not set"}

    action = "PULSE" if mode == "pulse" else "ARM"
    delay_ms = max(0, int(command.get("delay_ms") or 0))
    pulse_ms = max(1, int(command.get("pulse_ms") or 250))
    command_id = str(command.get("command_id") or "manual").replace(" ", "_")
    line = f"{action} {int(relay_channel)} {delay_ms} {pulse_ms} {command_id}"

    with _lock:
        try:
            ser = _get_serial()
            if ser is None:
                return {"sent": False, "reason": _status.last_error}
            try:
                ser.reset_input_buffer()
            except Exception:
                pass
            ser.write((line + "\n").encode("utf-8"))
            ser.flush()
            response = _read_ack(ser, command_id, ack_timeout)
            _status.connected = True
            _status.last_command = line
            _status.last_response = response
            _status.last_error = None
            _status.updated_at = time.time()
            return {
                "sent": True,
                "line": line,
                "response": response,
                "mode": action.lower(),
                "port": _status.port,
            }
        except Exception as exc:
            try:
                if _serial is not None:
                    _serial.close()
            except Exception:
                pass
            _serial = None
            _status.connected = False
            _status.last_error = str(exc)
            _status.updated_at = time.time()
            return {"sent": False, "reason": str(exc)}
