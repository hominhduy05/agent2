import base64
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.schemas.schemas import VisionRequest, VisionResponse
from app.services.llm_service import llm_service

router = APIRouter(prefix="/api/vision", tags=["Vision"])

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
MAX_SIZE = settings.max_image_size_mb * 1024 * 1024


def _save_image(b64: str) -> str:
    storage = Path(settings.storage_path, "images")
    storage.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    path = storage / filename
    path.write_bytes(base64.b64decode(b64))
    return str(path)


@router.post("/analyze", response_model=VisionResponse)
async def analyze(
    file: UploadFile = File(...),
    prompt: str = Form(default="Analyze this image in detail for the SCADA/IoT system."),
    analysis_type: str = Form(default="general"),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(413, f"File too large (max {settings.max_image_size_mb}MB)")

    b64 = base64.b64encode(contents).decode()
    _save_image(b64)

    try:
        analysis = await llm_service.analyze_image(b64, prompt, analysis_type)
    except Exception as e:
        raise HTTPException(502, f"LLM request failed: {e}")

    return VisionResponse(
        analysis=analysis,
        analysis_type=analysis_type,
        suggestions=_extract_suggestions(analysis),
    )


@router.post("/dashboard", response_model=VisionResponse)
async def analyze_dashboard(
    file: UploadFile = File(...),
    prompt: str = Form(default="Extract all metrics, values, gauges, and indicators from this dashboard image."),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(413, f"File too large (max {settings.max_image_size_mb}MB)")

    b64 = base64.b64encode(contents).decode()
    _save_image(b64)

    try:
        analysis = await llm_service.analyze_image(b64, prompt, "dashboard")
    except Exception as e:
        raise HTTPException(502, f"LLM request failed: {e}")

    return VisionResponse(
        analysis=analysis,
        analysis_type="dashboard",
        suggestions=_extract_suggestions(analysis),
    )


@router.post("/error", response_model=VisionResponse)
async def analyze_error(
    file: UploadFile = File(...),
    prompt: str = Form(default="Analyze this error image. Identify the probable root cause and recommend specific remediation steps."),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(413, f"File too large (max {settings.max_image_size_mb}MB)")

    b64 = base64.b64encode(contents).decode()
    _save_image(b64)

    try:
        analysis = await llm_service.analyze_image(b64, prompt, "error")
    except Exception as e:
        raise HTTPException(502, f"LLM request failed: {e}")

    return VisionResponse(
        analysis=analysis,
        analysis_type="error",
        suggestions=_extract_suggestions(analysis),
    )


@router.post("/camera", response_model=VisionResponse)
async def analyze_camera(
    image_b64: str = Form(...),
    prompt: str = Form(default="Analyze this camera frame from the SCADA system. Identify any issues or notable observations."),
):
    if len(image_b64) > MAX_SIZE * 2:
        raise HTTPException(413, "Image data too large")

    try:
        analysis = await llm_service.analyze_image(image_b64, prompt, "camera")
    except Exception as e:
        raise HTTPException(502, f"LLM request failed: {e}")

    return VisionResponse(
        analysis=analysis,
        analysis_type="camera",
        suggestions=_extract_suggestions(analysis),
    )


def _extract_suggestions(text: str) -> list[str]:
    lines = [l.strip().lstrip("-*").strip() for l in text.split("\n")]
    suggestions = [l for l in lines if len(l) > 20 and len(l) < 200][:5]
    return suggestions
