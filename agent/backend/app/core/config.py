import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # LM Studio
    lm_studio_url: str = "http://localhost:1234/v1/chat/completions"
    lm_model: str = "nvidia/nemotron-3-nano-omni"
    vision_agent_model: str = "nvidia/nemotron-3-nano-omni"
    chat_agent_model: str = "nvidia/nemotron-3-nano-4b"
    report_agent_model: str = "qwen/qwen3.5-9b"
    max_tokens: int = 2048
    chat_max_tokens: int = 512
    chat_history_messages: int = 8
    temperature: float = 0.4

    # SFDS
    sfds_base_url: str = "http://localhost:9000"
    sfds_timeout: int = 30
    sfds_event_retention: int = 500

    # Storage
    storage_path: str = "storage"
    max_image_size_mb: int = 10

    # Agent / LangGraph
    agent_recursion_limit: int = 50

    # Server
    host: str = "0.0.0.0"
    port: int = 8001

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# System prompts for LLM roles
SYSTEM_PROMPTS = {
    "vision_analyzer": (
        "You are a computer vision expert specializing in SCADA/IoT industrial systems. "
        "Analyze images, identify components, detect anomalies, and provide detailed technical assessments. "
        "Always respond in a structured format with clear sections."
    ),
    "dashboard_reader": (
        "You are a data extraction specialist for industrial dashboards. "
        "Read gauges, meters, charts, and numerical displays. Extract all metrics, values, and indicators accurately. "
        "Return data in structured format with field names and values."
    ),
    "error_diagnoser": (
        "You are a senior maintenance engineer specializing in machinery fault diagnosis. "
        "Analyze error images, identify probable root causes, and recommend specific remediation steps. "
        "Provide diagnosis in structured sections: Symptom, Probable Causes, Recommended Actions."
    ),
    "operation_assistant": (
        "You are an AI operations assistant for a durian sorting and inspection SCADA system. "
        "Provide clear, actionable guidance for system operation, troubleshooting, and maintenance. "
        "When relevant, reference the SFDS system architecture and detection results."
    ),
}
