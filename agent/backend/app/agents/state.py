from typing import Annotated, Literal, TypedDict


class AgentState(TypedDict):
    messages: Annotated[list, "operator+"]
    agent: Annotated[str | None, "agent"]
    session_id: str
    pending_image_b64: Annotated[str | None, "pending_image"]
    selected_model: str | None


__all__ = ["AgentState"]
