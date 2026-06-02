import uuid
from datetime import datetime
from collections import defaultdict

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

    try:
        reply = await llm_service.chat(req.message, history)
    except Exception as e:
        reply = f"An error occurred while processing your request: {e}"

    # Save to history
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
        _chat_sse_generator(req.message, session_id, req.context or {}),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _chat_sse_generator(message: str, session_id: str, context: dict):
    import json
    from app.services.llm_service import llm_service

    model = context.get("model")
    history = _sessions.get(session_id, [])

    yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

    full_response = ""
    try:
        async for token in llm_service.stream_chat(message, history, model):
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
    lines = [l.strip() for l in reply.split("\n")]
    suggestions = [
        l for l in lines
        if any(kw in l.lower() for kw in keywords)
        and len(l) > 10
        and len(l) < 120
    ]
    return suggestions[:3]
