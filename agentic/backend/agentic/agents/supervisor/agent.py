from __future__ import annotations

from agentic.schemas.alert import AlertFinding
from agentic.schemas.recommendation import Recommendation
from agentic.schemas.snapshot import SystemSnapshot


class SupervisorAgent:
    """MVP supervisor.

    This implementation is deterministic. A future LLM-backed version should
    preserve the same structured output and must only use registered read-only
    tools unless a policy-approved action is explicitly requested.
    """

    def recommend(
        self,
        snapshot: SystemSnapshot,
        findings: list[AlertFinding],
    ) -> list[Recommendation]:
        recommendations: list[Recommendation] = []
        for finding in findings:
            recommendation = self._recommend_for_finding(snapshot, finding)
            recommendations.append(recommendation)
        return recommendations

    def _recommend_for_finding(
        self,
        snapshot: SystemSnapshot,
        finding: AlertFinding,
    ) -> Recommendation:
        if finding.code == "CAMERA_OFFLINE":
            return Recommendation(
                alert_id=finding.alert_id,
                priority=1,
                recommendation=(
                    "Recheck camera health, verify RTSP/network reachability, "
                    "then inspect power and cable connection for the affected slot."
                ),
                action_key="RECHECK_HEALTH",
                evidence_keys=["configured", "online", "message", "url"],
            )
        if finding.code == "CAMERA_LATENCY_HIGH":
            return Recommendation(
                alert_id=finding.alert_id,
                priority=2,
                recommendation=(
                    "Inspect camera network latency and reduce frame load if the "
                    "latency remains above threshold."
                ),
                action_key="RECHECK_HEALTH",
                evidence_keys=["latency_ms", "warning_ms", "critical_ms"],
            )
        if finding.code == "MODEL_NOT_LOADED":
            return Recommendation(
                alert_id=finding.alert_id,
                priority=1,
                recommendation="Verify model path, backend startup logs, and inference device availability.",
                action_key="READ_RECENT_LOGS",
                evidence_keys=["loaded", "device", "model_format"],
            )
        if finding.code == "ESP32_DISCONNECTED":
            return Recommendation(
                alert_id=finding.alert_id,
                priority=1,
                recommendation=(
                    "Check ESP32 relay port, baud rate, USB connection, and controller "
                    "status before enabling production sorting."
                ),
                action_key="RECHECK_HEALTH",
                evidence_keys=["enabled", "esp32_connected", "esp32_status"],
            )
        if finding.code == "SORTING_DRY_RUN_ACTIVE":
            return Recommendation(
                alert_id=finding.alert_id,
                priority=3,
                recommendation=(
                    "Confirm whether the current run is a demo/test. Dry-run is safe "
                    "for validation but will not actuate hardware."
                ),
                evidence_keys=["enabled", "dry_run"],
            )
        if finding.code == "LOW_CONFIDENCE_AVERAGE":
            return Recommendation(
                alert_id=finding.alert_id,
                priority=2,
                recommendation=(
                    "Review recent detections by camera, inspect lighting and fruit "
                    "positioning, and compare confidence by grade."
                ),
                action_key="RECHECK_HEALTH",
                evidence_keys=["average_confidence", "detection_count", "grade_counts"],
            )
        return Recommendation(
            alert_id=finding.alert_id,
            priority=3,
            recommendation="Review the attached evidence and run a fresh health check.",
            action_key="RECHECK_HEALTH",
        )

