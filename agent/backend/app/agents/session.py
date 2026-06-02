import uuid
from datetime import datetime
from typing import Optional
from langchain_core.messages import BaseMessage


class AgentSession:
    def __init__(
        self,
        session_id: str,
        messages: list[BaseMessage] | None = None,
        metadata: dict | None = None,
    ):
        self.session_id = session_id
        self.messages: list[BaseMessage] = messages or []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.metadata: dict = metadata or {}

    def add_message(self, msg: BaseMessage) -> None:
        self.messages.append(msg)
        self.updated_at = datetime.now()

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "messages": [{"role": m.type, "content": m.content} for m in self.messages],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "metadata": self.metadata,
        }


class AgentSessionManager:
    def __init__(self):
        self._sessions: dict[str, AgentSession] = {}

    def get_or_create(self, session_id: str | None) -> AgentSession:
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]
        new_id = session_id or str(uuid.uuid4())
        session = AgentSession(session_id=new_id)
        self._sessions[new_id] = session
        return session

    def get(self, session_id: str) -> Optional[AgentSession]:
        return self._sessions.get(session_id)

    def list_sessions(self) -> list[dict]:
        return [s.to_dict() for s in self._sessions.values()]

    def delete(self, session_id: str) -> bool:
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False


_agent_session_manager: AgentSessionManager | None = None


def get_session_manager() -> AgentSessionManager:
    global _agent_session_manager
    if _agent_session_manager is None:
        _agent_session_manager = AgentSessionManager()
    return _agent_session_manager
