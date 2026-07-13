from __future__ import annotations

from typing import Callable

from agentic.actions.registry import ActionRegistry
from agentic.policies.action_policy import ActionPolicy
from agentic.schemas.action import ActionRequest, ActionResult, ActionStatus


ActionHandler = Callable[[ActionRequest], dict]


class ActionExecutor:
    def __init__(
        self,
        registry: ActionRegistry,
        policy: ActionPolicy | None = None,
        handlers: dict[str, ActionHandler] | None = None,
    ) -> None:
        self.registry = registry
        self.policy = policy or ActionPolicy()
        self.handlers = handlers or {}

    def execute(self, request: ActionRequest) -> ActionResult:
        definition = self.registry.get(request.action_key)
        allowed, status, message = self.policy.evaluate(definition, request)
        risk_level = definition.risk_level if definition else "FORBIDDEN"
        if not allowed:
            return ActionResult(
                action_key=request.action_key,
                risk_level=risk_level,
                status=status,
                message=message,
            )

        handler = self.handlers.get(request.action_key)
        if handler is None:
            return ActionResult(
                action_key=request.action_key,
                risk_level=risk_level,
                status=ActionStatus.SUCCEEDED,
                message="Action accepted; no handler is wired in scaffold mode",
            )

        try:
            result = handler(request)
            return ActionResult(
                action_key=request.action_key,
                risk_level=risk_level,
                status=ActionStatus.SUCCEEDED,
                message="Action executed",
                result=result,
            )
        except Exception as exc:
            return ActionResult(
                action_key=request.action_key,
                risk_level=risk_level,
                status=ActionStatus.FAILED,
                message=str(exc),
            )

