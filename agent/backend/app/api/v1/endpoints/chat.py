import re
import unicodedata
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.schemas.schemas import ChatHistoryItem, ChatHistoryResponse, ChatMessage, ChatResponse

router = APIRouter(prefix="/api/chat", tags=["Chat"])

# In-memory session store (use Redis/DB in production)
_sessions: dict[str, list[dict[str, str]]] = defaultdict(list)


@router.post("/message", response_model=ChatResponse)
async def send_message(req: ChatMessage):
    from app.services.llm_service import llm_service

    session_id = req.session_id or str(uuid.uuid4())
    history = _sessions.get(session_id, [])
    system_context = await _build_live_context(req.message)

    try:
        reply = _build_offline_reply(system_context, req.message) or await llm_service.chat(
            req.message,
            history,
            system_context=system_context,
        )
    except Exception as e:
        reply = f"An error occurred while processing your request: {e}"

    _sessions[session_id].append({"role": "user", "content": req.message})
    _sessions[session_id].append({"role": "assistant", "content": reply})

    if len(_sessions[session_id]) > settings.chat_history_messages:
        _sessions[session_id] = _sessions[session_id][-settings.chat_history_messages:]

    suggestions = _build_suggestions(reply)

    return ChatResponse(
        reply=reply,
        session_id=session_id,
        suggestions=suggestions,
    )


@router.post("/stream")
async def stream_message(req: ChatMessage):
    """Fast direct chat stream to LM Studio without LangGraph/tool routing."""
    session_id = req.session_id or str(uuid.uuid4())

    return StreamingResponse(
        _chat_sse_generator(req.message, session_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _chat_sse_generator(message: str, session_id: str):
    import json
    from app.services.llm_service import llm_service

    history = _sessions.get(session_id, [])
    system_context = await _build_live_context(message)

    yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

    full_response = ""
    try:
        offline_reply = _build_offline_reply(system_context, message)
        if offline_reply:
            full_response = offline_reply
            yield f"data: {json.dumps({'type': 'token', 'content': offline_reply})}\n\n"
        else:
            async for token in llm_service.stream_chat(message, history, system_context=system_context):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        _sessions[session_id].append({"role": "user", "content": message})
        _sessions[session_id].append({"role": "assistant", "content": full_response})
        if len(_sessions[session_id]) > settings.chat_history_messages:
            _sessions[session_id] = _sessions[session_id][-settings.chat_history_messages:]

        yield f"data: {json.dumps({'type': 'done', 'content': full_response, 'session_id': session_id})}\n\n"
    except Exception as e:
        error = str(e).strip() or e.__class__.__name__
        yield f"data: {json.dumps({'type': 'error', 'message': error})}\n\n"

    yield "data: [DONE]\n\n"


def _ascii_fold(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.lower())
    return "".join(ch for ch in normalized if not unicodedata.combining(ch)).replace("đ", "d")


def _prefers_vietnamese(message: str) -> bool:
    folded = _ascii_fold(message)
    vietnamese_markers = [
        "toi",
        "ban",
        "dang",
        "khong",
        "kiem tra",
        "trang thai",
        "ket noi",
        "hoat dong",
        "tat",
        "bat",
        "giup",
    ]
    return any(marker in folded for marker in vietnamese_markers)


def _needs_live_sfds_context(message: str) -> bool:
    content = _ascii_fold(message)
    keywords = [
        "sfds",
        "backend",
        "api",
        "status",
        "health",
        "online",
        "offline",
        "camera",
        "cameras",
        "ket noi",
        "trang thai",
        "hoat dong",
        "kiem tra",
        "dang chay",
        "tat",
    ]
    return any(keyword in content for keyword in keywords) or re.search(r"\bbe\b", content) is not None


async def _build_live_context(message: str) -> str | None:
    if not _needs_live_sfds_context(message):
        return None

    from app.services.sfds_service import sfds_service

    checks: dict[str, Any] = {
        "sfds_base_url": sfds_service.base_url,
        "sfds_status": "offline",
        "health": None,
        "cameras": None,
        "stats": None,
        "error": None,
    }

    try:
        checks["health"] = await sfds_service.aget_health()
        checks["sfds_status"] = "online"
    except (httpx.ConnectError, httpx.ConnectTimeout, httpx.ReadTimeout) as e:
        checks["error"] = f"{e.__class__.__name__}: cannot connect to SFDS backend"
    except httpx.HTTPStatusError as e:
        checks["error"] = f"HTTP {e.response.status_code}: {e.response.text}"
    except Exception as e:
        checks["error"] = f"{e.__class__.__name__}: {e}"

    if checks["sfds_status"] == "online":
        try:
            checks["cameras"] = await sfds_service.aget_cameras()
        except Exception as e:
            checks["cameras"] = {"error": f"{e.__class__.__name__}: {e}"}

        try:
            checks["stats"] = await sfds_service.aget_stats()
        except Exception as e:
            checks["stats"] = {"error": f"{e.__class__.__name__}: {e}"}

    language_instruction = (
        "Reply in the same primary language as the user's latest message. "
        "Use Vietnamese for Vietnamese user messages and English for English user messages."
    )

    return (
        "REAL-TIME SFDS CHECK:\n"
        f"{checks}\n\n"
        "Instruction: If the user asks about SFDS/backend/API/camera/status/health, answer from "
        "REAL-TIME SFDS CHECK only. If sfds_status is offline, clearly say SFDS backend is offline "
        "or unreachable. Do not invent HMI logs, PLC packet rates, or normal-operation evidence that "
        "is not present in REAL-TIME SFDS CHECK. "
        f"{language_instruction}"
    )


def _build_offline_reply(system_context: str | None, message: str) -> str | None:
    if not system_context or "'sfds_status': 'offline'" not in system_context:
        return None

    if not _prefers_vietnamese(message):
        return (
            "**SFDS Backend is currently offline or unreachable.**\n\n"
            "- Agent Backend is still running, but the connection from Agent BE to SFDS BE at "
            f"`{settings.sfds_base_url}` is failing.\n"
            "- The status API should return `sfds_status: offline`.\n"
            "- Start the SFDS backend terminal again, then recheck Agent BE endpoint "
            "`/api/sfds/health`."
        )

    return (
        "**SFDS Backend hi\u1ec7n \u0111ang offline ho\u1eb7c kh\u00f4ng truy c\u1eadp \u0111\u01b0\u1ee3c.**\n\n"
        "- Agent Backend v\u1eabn \u0111ang ch\u1ea1y, nh\u01b0ng k\u1ebft n\u1ed1i t\u1eeb Agent BE sang SFDS BE t\u1ea1i "
        f"`{settings.sfds_base_url}` \u0111ang th\u1ea5t b\u1ea1i.\n"
        "- API ki\u1ec3m tra tr\u1ea1ng th\u00e1i n\u00ean tr\u1ea3 `sfds_status: offline`.\n"
        "- H\u00e3y b\u1eadt l\u1ea1i terminal/backend SFDS, sau \u0111\u00f3 ki\u1ec3m tra l\u1ea1i endpoint "
        "`/api/sfds/health` tr\u00ean Agent BE."
    )


@router.get("/history/{session_id}", response_model=ChatHistoryResponse)
async def get_history(session_id: str):
    messages = _sessions.get(session_id, [])
    items = [
        ChatHistoryItem(
            role=m["role"],
            content=m["content"],
            timestamp=datetime.now().isoformat(),
        )
        for m in messages
    ]
    return ChatHistoryResponse(session_id=session_id, messages=items)


def _build_suggestions(reply: str) -> list[str]:
    keywords = ["check", "verify", "inspect", "restart", "calibrate", "replace", "clean", "test"]
    lines = [line.strip() for line in reply.split("\n")]
    suggestions = [
        line for line in lines
        if any(keyword in line.lower() for keyword in keywords)
        and 10 < len(line) < 120
    ]
    return suggestions[:3]
