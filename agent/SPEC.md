# Vision Assistant - Project Specification

## Overview

Vision Assistant is a standalone web application that uses a local LLM (nvidia/nemotron-3-nano-omni via LM Studio) to analyze images, dashboards, and error screenshots from an industrial SCADA/IoT durian sorting system (SFDS). It generates multi-format reports and provides an AI-powered chat assistant for operations support.

## System Architecture

```
Next.js (:3000)  <--->  FastAPI (:8001)  <--->  LM Studio (:1234)
                           |
              +------------+------------+
              |                         |
         SFDS API (:9000)         Report Storage
```

## Technology Stack

- **Backend**: FastAPI (Python 3.10+)
- **Frontend**: Next.js 14+ (App Router, TypeScript)
- **LLM Runtime**: LM Studio with nvidia/nemotron-3-nano-omni (GGUF + mmproj)
- **Report Generation**: reportlab (PDF), python-docx (DOCX), Jinja2 (HTML)
- **Package Manager**: Bun (frontend)

## Project Structure

```
f:/agent/
├── SPEC.md
├── README.md
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── vision.py
│   │   ├── report.py
│   │   ├── chat.py
│   │   └── sfds.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_service.py
│   │   ├── report_service.py
│   │   └── sfds_service.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py
│   └── storage/
│       ├── images/
│       └── reports/
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx
    │   │   ├── layout.tsx
    │   │   ├── analyze/page.tsx
    │   │   ├── reports/page.tsx
    │   │   ├── reports/[id]/page.tsx
    │   │   └── chat/page.tsx
    │   ├── components/
    │   │   ├── ImageUploader.tsx
    │   │   ├── AnalysisPanel.tsx
    │   │   ├── ReportGenerator.tsx
    │   │   ├── ReportViewer.tsx
    │   │   └── ChatAssistant.tsx
    │   └── lib/
    │       └── api.ts
    ├── package.json
    ├── next.config.js
    └── tsconfig.json
```

## LM Studio Configuration

**IMPORTANT**: When downloading `nvidia/nemotron-3-nano-omni` in LM Studio, download **both** files:
- The GGUF model weights (main)
- The `mmproj` file (multimodal projector — required for vision/audio)

**API Endpoint**: `http://localhost:1234/v1/chat/completions` (OpenAI-compatible)

## API Endpoints

### Vision (`/api/vision/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/analyze` | Upload image + custom prompt → LLM analysis |
| POST | `/dashboard` | Read dashboard image → extract metrics/values |
| POST | `/error` | Analyze error image → diagnose + recommend |
| POST | `/camera` | Process webcam capture (base64) → analyze |

### Report (`/api/report/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/generate` | Generate report (PDF/DOCX/HTML) from analysis results |
| GET | `/list` | List all generated reports |
| GET | `/download/{report_id}` | Download a report file |

### Chat (`/api/chat/`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/message` | Send message → get operation support response |
| GET | `/history/{session_id}` | Get chat history for a session |

### SFDS Proxy (`/api/sfds/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/cameras` | Proxy to SFDS `/api/scada/cameras/` |
| GET | `/stats` | Proxy to SFDS `/api/dataset/stats/` |
| GET | `/detection` | Proxy to SFDS `/detect/` |

## LLM System Prompts

- **Vision Analyzer**: "You are a computer vision expert specializing in SCADA/IoT industrial systems. Analyze images, identify components, detect anomalies, and provide detailed technical assessments."
- **Dashboard Reader**: "You are a data extraction specialist for industrial dashboards. Read gauges, meters, charts, and numerical displays. Extract all metrics, values, and indicators accurately."
- **Error Diagnoser**: "You are a senior maintenance engineer specializing in machinery fault diagnosis. Analyze error images, identify probable root causes, and recommend specific remediation steps."
- **Operation Assistant**: "You are an AI operations assistant for a durian sorting and inspection SCADA system. Provide clear, actionable guidance for system operation, troubleshooting, and maintenance."

## Report Formats

| Format | Library | Notes |
|--------|---------|-------|
| PDF | reportlab | Standard printable report |
| DOCX | python-docx | Microsoft Word compatible |
| HTML | Jinja2 | Browser-printable, styled |

## Environment Variables

### Backend (.env)
```
LM_STUDIO_URL=http://localhost:1234/v1/chat/completions
LM_MODEL=nvidia/nemotron-3-nano-omni
SFDS_BASE_URL=http://localhost:9000
MAX_TOKENS=2048
TEMPERATURE=0.3
```

## Prerequisites

1. LM Studio installed and running with `nvidia/nemotron-3-nano-omni` loaded (GGUF + mmproj)
2. SFDS backend running on port 9000 (optional — only needed for SFDS proxy)
3. Python 3.10+, Node.js 18+, Bun 1.0+
