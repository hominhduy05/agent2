# SFDS — Durian Sorting & Fault Detection System

A real-time IoT system for durian sorting combined with an AI vision assistant. It consists of two subsystems: **SFDS** (SCADA + YOLO) and **Agent** (Multi-Agent AI).

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Installation](#installation)
3. [Launching the System](#launching-the-system)
4. [LM Studio — LLM Inference Server](#lm-studio--llm-inference-server)
5. [SFDS Backend — SCADA + YOLO Detection](#sfds-backend--scada--yolo-detection)
6. [SFDS Frontend — Dashboard & SCADA UI](#sfds-frontend--dashboard--scada-ui)
7. [Agent Backend — Multi-Agent AI](#agent-backend--multi-agent-ai)
8. [Agent Frontend — AI Assistant UI](#agent-frontend--ai-assistant-ui)
9. [Database & Storage](#database--storage)
10. [API Reference](#api-reference)
11. [Model & Training](#model--training)
12. [WebSocket — Realtime Detection](#websocket--realtime-detection)

---

## System Architecture

```
BROWSER
│
├─── http://localhost:3000 ──────────────────────────────── Agent Frontend (Next.js)
│         │                                                  │
│         │ POST /api/agent/stream (SSE)                    │
│         │ GET  /api/vision/analyze (multipart)             │
│         │ GET  /api/report/list                            │
│         │                                                  │
│         └────────────────┬─────────────────────────────────┘
│                          │ REST / SSE
│              ┌───────────▼───────────┐
│              │   Agent Backend      │  port 8001
│              │   FastAPI + LangGraph │  (Vision Assistant API)
│              │   3 agents:          │
│              │   Vision / Chat /     │
│              │   Report             │
│              └───────────┬───────────┘
│                          │ httpx (calls SFDS health/cameras/stats)
│              ┌───────────▼───────────┐
│              │   SFDS Backend        │  port 9000
│              │   FastAPI + YOLOv8    │  (SCADA Detection API)
│              │   WebSocket Server    │
│              └───────────┬───────────┘
│                          │ httpx (calls LLM)
│              ┌───────────▼───────────┐
│              │   LM Studio          │  port 1234
│              │   LLM Inference      │  (nvidia/nemotron-3-nano-*)
│              └───────────────────────┘
```

### Two Subsystems

| Subsystem | Directory | Description | Port |
|-----------|-----------|-------------|------|
| **SFDS** | `SFDS/` | Real-time SCADA + YOLO detection + Dataset management | 9000 |
| **Agent** | `agent/` | Multi-agent AI assistant (vision analysis, chat, reports) | 8001 |

---

## Installation

### System Requirements

- Python 3.10+
- Node.js / Bun (for frontend)
- CUDA-capable GPU (optional, for faster YOLO inference)
- [LM Studio](https://lmstudio.ai/) (for running LLM locally)

### 1. SFDS Backend

```bash
cd F:/system/SFDS/backend
pip install -r requirements.txt
```

### 2. Agent Backend

```bash
cd F:/system/agent/backend
pip install -r requirements.txt
```

### 3. SFDS Frontend

```bash
cd F:/system/SFDS/frontend
bun install
```

### 4. Agent Frontend

```bash
cd F:/system/agent/frontend
npm install
```

---

## Launching the System

### Required Startup Order

```
1. LM Studio        Load model + Start Server  →  port 1234
2. SFDS Backend     uvicorn main:app           →  port 9000
3. Agent Backend    uvicorn app.main:app       →  port 8001
4. SFDS Frontend    bun run dev                →  port 5173 (or 3000)
5. Agent Frontend   npm run dev                →  port 3000
```

### 1. LM Studio

1. Open LM Studio and download models:
   - `nvidia/nemotron-3-nano-omni` (for Vision Agent)
   - `nvidia/nemotron-3-nano-4b` (for Chat Agent)
   - `qwen/qwen3.5-9b` (for Report Agent)
2. Click **Server** (developer icon in the bottom-left corner) → **Start Server**
3. Default: `http://localhost:1234`

### 2. SFDS Backend

```bash
cd F:/system/SFDS/backend
uvicorn main:app --reload --port 9000
```

- API docs: http://localhost:9000/docs
- Health: http://localhost:9000/health/
- Model auto-loads on startup (`.pt` → `.onnx` → TensorRT)

### 3. Agent Backend

```bash
cd F:/system/agent/backend
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

- API docs: http://localhost:8001/docs
- Health: http://localhost:8001/health
- Agent stream: POST http://localhost:8001/api/agent/stream

### 4. SFDS Frontend

```bash
cd F:/system/SFDS/frontend
bun run dev
```

- Dashboard: http://localhost:5173
- SCADA: http://localhost:5173/scada
- Dataset: http://localhost:5173/dataset

### 5. Agent Frontend

```bash
cd F:/system/agent/frontend
npm run dev
```

- Home: http://localhost:3000
- Chat: http://localhost:3000/chat
- Analyze: http://localhost:3000/analyze
- Reports: http://localhost:3000/reports

---

## LM Studio — LLM Inference Server

LM Studio is a local LLM inference server. Both the **Agent Backend** and **SFDS Backend** call LM Studio via REST API.

### Configuration in Agent Backend

Create the file `agent/backend/.env` if needed:

```env
lm_studio_url=http://localhost:1234/v1/chat/completions
vision_agent_model=nvidia/nemotron-3-nano-omni
chat_agent_model=nvidia/nemotron-3-nano-4b
report_agent_model=qwen/qwen3.5-9b
sfds_base_url=http://localhost:9000
```

### Check LM Studio status

```bash
curl http://localhost:1234/v1/models
```

---

## SFDS Backend — SCADA + YOLO Detection

### Structure

```
SFDS/backend/
├── main.py                    # FastAPI app (port 9000)
├── routers/
│   ├── scada_router.py        # WebSocket, RTSP camera proxy
│   └── dataset_router.py       # Detection, Dataset CRUD
├── core/
│   ├── shared.py              # YOLO engine, schemas
│   ├── database.py             # SQLite models
│   └── sort_tracker.py         # SORT Kalman tracking
├── services/
│   ├── dataset_service.py      # Save images + YOLO labels
│   └── mqtt_publisher.py       # MQTT broker client
├── scripts/
│   ├── train.py               # Train YOLOv8
│   ├── export_model.py        # Export .pt → .onnx
│   └── evaluate_model.py      # Evaluation
└── model/
    ├── durian_yolov8.pt       # YOLOv8 PyTorch (PREFERRED)
    ├── durian_yolov8.onnx     # YOLOv8 ONNX
    ├── durian_yolov8.engine   # TensorRT CUDA
    ├── durian_abc.pt          # ABC grading model (A/B/C)
    └── durian_abc.onnx
```

### Model Loading Priority

| Order | File | Engine | Device |
|-------|------|--------|--------|
| 1 | `durian_yolov8.pt` | YOLOEngine (ultralytics) | CUDA / CPU |
| 2 | `durian_yolov8.onnx` | YOLOEngine (ultralytics) | CUDA / CPU |
| 3 | TensorRT `.engine` | TRTEngine (ONNX Runtime CUDA) | CUDA only |

### Detection Classes

```
defective  → rotten, damaged
immature   → unripe
mature     → ripe
```

### Quality Gate (WebSocket)

When a frame is received via WebSocket, the system runs through a **Quality Gate** to ensure only high-quality frames proceed to classification:

1. **Blur check** — cv2.Laplacian variance >= 40
2. **ROI check** — fruit center is within 18%–82% (x) and 16%–84% (y)
3. **Edge margin** — fruit is at least 3.5% away from frame edges
4. **Area ratio** — fruit size is 2%–75% of frame area
5. **Stability** — fruit remains at the same position for 2+ consecutive frames

If all checks pass → the result is sent back to the client via WebSocket.

### SORT Tracker

Uses **SORT (Simple Online and Realtime Tracking)** to assign IDs to each fruit and count unique items:

- **Kalman Filter** — predicts position in the next frame
- **Hungarian Algorithm** — matches detections to existing tracks
- **IOU Matching** — only matches if IOU >= 0.3

---

## SFDS Frontend — Dashboard & SCADA UI

### Structure

```
SFDS/frontend/
├── app/
│   ├── page.tsx               # Root → redirect /dashboard
│   ├── dashboard/             # Overview page
│   ├── scada/                 # Realtime camera + detection
│   └── dataset/               # Image collection + labeling
├── components/
│   ├── scada/                 # Camera, detection overlay
│   ├── dashboard/
│   └── ui/
└── lib/
    ├── api.ts                 # REST API calls
    ├── scada-camera.ts        # Camera capture + WebSocket
    ├── ws-client.ts           # WebSocket client
    └── types.ts
```

### Main Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Overview of KPIs, charts, statistics |
| `/scada` | Realtime camera, durian detection |
| `/dataset` | Image collection + YOLO labeling |

---

## Agent Backend — Multi-Agent AI

### Multi-Agent Architecture (LangGraph)

```
User message
    │
    ▼
┌─────────────────┐
│ supervisor_node │  ← Keyword routing
└───────┬─────────┘
        │
        ├── image? ────────────→ vision_agent ──→ END
        ├── report/pdf? ───────→ report_agent ──→ END
        └── default ───────────→ chat_agent ────→ END

chat_agent tools:    get_sfds_health, get_sfds_cameras, get_sfds_stats,
                     get_chat_history, get_current_sfds_status

vision_agent tools:  analyze_image, extract_dashboard_metrics,
                     diagnose_error, get_sfds_health, get_sfds_cameras

report_agent tools:  generate_report (PDF / DOCX / HTML)
```

### ReAct Loop

Each agent uses **ReAct** (Reason + Act) — the LLM iterates through the following loop:

```
LLM analyzes message
    │
    ├── No tool needed → Reply with text
    │
    └── Tool needed → Call tool function → Get result
         │
         ▼
    LLM reasons further with tool result
         │
         ├── Another tool? → Repeat
         └── Final answer
```

### Structure

```
agent/backend/app/
├── main.py                  # FastAPI bootstrap
├── core/config.py           # Settings + system prompts
├── api/v1/
│   ├── api.py               # Router aggregation
│   └── endpoints/
│       ├── chat.py          # /api/chat/* (offline mode)
│       ├── agent.py         # /api/agent/* (multi-agent)
│       ├── vision.py        # /api/vision/*
│       ├── report.py        # /api/report/*
│       └── sfds.py          # /api/sfds/*
├── agents/
│   ├── graph.py             # LangGraph state machine
│   ├── router.py            # Agent streaming endpoint
│   ├── base.py              # LMStudio LLM wrapper
│   ├── state.py             # AgentState TypedDict
│   ├── session.py           # Session manager
│   └── tools/
│       ├── sfds.py          # SFDS tools (health, cameras, stats)
│       ├── chat.py          # Chat tools (history, status)
│       ├── vision.py        # Vision tools (analyze, diagnose)
│       └── report.py        # Report tool (PDF/DOCX/HTML)
├── services/
│   ├── llm_service.py       # Direct LLM calls (bypassing agent)
│   ├── sfds_service.py      # Proxy SFDS backend
│   ├── report_service.py    # Generate PDF/DOCX/HTML
│   └── sfds_event_store.py  # In-memory event log
└── schemas/schemas.py
```

### Available Tools

| Tool | Agent | Description |
|------|-------|-------------|
| `get_sfds_health` | chat, vision | Get SFDS backend status |
| `get_sfds_cameras` | chat, vision | Get camera configuration |
| `get_sfds_stats` | chat, vision | Get dataset statistics |
| `get_chat_history` | chat | Retrieve conversation history |
| `get_current_sfds_status` | chat | Retrieve current SFDS status |
| `analyze_image` | vision | Analyze image with vision LLM |
| `extract_dashboard_metrics` | vision | Extract metrics from dashboard image |
| `diagnose_error` | vision | Diagnose errors from image |
| `generate_report` | report | Generate PDF / DOCX / HTML report |

---

## Agent Frontend — AI Assistant UI

### Structure

```
agent/frontend/src/
├── app/
│   ├── page.tsx             # Home - overview + quick actions
│   ├── layout.tsx           # Root layout
│   ├── globals.css          # Global styles
│   ├── chat/page.tsx        # Chat assistant
│   ├── analyze/page.tsx     # Image analysis
│   └── reports/page.tsx     # Report list & download
├── components/
│   ├── AppShell.tsx         # Main layout wrapper
│   ├── StatusPill.tsx       # Status indicator
│   ├── ChatAssistant.tsx    # Main chat component
│   └── chat/
│       ├── ChatContainer.tsx
│       ├── ChatInput.tsx
│       ├── ChatMessages.tsx
│       └── MarkdownContent.tsx
└── lib/
    └── api.ts               # Backend API calls
```

### Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview, system status pills, quick actions |
| `/chat` | Chat Assistant — Q&A with multi-agent |
| `/analyze` | Image analysis — upload/capture + select analysis type |
| `/analyze?tab=dashboard` | Dashboard reader — extract metrics |
| `/analyze?tab=error` | Error diagnosis |
| `/reports` | Report list + download PDF/DOCX/HTML |

---

## Database & Storage

### SFDS Backend Database

SQLite at `SFDS/backend/durian.db`:

| Table | Description |
|-------|-------------|
| `employees` | User accounts (admin/inspector) |
| `inspection_logs` | Inspection history |
| `kpi_targets` | KPI targets |
| `shifts` | Production shifts |
| `alarm_logs` | Alarm log |
| `trace_logs` | Fruit traceability |

Default admin: `admin` / `admin123`

### Dataset Storage

`SFDS/backend/dataset/`:

```
dataset/
├── images/
│   ├── export_criteria/      A/ B/ C/ D (ABCD grading)
│   └── condition/           Green/ Frosted/ Ripe/ Damaged/ Rotten
└── labels/                  (YOLO format .txt)
```

### Agent Report Storage

`agent/backend/storage/`:

```
storage/
├── images/                   Analyzed images
└── reports/                  Generated PDF/DOCX/HTML
```

---

## API Reference

### SFDS Backend (port 9000)

#### Detection

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/detect/` | Upload image → YOLO detection |
| POST | `/api/scada/detect/{slot}/` | Detect frame from IP camera slot |
| POST | `/api/detect/batch/` | Batch detection |

#### SCADA — RTSP Camera

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/scada/cameras/` | Get configuration of 4 RTSP slots |
| POST | `/api/scada/cameras/` | Save RTSP URL configuration |
| GET | `/api/scada/frame/{slot}/` | Read one JPEG frame from IP camera |
| POST | `/api/scada/cameras/{slot}/start/` | Start IP camera |
| POST | `/api/scada/cameras/{slot}/stop/` | Stop IP camera |
| WS | `/ws/scada/detect/{slot}/` | Realtime detection via WebSocket |

#### Dataset

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dataset/save-face/` | Save image + YOLO labels |
| GET | `/api/dataset/items/` | List items |
| GET | `/api/dataset/stats/` | Statistics by label |
| DELETE | `/api/dataset/items/{cat}/{label}/{file}/` | Delete item |
| GET | `/api/dataset/export/` | Export dataset as ZIP |
| GET | `/api/dataset/data-yaml/` | Generate `data.yaml` |

### Agent Backend (port 8001)

#### Vision

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/vision/analyze` | Analyze image |
| POST | `/api/vision/dashboard` | Extract dashboard metrics |
| POST | `/api/vision/error` | Diagnose error |
| POST | `/api/vision/camera` | Analyze camera frame |

#### Chat (offline mode — bypassing agent)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat/message` | Send message (sync) |
| POST | `/api/chat/stream` | Send message (streaming SSE) |
| GET | `/api/chat/history/{session_id}` | Get history |

#### Agent (multi-agent mode)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/agent/stream` | Stream multi-agent response (SSE) |
| GET | `/api/agent/models` | List models |
| GET | `/api/agent/session/{session_id}` | Get session info |
| GET | `/api/agent/sessions` | List sessions |
| DELETE | `/api/agent/session/{session_id}` | Delete session |

#### Report

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/report/generate` | Generate report |
| GET | `/api/report/list` | List reports |
| GET | `/api/report/download/{report_id}` | Download report |

#### SFDS Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sfds/health` | Check SFDS online/offline |
| GET | `/api/sfds/cameras` | Proxy get cameras |
| GET | `/api/sfds/stats` | Proxy get stats |
| POST | `/api/sfds/events` | Send event |
| GET | `/api/sfds/events` | Get event log |

---

## WebSocket — Realtime Detection

```
ws://localhost:9000/ws/scada/detect/{slot}/
```

**Client → Server:**

```json
{ "type": "frame", "data": "<base64 jpeg>" }
{ "type": "set_confidence", "value": 0.25 }
{ "type": "ping" }
```

**Server → Client:**

```json
// Quality status (not yet met)
{
  "type": "quality_status",
  "slot": 0,
  "phase": "tracking",
  "reason": "waiting_for_stability",
  "blur_score": 85.2,
  "stable_frames": 1,
  "checks": { "area_ok": true, "roi_ok": true, ... }
}

// Detection result (met)
{
  "type": "result",
  "slot": 0,
  "detections": [
    { "x1": 0, "y1": 0, "x2": 100, "y2": 200,
      "confidence": 0.92, "class_name": "mature" }
  ],
  "image_width": 640,
  "image_height": 480,
  "unique_mature": 1,
  "unique_immature": 0,
  "unique_defective": 0,
  "quality": { "phase": "captured", "reason": "frame_accepted", "blur_score": 85.2 }
}
```

---

## Model & Training

### YOLO Label Format

Each line: `class_id x_center y_center width height` (normalized 0 → 1)

```
0 0.5123 0.4876 0.2341 0.3187
```

### Class IDs

**export_criteria:**

| ID | Label |
|----|-------|
| 0 | A |
| 1 | B |
| 2 | C |
| 3 | D |

**condition:**

| ID | Label |
|----|-------|
| 0 | Green |
| 1 | Frosted |
| 2 | Ripe |
| 3 | Damaged |
| 4 | Rotten |

### Training

```bash
cd F:/system/SFDS/backend
python scripts/train.py
```

The model is saved to `backend/model/durian_yolov8.pt`.

### Export to ONNX

```bash
cd F:/system/SFDS/backend
python scripts/export_model.py
```

### Export to TensorRT (requires CUDA GPU)

```bash
cd F:/system/SFDS/backend
python -c "
from ultralytics import YOLO
model = YOLO('model/durian_yolov8.pt')
model.export(format='engine')
"
```

---

## Notes

- `bun run lint` on the SFDS frontend may fail because `next lint` has been deprecated (Next.js 15).
- `bun run build` may hang on Windows. Prefer `dev`.
- Both SFDS Backend and Agent Backend require LM Studio to be running in order to function properly.
- The dataset export format is YOLO standard and is compatible with `yolo detect train`.
