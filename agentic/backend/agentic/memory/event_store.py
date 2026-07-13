from __future__ import annotations

from agentic.schemas.alert import AlertFinding, AlertStatus
from agentic.schemas.recommendation import Recommendation
from agentic.schemas.run import AgentRun
from agentic.utils import utc_now


class InMemoryAgentStore:
    """MVP store.

    Replace with SQLAlchemy repositories when wiring into SFDS persistence.
    """

    def __init__(self) -> None:
        self.runs: dict[str, AgentRun] = {}
        self.alerts: dict[str, AlertFinding] = {}
        self.alert_by_dedup_key: dict[str, str] = {}
        self.recommendations: dict[str, Recommendation] = {}

    def save_run(self, run: AgentRun) -> AgentRun:
        self.runs[run.run_id] = run
        return run

    def list_runs(self, limit: int = 20) -> list[AgentRun]:
        return sorted(self.runs.values(), key=lambda item: item.started_at, reverse=True)[:limit]

    def upsert_alert(self, alert: AlertFinding) -> AlertFinding:
        existing_id = self.alert_by_dedup_key.get(alert.deduplication_key)
        if existing_id and existing_id in self.alerts:
            existing = self.alerts[existing_id]
            if existing.status not in {AlertStatus.RESOLVED, AlertStatus.SUPPRESSED}:
                existing.last_seen_at = utc_now()
                existing.evidence = alert.evidence
                existing.run_id = alert.run_id
                return existing

        self.alerts[alert.alert_id] = alert
        self.alert_by_dedup_key[alert.deduplication_key] = alert.alert_id
        return alert

    def list_alerts(self, active_only: bool = True) -> list[AlertFinding]:
        alerts = list(self.alerts.values())
        if active_only:
            alerts = [alert for alert in alerts if alert.status in {AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED, AlertStatus.INVESTIGATING}]
        return sorted(alerts, key=lambda item: item.last_seen_at, reverse=True)

    def acknowledge_alert(self, alert_id: str) -> AlertFinding | None:
        alert = self.alerts.get(alert_id)
        if alert is None:
            return None
        alert.status = AlertStatus.ACKNOWLEDGED
        alert.acknowledged_at = utc_now()
        return alert

    def save_recommendation(self, recommendation: Recommendation) -> Recommendation:
        self.recommendations[recommendation.recommendation_id] = recommendation
        return recommendation

    def list_recommendations(self, limit: int = 50) -> list[Recommendation]:
        return sorted(self.recommendations.values(), key=lambda item: item.created_at, reverse=True)[:limit]
