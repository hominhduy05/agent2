from __future__ import annotations

import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from agentic.actions import ActionExecutor, build_default_registry  # noqa: E402
from agentic.analyzers import AnomalyDetector  # noqa: E402
from agentic.memory import InMemoryAgentStore  # noqa: E402
from agentic.policies.thresholds import AgenticThresholds  # noqa: E402
from agentic.schemas.action import ActionRequest, ActionStatus  # noqa: E402
from agentic.schemas.snapshot import CameraSnapshot, ModelSnapshot, SystemSnapshot  # noqa: E402


class AgenticMvpTests(unittest.TestCase):
    def test_camera_offline_alert_is_deduplicated(self) -> None:
        store = InMemoryAgentStore()
        detector = AnomalyDetector()
        snapshot = SystemSnapshot(
            model=ModelSnapshot(status="ok", loaded=True),
            cameras=[
                CameraSnapshot(
                    camera_id="camera_2",
                    slot=2,
                    configured=True,
                    online=False,
                    message="open_failed",
                )
            ],
        )

        first = detector.detect(snapshot)[0]
        second = detector.detect(snapshot)[0]
        saved_first = store.upsert_alert(first)
        saved_second = store.upsert_alert(second)

        self.assertEqual(saved_first.alert_id, saved_second.alert_id)
        self.assertEqual(len(store.list_alerts()), 1)

    def test_latency_threshold_uses_configuration(self) -> None:
        detector = AnomalyDetector(AgenticThresholds(
            camera_latency_warning_ms=100,
            camera_latency_critical_ms=200,
        ))
        snapshot = SystemSnapshot(
            model=ModelSnapshot(status="ok", loaded=True),
            cameras=[
                CameraSnapshot(
                    camera_id="camera_0",
                    slot=0,
                    configured=True,
                    online=True,
                    latency_ms=220,
                )
            ],
        )

        findings = detector.detect(snapshot)

        self.assertTrue(any(item.code == "CAMERA_LATENCY_HIGH" for item in findings))
        self.assertEqual(
            next(item for item in findings if item.code == "CAMERA_LATENCY_HIGH").severity,
            "critical",
        )

    def test_forbidden_action_is_rejected(self) -> None:
        executor = ActionExecutor(build_default_registry())
        result = executor.execute(ActionRequest(action_key="ARBITRARY_RELAY_COMMAND"))

        self.assertEqual(result.status, ActionStatus.REJECTED)

    def test_confirm_required_action_needs_approval(self) -> None:
        executor = ActionExecutor(build_default_registry())
        result = executor.execute(ActionRequest(action_key="FINALIZE_BATCH"))

        self.assertEqual(result.status, ActionStatus.PENDING_APPROVAL)


if __name__ == "__main__":
    unittest.main()

