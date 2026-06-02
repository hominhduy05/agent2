from langchain_core.tools import tool


@tool
def get_chat_history(session_id: str) -> str:
    """
    Retrieve the chat history for a given session.

    Args:
        session_id: The session identifier

    Returns:
        Formatted chat history as a string
    """
    from app.api.v1.endpoints.chat import _sessions

    messages = _sessions.get(session_id, [])
    if not messages:
        return f"No history found for session '{session_id}'."

    lines = []
    for m in messages:
        role_label = "User" if m["role"] == "user" else "Assistant"
        lines.append(f"[{role_label}]\n{m['content']}\n")
    return "\n".join(lines)


@tool
def get_current_sfds_status() -> str:
    """
    Get the current real-time status of the SFDS system including health and camera stats.
    Use this when a user asks about system status, health, cameras, or SFDS.
    """
    from app.services.sfds_service import sfds_service

    try:
        health = sfds_service.get_health()
        cameras = sfds_service.get_cameras()
        stats = sfds_service.get_stats()
        return f"SFDS Health: {health}\n\nCameras: {cameras}\n\nStats: {stats}"
    except Exception as e:
        return f"SFDS unavailable: {e}"
