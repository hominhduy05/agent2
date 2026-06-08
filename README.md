# SFDS — Durian Sorting & Fault Detection System

He thong IoT thoi gian thuc phan loai sau rieng ket hop AI vision assistant. Bao gom 2 he thong con: **SFDS** (SCADA + YOLO) va **Agent** (Multi-Agent AI).

---

## Muc luc

1. [Kien truc tong quan](#kien-truc-tong-quan)
2. [Cai dat](#cai-dat)
3. [Khoi dong he thong](#khoi-dong-he-thong)
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

## Kien truc tong quan

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
│                          │ httpx (gọi SFDS health/cameras/stats)
│              ┌───────────▼───────────┐
│              │   SFDS Backend        │  port 9000
│              │   FastAPI + YOLOv8    │  (SCADA Detection API)
│              │   WebSocket Server    │
│              └───────────┬───────────┘
│                          │ httpx (gọi LLM)
│              ┌───────────▼───────────┐
│              │   LM Studio          │  port 1234
│              │   LLM Inference      │  (nvidia/nemotron-3-nano-*)
│              └───────────────────────┘
```

### Hai he thong con

| He thong | Thu muc | Mo ta | Port |
|----------|---------|-------|------|
| **SFDS** | `SFDS/` | SCADA realtime + YOLO detection + Dataset management | 9000 |
| **Agent** | `agent/` | Multi-agent AI assistant (vision analysis, chat, reports) | 8001 |

---

## Cai dat

### Yeu cau he thong

- Python 3.10+
- Node.js / Bun (cho frontend)
- GPU CUDA (tuy chon, de tang toc do YOLO inference)
- [LM Studio](https://lmstudio.ai/) (chay LLM locally)

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

## Khoi dong he thong

### Thứ tự bắt buộc

```
1. LM Studio        Load model + Start Server  →  port 1234
2. SFDS Backend     uvicorn main:app           →  port 9000
3. Agent Backend    uvicorn app.main:app       →  port 8001
4. SFDS Frontend    bun run dev                →  port 5173 (hoặc 3000)
5. Agent Frontend   npm run dev                →  port 3000
```

### 1. LM Studio

1. Mo LM Studio, tai model:
   - `nvidia/nemotron-3-nano-omni` (cho Vision Agent)
   - `nvidia/nemotron-3-nano-4b` (cho Chat Agent)
   - `qwen/qwen3.5-9b` (cho Report Agent)
2. Bam **Server** (bien tuong goc trai duoi) → **Start Server**
3. Mac dinh: `http://localhost:1234`

### 2. SFDS Backend

```bash
cd F:/system/SFDS/backend
uvicorn main:app --reload --port 9000
```

- API docs: http://localhost:9000/docs
- Health: http://localhost:9000/health/
- Model tu dong load khi start (`.pt` → `.onnx` → TensorRT)

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

- Trang chu: http://localhost:3000
- Chat: http://localhost:3000/chat
- Analyze: http://localhost:3000/analyze
- Reports: http://localhost:3000/reports

---

## LM Studio — LLM Inference Server

LM Studio la Local LLM inference server. Ca **Agent Backend** va **SFDS Backend** deu goi LM Studio qua REST API.

### Cau hinh trong Agent Backend

Tao file `agent/backend/.env` neu can:

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

### Cau truc

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
│   ├── dataset_service.py      # Luu anh + YOLO labels
│   └── mqtt_publisher.py       # MQTT broker client
├── scripts/
│   ├── train.py               # Train YOLOv8
│   ├── export_model.py        # Export .pt → .onnx
│   └── evaluate_model.py      # Evaluation
└── model/
    ├── durian_yolov8.pt       # YOLOv8 PyTorch (UU TIEN)
    ├── durian_yolov8.onnx     # YOLOv8 ONNX
    ├── durian_yolov8.engine   # TensorRT CUDA
    ├── durian_abc.pt          # ABC grading model (A/B/C)
    └── durian_abc.onnx
```

### Model loading priority

| Thu tu | File | Engine | Thiet bi |
|--------|------|--------|----------|
| 1 | `durian_yolov8.pt` | YOLOEngine (ultralytics) | CUDA / CPU |
| 2 | `durian_yolov8.onnx` | YOLOEngine (ultralytics) | CUDA / CPU |
| 3 | TensorRT `.engine` | TRTEngine (ONNX Runtime CUDA) | CUDA only |

### Classes nhan dien

```
defective  → hu, sau ray
immature   → chua chin
mature     → chin
```

### Quality Gate (WebSocket)

Khi nhan frame qua WebSocket, he thong di qua **Quality Gate** de dam bao chi frame chat luong moi duoc dem ra phan loai:

1. **Blur check** — cv2.Laplacian variance >= 40
2. **ROI check** — tam trai cay nam trong vung 18%-82% (x) va 16%-84% (y)
3. **Edge margin** — trai cay cach bien frame >= 3.5%
4. **Area ratio** — kich thuoc trai cay 2%-75% dien tich frame
5. **Stability** — trai cay o nhu cung vi tri trong 2+ frame lien tiep

Neu tat ca check deu pass → gui ket qua ve client qua WebSocket.

### SORT Tracker

Dung **SORT (Simple Online and Realtime Tracking)** de danh ID cho tung trai cay va dem so luong khong trung lap:

- **Kalman Filter** — du doan vi tri frame tiep theo
- **Hungarian Algorithm** — gan detection vao track hien co
- **IOU Matching** — chi ghep neu IOU >= 0.3

---

## SFDS Frontend — Dashboard & SCADA UI

### Cau truc

```
SFDS/frontend/
├── app/
│   ├── page.tsx               # Root → redirect /dashboard
│   ├── dashboard/             # Trang tong quan
│   ├── scada/                 # Camera realtime + detection
│   └── dataset/               # Thu thap anh + gan nhan
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

### Cac trang chinh

| Route | Mo ta |
|-------|-------|
| `/dashboard` | Tong quan KPI, bieu do, thong ke |
| `/scada` | Camera realtime, detection sau rieng |
| `/dataset` | Thu thap anh + gan nhan YOLO |

---

## Agent Backend — Multi-Agent AI

### Kien truc Multi-Agent (LangGraph)

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

Moi agent su dung **ReAct** (Reason + Act) — LLM tuan tra vong lap:

```
LLM phan tich message
    │
    ├── Ko can tool → Tra loi text
    │
    └── Can tool → Goi tool function → Lay ket qua
         │
         ▼
    LLM suy luan tiep voi ket qua tool
         │
         ├── Tool tiep theo? → Lap lai
         └── Tra loi cuoi cung
```

### Cau truc

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
│   ├── llm_service.py       # Direct LLM calls (khong qua agent)
│   ├── sfds_service.py      # Proxy SFDS backend
│   ├── report_service.py    # Generate PDF/DOCX/HTML
│   └── sfds_event_store.py  # In-memory event log
└── schemas/schemas.py
```

### Available Tools

| Tool | Agent | Mo ta |
|------|-------|-------|
| `get_sfds_health` | chat, vision | Lay trang thai SFDS backend |
| `get_sfds_cameras` | chat, vision | Lay cau hinh camera |
| `get_sfds_stats` | chat, vision | Lay thong ke dataset |
| `get_chat_history` | chat | Tra cuu lich su cuoc tro chuyen |
| `get_current_sfds_status` | chat | Tra cuu trang thai SFDS hien tai |
| `analyze_image` | vision | Phan tich anh bang vision LLM |
| `extract_dashboard_metrics` | vision | Trich xuat chi so tu anh dashboard |
| `diagnose_error` | vision | Chan doan loi tu anh |
| `generate_report` | report | Tao bao cao PDF / DOCX / HTML |

---

## Agent Frontend — AI Assistant UI

### Cau truc

```
agent/frontend/src/
├── app/
│   ├── page.tsx             # Trang chu - overview + quick actions
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

### Cac trang

| Route | Mo ta |
|-------|-------|
| `/` | Dashboard overview, system status pills, quick actions |
| `/chat` | Chat Assistant - hoi đap voi multi-agent |
| `/analyze` | Phan tich anh - upload/capture + chon loai phan tich |
| `/analyze?tab=dashboard` | Dashboard reader - trich xuat metrics |
| `/analyze?tab=error` | Error diagnosis - chan doan loi |
| `/reports` | Danh sach bao cao + download PDF/DOCX/HTML |

---

## Database & Storage

### SFDS Backend Database

SQLite tai `SFDS/backend/durian.db`:

| Bang | Mo ta |
|------|-------|
| `employees` | Tai khoan nguoi dung (admin/inspector) |
| `inspection_logs` | Lich su kiem tra |
| `kpi_targets` | Muc tieu KPI |
| `shifts` | Ca san xuat |
| `alarm_logs` | Nhat ky canh bao |
| `trace_logs` | Traceability trai cay |

Default admin: `admin` / `admin123`

### Dataset Storage

`SFDS/backend/dataset/`:

```
dataset/
├── images/
│   ├── export_criteria/      A/ B/ C/ D (ABCD grading)
│   └── condition/           Xanh/ Suong/ Chin/ Sau ray/ Hu
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

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| POST | `/detect/` | Upload anh → YOLO detection |
| POST | `/api/scada/detect/{slot}/` | Detection frame tu IP camera slot |
| POST | `/api/detect/batch/` | Batch detection |

#### SCADA — RTSP Camera

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| GET | `/api/scada/cameras/` | Lay cau hinh 4 slots RTSP |
| POST | `/api/scada/cameras/` | Luu cau hinh RTSP URLs |
| GET | `/api/scada/frame/{slot}/` | Doc 1 frame JPEG tu IP camera |
| POST | `/api/scada/cameras/{slot}/start/` | Bat camera IP |
| POST | `/api/scada/cameras/{slot}/stop/` | Tat camera IP |
| WS | `/ws/scada/detect/{slot}/` | Realtime detection qua WebSocket |

#### Dataset

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| POST | `/api/dataset/save-face/` | Luu anh + labels YOLO |
| GET | `/api/dataset/items/` | Danh sach items |
| GET | `/api/dataset/stats/` | Thong ke so anh theo nhan |
| DELETE | `/api/dataset/items/{cat}/{label}/{file}/` | Xoa item |
| GET | `/api/dataset/export/` | Export ZIP dataset |
| GET | `/api/dataset/data-yaml/` | Generate `data.yaml` |

### Agent Backend (port 8001)

#### Vision

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| POST | `/api/vision/analyze` | Phan tich anh |
| POST | `/api/vision/dashboard` | Trich xuat dashboard metrics |
| POST | `/api/vision/error` | Chan doan loi |
| POST | `/api/vision/camera` | Phan tich camera frame |

#### Chat (offline mode — khong qua agent)

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| POST | `/api/chat/message` | Gui message (sync) |
| POST | `/api/chat/stream` | Gui message (streaming SSE) |
| GET | `/api/chat/history/{session_id}` | Lay lich su |

#### Agent (multi-agent mode)

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| POST | `/api/agent/stream` | Stream multi-agent response (SSE) |
| GET | `/api/agent/models` | Danh sach model |
| GET | `/api/agent/session/{session_id}` | Lay thong tin session |
| GET | `/api/agent/sessions` | Danh sach sessions |
| DELETE | `/api/agent/session/{session_id}` | Xoa session |

#### Report

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| POST | `/api/report/generate` | Tao bao cao |
| GET | `/api/report/list` | Danh sach bao cao |
| GET | `/api/report/download/{report_id}` | Tai bao cao |

#### SFDS Proxy

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| GET | `/api/sfds/health` | Kiem tra SFDS online/offline |
| GET | `/api/sfds/cameras` | Proxy lay cameras |
| GET | `/api/sfds/stats` | Proxy lay stats |
| POST | `/api/sfds/events` | Gui event |
| GET | `/api/sfds/events` | Lay event log |

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
// Quality status (chua dat)
{
  "type": "quality_status",
  "slot": 0,
  "phase": "tracking",
  "reason": "waiting_for_stability",
  "blur_score": 85.2,
  "stable_frames": 1,
  "checks": { "area_ok": true, "roi_ok": true, ... }
}

// Ket qua detection (dat)
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

### Cau truc YOLO label

Moi dong: `class_id x_center y_center width height` (normalized 0 → 1)

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
| 0 | Xanh |
| 1 | Suong |
| 2 | Chin |
| 3 | Sau ray |
| 4 | Hu |

### Huan luyen

```bash
cd F:/system/SFDS/backend
python scripts/train.py
```

Model luu tai `backend/model/durian_yolov8.pt`.

### Export sang ONNX

```bash
cd F:/system/SFDS/backend
python scripts/export_model.py
```

### Export sang TensorRT (can GPU CUDA)

```bash
cd F:/system/SFDS/backend
python -c "
from ultralytics import YOLO
model = YOLO('model/durian_yolov8.pt')
model.export(format='engine')
"
```

---

## Ghi chu

- `bun run lint` tren SFDS frontend co the fail vi `next lint` da deprecated (Next.js 15).
- `bun run build` co the treo tren Windows. Uu tien `dev`.
- Ca SFDS Backend va Agent Backend deu can LM Studio dang chay de hoat dong binh thuong.
- Dataset export format la YOLO standard, tuong thich voi `yolo detect train`.
