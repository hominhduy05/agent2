from langchain_core.tools import tool
from typing import Literal
import base64
import uuid
from pathlib import Path
from app.core.config import settings


def _save_image(b64: str) -> str:
    storage = Path(settings.storage_path, "images")
    storage.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.jpg"
    path = storage / filename
    path.write_bytes(base64.b64decode(b64))
    return str(path)


@tool
def analyze_image(
    image_b64: str,
    analysis_type: Literal["general", "dashboard", "error", "camera"] = "general",
    prompt: str = "Analyze this image in detail for the SCADA/IoT system.",
) -> str:
    """
    Analyze an image using the vision LLM. Returns detailed text analysis.

    Args:
        image_b64: Base64-encoded image data
        analysis_type: One of 'general', 'dashboard', 'error', or 'camera'
        prompt: Custom analysis prompt

    Returns:
        The LLM's analysis text
    """
    from app.services.llm_service import llm_service

    _save_image(image_b64)
    result = llm_service.analyze_image(image_b64, prompt, analysis_type)
    return result


@tool
def extract_dashboard_metrics(image_b64: str) -> str:
    """
    Extract all metrics, values, gauges, and indicators from a dashboard screenshot.

    Args:
        image_b64: Base64-encoded dashboard image

    Returns:
        Structured extraction of all visible metrics
    """
    from app.services.llm_service import llm_service

    _save_image(image_b64)
    prompt = "Extract all metrics, values, gauges, and indicators from this dashboard image. Return data in structured format with field names and values."
    return llm_service.analyze_image(image_b64, prompt, "dashboard")


@tool
def diagnose_error(image_b64: str) -> str:
    """
    Diagnose an error image and provide root cause analysis with remediation steps.

    Args:
        image_b64: Base64-encoded error/warning image

    Returns:
        Structured diagnosis with probable causes and recommended actions
    """
    from app.services.llm_service import llm_service

    _save_image(image_b64)
    prompt = "Analyze this error image. Identify the probable root cause and recommend specific remediation steps. Provide diagnosis in structured sections: Symptom, Probable Causes, Recommended Actions."
    return llm_service.analyze_image(image_b64, prompt, "error")
