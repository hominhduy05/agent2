from __future__ import annotations

from agentic.schemas.action import ActionDefinition, RiskLevel


class ActionRegistry:
    def __init__(self) -> None:
        self._definitions: dict[str, ActionDefinition] = {}

    def register(self, definition: ActionDefinition) -> None:
        self._definitions[definition.action_key] = definition

    def get(self, action_key: str) -> ActionDefinition | None:
        return self._definitions.get(action_key)

    def list(self) -> list[ActionDefinition]:
        return list(self._definitions.values())


def build_default_registry() -> ActionRegistry:
    registry = ActionRegistry()
    registry.register(ActionDefinition(
        action_key="RECHECK_HEALTH",
        title="Recheck system health",
        description="Run a fresh agent snapshot and anomaly check.",
        risk_level=RiskLevel.SAFE_WRITE,
    ))
    registry.register(ActionDefinition(
        action_key="READ_RECENT_LOGS",
        title="Read recent sorting logs",
        description="Read a bounded number of recent SFDS sorting log lines.",
        risk_level=RiskLevel.SAFE_READ,
    ))
    registry.register(ActionDefinition(
        action_key="ACKNOWLEDGE_ALERT",
        title="Acknowledge alert",
        description="Mark an active agent alert as acknowledged.",
        risk_level=RiskLevel.SAFE_WRITE,
    ))
    registry.register(ActionDefinition(
        action_key="FINALIZE_BATCH",
        title="Finalize sorting batch",
        description="Finalize a batch through existing SFDS sorting logic.",
        risk_level=RiskLevel.CONFIRM_REQUIRED,
        requires_confirmation=True,
    ))
    registry.register(ActionDefinition(
        action_key="ARBITRARY_RELAY_COMMAND",
        title="Arbitrary relay command",
        description="Direct relay/cylinder commands are forbidden.",
        risk_level=RiskLevel.FORBIDDEN,
        requires_confirmation=True,
    ))
    return registry

