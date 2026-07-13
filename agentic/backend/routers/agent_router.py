from __future__ import annotations

from fastapi import APIRouter, HTTPException

from agentic.actions import ActionExecutor, build_default_registry
from agentic.memory import InMemoryAgentStore
from agentic.runtime import AgentOrchestrator
from agentic.schemas.action import ActionRequest


router = APIRouter(prefix="/api/agent", tags=["Agentic AI"])

_store = InMemoryAgentStore()
_orchestrator = AgentOrchestrator(_store)
_registry = build_default_registry()
_executor = ActionExecutor(_registry)


@router.get("/status")
def get_agent_status() -> dict:
    latest_run = _store.list_runs(limit=1)
    return {
        "latest_run": latest_run[0].model_dump(mode="json") if latest_run else None,
        "active_alerts": [item.model_dump(mode="json") for item in _store.list_alerts(active_only=True)],
        "recommendations": [item.model_dump(mode="json") for item in _store.list_recommendations(limit=10)],
    }


@router.post("/runs")
def create_agent_run(trigger_source: str = "manual") -> dict:
    run = _orchestrator.run(trigger_source=trigger_source)
    return run.model_dump(mode="json")


@router.get("/runs")
def list_agent_runs(limit: int = 20) -> dict:
    return {"items": [item.model_dump(mode="json") for item in _store.list_runs(limit=limit)]}


@router.get("/alerts")
def list_agent_alerts(active_only: bool = True) -> dict:
    return {"items": [item.model_dump(mode="json") for item in _store.list_alerts(active_only=active_only)]}


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_agent_alert(alert_id: str) -> dict:
    alert = _store.acknowledge_alert(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert.model_dump(mode="json")


@router.get("/recommendations")
def list_agent_recommendations(limit: int = 50) -> dict:
    return {"items": [item.model_dump(mode="json") for item in _store.list_recommendations(limit=limit)]}


@router.get("/actions")
def list_agent_actions() -> dict:
    return {"items": [item.model_dump(mode="json") for item in _registry.list()]}


@router.post("/actions")
def execute_agent_action(request: ActionRequest) -> dict:
    result = _executor.execute(request)
    return result.model_dump(mode="json")

