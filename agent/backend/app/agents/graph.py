import asyncio
from typing import Literal, AsyncGenerator
from functools import lru_cache
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import RunnableConfig

from app.core.config import settings
from .state import AgentState
from .tools import (
    analyze_image,
    extract_dashboard_metrics,
    diagnose_error,
    get_sfds_health,
    get_sfds_cameras,
    get_sfds_stats,
    generate_report,
    get_chat_history,
    get_current_sfds_status,
)

LANGUAGE_RULE = (
    "Language rule: Always reply in the user's primary language. "
    "If the user writes Vietnamese, reply in Vietnamese. "
    "If the user writes English, reply in English. "
    "If the user mixes languages, use the dominant language of the latest user message. "
    "Do not switch languages unless the user asks you to."
)

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

VISION_TOOLS = [
    analyze_image,
    extract_dashboard_metrics,
    diagnose_error,
    get_sfds_health,
    get_sfds_cameras,
    get_sfds_stats,
]

CHAT_TOOLS = [
    get_sfds_health,
    get_sfds_cameras,
    get_sfds_stats,
    get_chat_history,
    get_current_sfds_status,
]

REPORT_TOOLS = [
    generate_report,
]


def _message_text(message) -> str:
    content = getattr(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    parts.append(text)
        return " ".join(parts)
    return str(content)


def _message_has_image(message) -> bool:
    content = getattr(message, "content", "")
    if not isinstance(content, list):
        return False
    return any(
        isinstance(item, dict)
        and (
            item.get("type") == "image_url"
            or "image_url" in item
        )
        for item in content
    )


def _prompt(name: str) -> SystemMessage:
    return SystemMessage(content=f"{SYSTEM_PROMPTS[name]}\n\n{LANGUAGE_RULE}")


@lru_cache(maxsize=16)
def _get_vision_agent(model: str | None = None):
    from .base import get_llm
    return create_react_agent(
        get_llm(model or settings.vision_agent_model),
        tools=VISION_TOOLS,
        prompt=_prompt("vision_analyzer"),
    )


@lru_cache(maxsize=1)
def _get_chat_agent():
    from .base import get_llm
    return create_react_agent(
        get_llm(settings.chat_agent_model),
        tools=CHAT_TOOLS,
        prompt=_prompt("operation_assistant"),
    )


@lru_cache(maxsize=16)
def _get_report_agent(model: str | None = None):
    from .base import get_llm
    return create_react_agent(
        get_llm(model or settings.report_agent_model),
        tools=REPORT_TOOLS,
        prompt=SystemMessage(
            content="You are a professional report generation specialist. "
            "Use the generate_report tool to create well-formatted reports from analysis content. "
            "Always extract the key information and present it clearly. "
            f"{LANGUAGE_RULE}"
        ),
    )


def route_to_agent(state: AgentState) -> Literal["vision_agent", "chat_agent", "report_agent", "FINISH"]:
    last = state["messages"][-1]
    content = _message_text(last).lower()

    has_image = bool(state.get("pending_image_b64")) or _message_has_image(last)

    image_keywords = ["image", "photo", "picture", "analyze", "vision", "dashboard", "error", "camera"]
    report_keywords = ["report", "pdf", "docx", "html", "export", "generate", "download"]
    chat_keywords = ["status", "health", "camera", "sfds", "help", "how", "what", "explain", "troubleshoot"]

    if has_image:
        return "vision_agent"

    for kw in report_keywords:
        if kw in content:
            return "report_agent"

    for kw in image_keywords:
        if kw in content:
            return "vision_agent"

    return "chat_agent"


def _build_image_message(message: str, image_b64: str) -> HumanMessage:
    image_url = image_b64 if image_b64.startswith("data:image/") else f"data:image/jpeg;base64,{image_b64}"
    return HumanMessage(
        content=[
            {"type": "text", "text": message},
            {
                "type": "image_url",
                "image_url": {"url": image_url},
            },
        ]
    )


def vision_node(state: AgentState) -> AgentState:
    msgs = list(state["messages"])
    img = state.get("pending_image_b64")

    if img and msgs:
        msgs = [_build_image_message(msgs[-1].content, img)] + msgs[:-1]

    agent = _get_vision_agent()
    result = agent.invoke({"messages": msgs})
    return {"messages": result["messages"], "agent": "vision_agent", "pending_image_b64": None}


def chat_node(state: AgentState) -> AgentState:
    agent = _get_chat_agent()
    result = agent.invoke({"messages": state["messages"]})
    return {"messages": result["messages"], "agent": "chat_agent"}


def report_node(state: AgentState) -> AgentState:
    agent = _get_report_agent()
    result = agent.invoke({"messages": state["messages"]})
    return {"messages": result["messages"], "agent": "report_agent"}


def supervisor_node(state: AgentState) -> AgentState:
    last = state["messages"][-1]
    content = _message_text(last).lower()

    if state.get("pending_image_b64") or _message_has_image(last):
        classification = "VISION"
    elif any(kw in content for kw in ["report", "pdf", "docx", "html", "generate"]):
        classification = "REPORT"
    elif any(kw in content for kw in ["image", "photo", "analyze", "dashboard", "error", "camera"]):
        classification = "VISION"
    else:
        classification = "CHAT"

    return {"agent": classification}


def compile_graph():
    builder = StateGraph(AgentState)
    builder.add_node("supervisor", supervisor_node)
    builder.add_node("vision_agent", vision_node)
    builder.add_node("chat_agent", chat_node)
    builder.add_node("report_agent", report_node)

    builder.add_edge(START, "supervisor")

    builder.add_conditional_edges(
        "supervisor",
        route_to_agent,
        {
            "vision_agent": "vision_agent",
            "chat_agent": "chat_agent",
            "report_agent": "report_agent",
        },
    )

    builder.add_edge("vision_agent", END)
    builder.add_edge("chat_agent", END)
    builder.add_edge("report_agent", END)

    return builder.compile()


_agent_graph = None


def get_graph():
    global _agent_graph
    if _agent_graph is None:
        _agent_graph = compile_graph()
    return _agent_graph


async def stream_agent_response(
    message: str,
    session_id: str,
    image_b64: str | None = None,
    model: str | None = None,
) -> AsyncGenerator[str, None]:
    """
    Stream agent responses token-by-token.
    """
    graph = get_graph()

    initial_messages = [HumanMessage(content=message)]
    initial_pending = image_b64

    initial_state: AgentState = {
        "messages": initial_messages,
        "agent": None,
        "session_id": session_id,
        "pending_image_b64": initial_pending,
        "selected_model": model,
    }

    config = RunnableConfig(
        configurable={"thread_id": session_id},
        recursion_limit=50,
    )

    async for event in graph.astream_events(initial_state, config, version="v2"):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                yield content
