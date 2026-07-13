# SFDS Agentic AI Scaffold

This folder is a staging scaffold for the SFDS Agentic AI supervision layer.
It is intentionally kept outside the live SFDS runtime until the structure is
reviewed and then wired into `SFDS/backend` and `SFDS/frontend`.

The MVP follows these rules:

- Real-time sorting and hardware control stay deterministic.
- The agent observes, analyzes, explains, recommends, and audits.
- The agent does not directly execute relay, cylinder, or emergency actions.
- Unknown, forbidden, and confirmation-required actions are blocked by policy.
- Numeric operational data must come from SFDS services, database, or logs.

## Layout

```text
agentic/
  backend/
    agentic/
      runtime/            Orchestration and run lifecycle
      agents/supervisor/  Deterministic MVP supervisor explanation layer
      monitors/           Snapshot collection adapters for SFDS services
      analyzers/          Rule-based anomaly detection
      actions/            Registry and safe executor
      policies/           Thresholds, permissions, approval checks
      memory/             MVP in-memory event store with alert deduplication
      schemas/            Pydantic API and internal schemas
    routers/
      agent_router.py     FastAPI router to copy/wire into SFDS backend
  frontend/
    app/(admin)/agent/    Next.js admin page scaffold
    components/agent/     Agent overview, alerts, recommendations, timeline
    lib/                  Agent API client and TypeScript types
  tests/                  Safety and anomaly rule tests
```

## Integration target

After review, the backend package can be moved or copied to:

```text
SFDS/backend/agentic/
SFDS/backend/routers/agent_router.py
```

Then wire the router in `SFDS/backend/main.py`:

```python
from routers.agent_router import router as agent_router

app.include_router(agent_router)
```

The frontend scaffold maps to:

```text
SFDS/frontend/app/(admin)/agent/
SFDS/frontend/components/agent/
SFDS/frontend/lib/agent-api.ts
SFDS/frontend/lib/agent-types.ts
```

## MVP endpoints

The router scaffold exposes only working MVP endpoints:

```text
GET  /api/agent/status
POST /api/agent/runs
GET  /api/agent/runs
GET  /api/agent/alerts
POST /api/agent/alerts/{alert_id}/acknowledge
GET  /api/agent/recommendations
GET  /api/agent/actions
POST /api/agent/actions
```

