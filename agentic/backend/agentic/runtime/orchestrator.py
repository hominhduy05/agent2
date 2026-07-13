from __future__ import annotations

from typing import Callable

from agentic.agents.supervisor import SupervisorAgent
from agentic.analyzers import AnomalyDetector
from agentic.memory import InMemoryAgentStore
from agentic.monitors import collect_system_snapshot
from agentic.policies.thresholds import AgenticThresholds
from agentic.schemas.run import AgentRun, AgentRunStatus
from agentic.schemas.snapshot import SystemSnapshot
from agentic.utils import utc_now


SnapshotCollector = Callable[[AgenticThresholds | None], SystemSnapshot]


class AgentOrchestrator:
    def __init__(
        self,
        store: InMemoryAgentStore,
        thresholds: AgenticThresholds | None = None,
        snapshot_collector: SnapshotCollector = collect_system_snapshot,
        anomaly_detector: AnomalyDetector | None = None,
        supervisor: SupervisorAgent | None = None,
    ) -> None:
        self.store = store
        self.thresholds = thresholds or AgenticThresholds.from_env()
        self.snapshot_collector = snapshot_collector
        self.anomaly_detector = anomaly_detector or AnomalyDetector(self.thresholds)
        self.supervisor = supervisor or SupervisorAgent()

    def run(self, trigger_source: str = "manual") -> AgentRun:
        run = AgentRun(trigger_source=trigger_source)
        self.store.save_run(run)
        try:
            snapshot = self.snapshot_collector(self.thresholds)
            findings = self.anomaly_detector.detect(snapshot)
            for finding in findings:
                finding.run_id = run.run_id
            saved_alerts = [self.store.upsert_alert(finding) for finding in findings]
            recommendations = self.supervisor.recommend(snapshot, saved_alerts) if saved_alerts else []
            for recommendation in recommendations:
                self.store.save_recommendation(recommendation)

            run.snapshot = snapshot.model_dump(mode="json")
            run.anomalies_found = len(saved_alerts)
            run.recommendations_found = len(recommendations)
            run.summary = self._summarize_run(snapshot, len(saved_alerts))
            run.status = AgentRunStatus.PARTIAL if snapshot.partial_errors else AgentRunStatus.SUCCEEDED
            run.finished_at = utc_now()
            self.store.save_run(run)
            return run
        except Exception as exc:
            run.status = AgentRunStatus.FAILED
            run.error = str(exc)
            run.summary = "Agent run failed"
            run.finished_at = utc_now()
            self.store.save_run(run)
            return run

    def _summarize_run(self, snapshot: SystemSnapshot, anomaly_count: int) -> str:
        if anomaly_count == 0:
            return "No active anomalies detected"
        return (
            f"{anomaly_count} anomaly finding(s) detected across "
            f"{len(snapshot.cameras)} camera slot(s)"
        )
