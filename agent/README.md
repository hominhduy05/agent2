# Vision Assistant

AI-powered vision analysis for SCADA/IoT systems using **nvidia/nemotron-3-nano-omni** via **LM Studio**. Powered by a LangGraph multi-agent architecture with real-time SSE streaming.

Features: image analysis, dashboard OCR, error diagnosis, report generation (PDF/DOCX/HTML), and chat-based operation support.

---

## Prerequisites

1. **LM Studio** installed
2. Model **`nvidia/nemotron-3-nano-omni`** loaded in LM Studio
   - Download **both** the GGUF file and the `mmproj` file (multimodal projector — required for vision)
   - Make sure the model is loaded and the server is running (localhost:1234)
3. **SFDS backend** running on port 9000 (optional — only for SFDS proxy)
4. Python 3.10+, Node.js 18+, Bun 1.0+

---

## Quick Start

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8001
```

API docs: http://localhost:8001/docs

### 2. Frontend

```bash
cd frontend
bun install
bun run dev
```

Open: http://localhost:3000

---

## Environment Variables

Create `backend/.env` (optional — defaults work for local):

```
LM_STUDIO_URL=http://localhost:1234/v1/chat/completions
LM_MODEL=nvidia/nemotron-3-nano-omni
MAX_TOKENS=2048
TEMPERATURE=0.3
SFDS_BASE_URL=http://localhost:9000
```

Frontend: create `frontend/.env.local`:

```
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

## Architecture

### System Overview

```
Next.js (:3000) <---> FastAPI (:8001) <---> LM Studio (:1234)
                           |
              +------------+------------+
              |                         |
         SFDS (:9000)            Report Storage
```

### Multi-Agent System (LangGraph)

The backend uses a LangGraph supervisor graph to orchestrate specialized agents:

```
User Input
    │
    ▼
┌──────────────┐
│  Supervisor  │ ─── intent classification
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
Vision Chat Report
Agent Agent  Agent
  │      │      │
  └── Tools ──┘
       │
       ▼
   SSE Stream
```

**Agents:**

| Agent | Role | Tools |
|---|---|---|
| `vision_agent` | Computer vision expert for SCADA/IoT | `analyze_image`, `extract_dashboard_metrics`, `diagnose_error`, SFDS tools |
| `chat_agent` | Operations assistant for durian sorting system | SFDS tools, `get_chat_history`, `get_current_sfds_status` |
| `report_agent` | Report generation specialist | `generate_report` (PDF/DOCX/HTML) |

**Tool Registry** (`backend/agents/tools/`):

- **Vision:** `analyze_image`, `extract_dashboard_metrics`, `diagnose_error`
- **SFDS:** `get_sfds_health`, `get_sfds_cameras`, `get_sfds_stats`
- **Report:** `generate_report`
- **Chat:** `get_chat_history`, `get_current_sfds_status`

**Session Management:** `AgentSessionManager` maintains conversation state per session.

---

## API Endpoints

### Legacy REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/vision/analyze` | General image analysis |
| `POST` | `/api/vision/dashboard` | Dashboard metric extraction |
| `POST` | `/api/vision/error` | Error image diagnosis |
| `POST` | `/api/vision/camera` | Camera frame analysis |
| `POST` | `/api/report/generate` | Generate report (PDF/DOCX/HTML) |
| `GET` | `/api/report/list` | List generated reports |
| `GET` | `/api/report/download/{id}` | Download report file |
| `POST` | `/api/chat/message` | Send chat message |
| `GET` | `/api/chat/history/{session_id}` | Get session history |
| `GET` | `/api/sfds/cameras` | SFDS camera list |
| `GET` | `/api/sfds/stats` | SFDS statistics |
| `GET` | `/api/sfds/health` | SFDS health status |
| `GET` | `/health` | Backend health check |

### Agent Streaming API (SSE)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agent/stream` | Stream multi-agent response via SSE |
| `GET` | `/api/agent/session/{id}` | Get session info and history |
| `GET` | `/api/agent/sessions` | List all active sessions |
| `DELETE` | `/api/agent/session/{id}` | Delete a session |

**SSE Stream format:**

```bash
# Request
POST /api/agent/stream
{"message": "...", "session_id": "...", "image_b64": "..."}

# Response (SSE)
data: {"type": "start", "session_id": "..."}
data: {"type": "token", "content": "..."}  # token-by-token
data: {"type": "done", "content": "...", "session_id": "..."}
data: [DONE]
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Image Analysis** | Upload any image — LLM analyzes SCADA/IoT components |
| **Dashboard Reader** | Upload dashboard screenshot — extract all metrics and values |
| **Error Diagnosis** | Upload error image — get root cause + remediation steps |
| **Camera Capture** | Take a photo from webcam — real-time analysis |
| **Report Generation** | Generate PDF, DOCX, or HTML reports from any analysis |
| **Chat Assistant** | Text-based operation support with session memory |
| **SFDS Proxy** | Pull camera/detection data from your SFDS backend |
| **Agent Orchestration** | Supervisor graph routes requests to the right agent |
| **SSE Streaming** | Token-by-token streaming for real-time responses |

---

## SFDS Integration

Vision Assistant can proxy requests to your SFDS backend (port 9000):

- `GET /api/sfds/cameras` — camera configuration
- `GET /api/sfds/stats` — dataset statistics
- `GET /api/sfds/health` — connection status

Chat and vision agents can call these tools autonomously to enrich their responses with live SFDS data.

---

## Model Notes

`nvidia/nemotron-3-nano-omni` is a 30B-A3B hybrid MoE model with native vision (OCR, GUI understanding), audio, and text support. Minimum 25GB RAM recommended.

If vision fails, make sure you loaded **both** the main GGUF file and the `mmproj` multimodal projector file in LM Studio.
