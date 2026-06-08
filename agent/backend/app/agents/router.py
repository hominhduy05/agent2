from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Literal

from app.core.config import settings
from .graph import stream_agent_response
from .session import get_session_manager

router = APIRouter(prefix="/api/agent", tags=["Agent"])


class AgentRequest(BaseModel):
    message: str
    session_id: str | None = None
    image_b64: str | None = None
    model: str | None = None


class AgentSessionResponse(BaseModel):
    session_id: str
    message: str


@router.post("/stream")
async def stream_agent(req: AgentRequest):
    """
    Stream a multi-agent response using SSE.
    Tokens are yielded as they arrive from the LLM.
    """
    session_id = req.session_id or str(__import__("uuid").uuid4())

    return StreamingResponse(
        _sse_generator(req.message, session_id, req.image_b64, req.model),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _sse_generator(
    message: str,
    session_id: str,
    image_b64: str | None,
    model: str | None,
):
    import json
    import asyncio

    yield f"data: {json.dumps({'type': 'start', 'session_id': session_id})}\n\n"

    try:
        full_response = ""
        async for token in stream_agent_response(message, session_id, image_b64, model):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        sm = get_session_manager()
        sm.get_or_create(session_id)

        yield f"data: {json.dumps({'type': 'done', 'content': full_response, 'session_id': session_id})}\n\n"
    except Exception as e:
        message = str(e).strip() or e.__class__.__name__
        cause = getattr(e, "__cause__", None) or getattr(e, "__context__", None)
        if cause:
            cause_message = str(cause).strip() or cause.__class__.__name__
            message = f"{message}: {cause_message}"
        yield f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"

    yield "data: [DONE]\n\n"


@router.get("/models")
async def list_lm_studio_models():
    """Return the single model used by the Chat Agent."""
    chat_model = {"id": settings.chat_agent_model, "label": settings.chat_agent_model}
    return {
        "models": [chat_model],
        "default_model": settings.chat_agent_model,
        "agent_models": {
            "vision_agent": settings.vision_agent_model,
            "chat_agent": settings.chat_agent_model,
            "report_agent": settings.report_agent_model,
        },
    }


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    """Get session info and message history."""
    sm = get_session_manager()
    session = sm.get(session_id)
    if not session:
        raise HTTPException(404, f"Session '{session_id}' not found")
    return session.to_dict()


@router.get("/sessions")
async def list_sessions():
    """List all active agent sessions."""
    sm = get_session_manager()
    return {"sessions": sm.list_sessions()}


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a session."""
    sm = get_session_manager()
    if not sm.delete(session_id):
        raise HTTPException(404, f"Session '{session_id}' not found")
    return {"deleted": session_id}
