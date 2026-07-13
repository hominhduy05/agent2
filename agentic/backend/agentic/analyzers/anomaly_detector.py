from __future__ import annotations

from agentic.policies.thresholds import AgenticThresholds
from agentic.schemas.alert import AlertFinding, AlertSeverity
from agentic.schemas.snapshot import SystemSnapshot


class AnomalyDetector:
    def __init__(self, thresholds: AgenticThresholds | None = None) -> None:
        self.thresholds = thresholds or AgenticThresholds.from_env()

    def detect(self, snapshot: SystemSnapshot) -> list[AlertFinding]:
        findings: list[AlertFinding] = []
        findings.extend(self._detect_backend(snapshot))
        findings.extend(self._detect_cameras(snapshot))
        findings.extend(self._detect_sorting(snapshot))
        findings.extend(self._detect_audit(snapshot))
        return findings

    def _detect_backend(self, snapshot: SystemSnapshot) -> list[AlertFinding]:
        findings: list[AlertFinding] = []
        if not snapshot.model.loaded:
            findings.append(AlertFinding(
                code="MODEL_NOT_LOADED",
                severity=AlertSeverity.CRITICAL,
                title="Vision model is not loaded",
                message="The backend reports that the detection model is unavailable.",
                source="health_monitor",
                deduplication_key="MODEL_NOT_LOADED",
                evidence=snapshot.model.model_dump(),
            ))
        if not snapshot.database.available:
            findings.append(AlertFinding(
                code="DATABASE_DEGRADED",
                severity=AlertSeverity.CRITICAL,
                title="Database is unavailable or degraded",
                message="The system snapshot could not confirm database availability.",
                source="health_monitor",
                deduplication_key="DATABASE_DEGRADED",
                evidence=snapshot.database.model_dump(),
            ))
        return findings

    def _detect_cameras(self, snapshot: SystemSnapshot) -> list[AlertFinding]:
        findings: list[AlertFinding] = []
        for camera in snapshot.cameras:
            if camera.configured and not camera.online:
                findings.append(AlertFinding(
                    code="CAMERA_OFFLINE",
                    severity=AlertSeverity.WARNING,
                    title=f"Camera {camera.slot + 1} appears offline",
                    message="A configured camera is not reporting online health.",
                    source="camera_monitor",
                    camera_slot=camera.slot,
                    deduplication_key=f"CAMERA_OFFLINE:{camera.slot}",
                    evidence=camera.model_dump(),
                ))
            if camera.online and camera.latency_ms is not None:
                severity = None
                if camera.latency_ms >= self.thresholds.camera_latency_critical_ms:
                    severity = AlertSeverity.CRITICAL
                elif camera.latency_ms >= self.thresholds.camera_latency_warning_ms:
                    severity = AlertSeverity.WARNING
                if severity:
                    findings.append(AlertFinding(
                        code="CAMERA_LATENCY_HIGH",
                        severity=severity,
                        title=f"Camera {camera.slot + 1} latency is high",
                        message="Camera frame acquisition latency exceeds configured thresholds.",
                        source="camera_monitor",
                        camera_slot=camera.slot,
                        deduplication_key=f"CAMERA_LATENCY_HIGH:{camera.slot}",
                        evidence={
                            **camera.model_dump(),
                            "warning_ms": self.thresholds.camera_latency_warning_ms,
                            "critical_ms": self.thresholds.camera_latency_critical_ms,
                        },
                    ))
        return findings

    def _detect_sorting(self, snapshot: SystemSnapshot) -> list[AlertFinding]:
        findings: list[AlertFinding] = []
        if snapshot.sorting.enabled and not snapshot.sorting.esp32_connected:
            findings.append(AlertFinding(
                code="ESP32_DISCONNECTED",
                severity=AlertSeverity.CRITICAL,
                title="ESP32 relay controller is disconnected",
                message="Sorting is enabled but relay controller health is not connected.",
                source="sorting_monitor",
                deduplication_key="ESP32_DISCONNECTED",
                evidence=snapshot.sorting.model_dump(),
            ))
        if snapshot.sorting.enabled and snapshot.sorting.dry_run:
            findings.append(AlertFinding(
                code="SORTING_DRY_RUN_ACTIVE",
                severity=AlertSeverity.INFO,
                title="Sorting is enabled while dry-run is active",
                message="Commands will be generated but not sent to hardware.",
                source="sorting_monitor",
                deduplication_key="SORTING_DRY_RUN_ACTIVE",
                evidence=snapshot.sorting.model_dump(),
            ))
        return findings

    def _detect_audit(self, snapshot: SystemSnapshot) -> list[AlertFinding]:
        if snapshot.audit.detection_count < self.thresholds.confidence_minimum_sample_size:
            return []
        if snapshot.audit.average_confidence >= self.thresholds.confidence_minimum_average:
            return []
        return [AlertFinding(
            code="LOW_CONFIDENCE_AVERAGE",
            severity=AlertSeverity.WARNING,
            title="Average detection confidence is low",
            message="Average confidence is below the configured minimum for the audit window.",
            source="audit_monitor",
            deduplication_key="LOW_CONFIDENCE_AVERAGE",
            evidence={
                **snapshot.audit.model_dump(),
                "minimum_average": self.thresholds.confidence_minimum_average,
                "minimum_sample_size": self.thresholds.confidence_minimum_sample_size,
            },
        )]

