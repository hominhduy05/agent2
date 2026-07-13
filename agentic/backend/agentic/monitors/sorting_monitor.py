from __future__ import annotations

from agentic.schemas.snapshot import SortingSnapshot


def collect_sorting_snapshot() -> tuple[SortingSnapshot, list[str]]:
    errors: list[str] = []
    try:
        from services.esp32_relay_controller import get_esp32_relay_status
        from services.sorting_controller import get_recent_sorting_commands, get_sorting_config

        config = get_sorting_config()
        commands = get_recent_sorting_commands(50)
        esp32 = get_esp32_relay_status()
        failures = [
            command for command in commands
            if (command.get("hardware") or {}).get("sent") is False
            and command.get("action") == "relay_pulse"
        ]
        snapshot = SortingSnapshot(
            status="ok",
            enabled=bool(config.get("enabled")),
            dry_run=bool(config.get("dry_run", True)),
            routes=config.get("routes", {}),
            recent_command_count=len(commands),
            recent_failures=len(failures),
            esp32_connected=bool(esp32.get("connected")),
            esp32_status=esp32,
        )
        return snapshot, errors
    except Exception as exc:
        errors.append(f"sorting monitor unavailable: {exc}")
        return SortingSnapshot(status="unavailable", error=str(exc)), errors

