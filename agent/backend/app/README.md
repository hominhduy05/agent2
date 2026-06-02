# Backend Application Layout

Preferred backend source package:

```text
app/
  main.py                 FastAPI app bootstrap and middleware
  core/                   Settings and shared configuration
  api/v1/api.py           Versioned router aggregation
  api/v1/endpoints/       HTTP endpoint modules
  schemas/                Pydantic request/response schemas
  services/               External integrations and business services
  agents/                 Multi-agent orchestration, graph state, tools
```

Run from the `backend` directory:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

`backend/main.py` remains as a compatibility shim for `uvicorn main:app`.

