"""
Optional USB serial reader for ESP32 + HX711 scale.

Enable with environment variables before starting the backend:
  SCALE_SERIAL_PORT=COM5
  SCALE_SERIAL_BAUD=9600

It parses the existing ESP32 output:
  RAW_WEIGHT=-0.001234   -> ignored
  2450 g | 2.450 kg      -> updates the SCADA scale state
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import os
import re
import threading
import time

from core.scale_state import reset_scale_reading, update_scale_reading


KG_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*kg", re.IGNORECASE)
GRAM_RE = re.compile(r"(-?\d+(?:\.\d+)?)\s*g\b", re.IGNORECASE)

DEFAULT_BAUD = 9600
DEFAULT_MIN_WEIGHT_KG = 0.2
DEFAULT_STABLE_DELTA_KG = 0.03


@dataclass
class SerialScaleStatus:
    enabled: bool = False
    connected: bool = False
    port: str | None = None
    baud: int = DEFAULT_BAUD
    last_line: str | None = None
    last_error: str | None = None
    last_weight_kg: float | None = None
    updated_at: float | None = None


_status = SerialScaleStatus()
_thread: threading.Thread | None = None
_stop_event = threading.Event()
_previous_weight_kg: float | None = None


def get_serial_scale_status() -> dict:
    return asdict(_status)


def _parse_weight_kg(line: str) -> float | None:
    kg_match = KG_RE.search(line)
    if kg_match:
        return float(kg_match.group(1))

    gram_match = GRAM_RE.search(line)
    if gram_match:
        return float(gram_match.group(1)) / 1000.0

    return None


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


def _handle_line(line: str, source: str, min_weight_kg: float, stable_delta_kg: float):
    global _previous_weight_kg

    weight_kg = _parse_weight_kg(line)
    if weight_kg is None:
        return

    if abs(weight_kg) < min_weight_kg:
        _previous_weight_kg = 0.0
        reset_scale_reading()
        _status.last_weight_kg = 0.0
        _status.updated_at = time.time()
        return

    if weight_kg < 0:
        weight_kg = -weight_kg

    stable = (
        _previous_weight_kg is not None
        and abs(weight_kg - _previous_weight_kg) <= stable_delta_kg
    )
    _previous_weight_kg = weight_kg

    update_scale_reading({
        "weight_kg": round(weight_kg, 3),
        "stable": stable,
        "source": source,
    })
    _status.last_weight_kg = round(weight_kg, 3)
    _status.updated_at = time.time()


def _reader_loop(port: str, baud: int, min_weight_kg: float, stable_delta_kg: float):
    try:
        import serial
    except Exception as exc:
        _status.last_error = f"Missing pyserial: {exc}"
        return

    while not _stop_event.is_set():
        ser = None
        try:
            resolved_port = _resolve_port(port)
            _status.port = resolved_port
            _status.baud = baud

            ser = serial.Serial(resolved_port, baudrate=baud, timeout=1)
            _status.connected = True
            _status.last_error = None
            time.sleep(2.0)

            while not _stop_event.is_set():
                raw = ser.readline()
                if not raw:
                    continue

                line = raw.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                _status.last_line = line
                _handle_line(
                    line,
                    source=f"usb_serial:{resolved_port}",
                    min_weight_kg=min_weight_kg,
                    stable_delta_kg=stable_delta_kg,
                )
        except Exception as exc:
            _status.connected = False
            _status.last_error = str(exc)
            time.sleep(2.0)
        finally:
            if ser is not None:
                try:
                    ser.close()
                except Exception:
                    pass


def start_serial_scale_reader():
    global _thread

    port = os.getenv("SCALE_SERIAL_PORT", "").strip()
    if not port:
        _status.enabled = False
        return

    baud = int(os.getenv("SCALE_SERIAL_BAUD", str(DEFAULT_BAUD)))
    min_weight_kg = float(os.getenv("SCALE_SERIAL_MIN_WEIGHT_KG", str(DEFAULT_MIN_WEIGHT_KG)))
    stable_delta_kg = float(os.getenv("SCALE_SERIAL_STABLE_DELTA_KG", str(DEFAULT_STABLE_DELTA_KG)))

    _status.enabled = True
    _status.port = port
    _status.baud = baud

    if _thread and _thread.is_alive():
        return

    _stop_event.clear()
    _thread = threading.Thread(
        target=_reader_loop,
        args=(port, baud, min_weight_kg, stable_delta_kg),
        daemon=True,
    )
    _thread.start()
