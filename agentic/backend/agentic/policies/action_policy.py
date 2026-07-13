from __future__ import annotations

from agentic.schemas.action import ActionDefinition, ActionRequest, ActionStatus, RiskLevel


class ActionPolicy:
    def evaluate(
        self,
        definition: ActionDefinition | None,
        request: ActionRequest,
    ) -> tuple[bool, ActionStatus, str]:
        if definition is None:
            return False, ActionStatus.REJECTED, "Unknown action key"

        if definition.risk_level == RiskLevel.FORBIDDEN:
            return False, ActionStatus.REJECTED, "Forbidden action"

        if definition.risk_level == RiskLevel.CONFIRM_REQUIRED and not request.approved:
            return False, ActionStatus.PENDING_APPROVAL, "Action requires explicit approval"

        return True, ActionStatus.EXECUTING, "Policy accepted"

