# SFDS - Durian Sorting and Detection System

Realtime durian detection and sorting demo using FastAPI, Ultralytics YOLO,
Next.js, camera/WebSocket flows, dataset capture, and SCADA-style monitoring.

## Project Structure

```text
backend/
  main.py                  FastAPI app on port 9000
  core/shared.py           model loading, schemas, inference wrappers
  routers/scada_router.py  realtime camera/WebSocket and SCADA endpoints
  routers/dataset_router.py
  services/
  scripts/
  model/                   put local model weights here

frontend/
  app/
  components/
  lib/
  package.json

dist/durian_pi_runtime/    optional Raspberry Pi runtime package
```

## Requirements

- Anaconda or Miniconda
- Node.js 18+
- Bun 1.0+ for the realtime WebSocket proxy
- Optional: CUDA-capable GPU
- A YOLO model file for backend inference

## One-click Windows Setup and Run

On Windows, double-click this file from the project root:

```text
run_all.bat
```

The script checks for Conda, Node.js, npm, and Bun. It uses the Conda
environment named `admin` for the backend, installs backend dependencies,
installs frontend dependencies with npm, starts the FastAPI backend, starts
the Next.js frontend, starts the Bun WebSocket proxy when Bun is available,
and opens the app at:

```text
http://localhost:3000
```

Keep the service windows open while using the app.

Dependency installation is cached. The script skips Python/npm installs on
later runs unless `backend/requirements.txt` or `frontend/package-lock.json`
changes.

If you want to use a different Conda environment name, set `SFDS_CONDA_ENV`
before running the script:

```bat
set SFDS_CONDA_ENV=your_env_name
run_all.bat
```

This project keeps `package-lock.json`, so npm is the safest package manager
for installing frontend dependencies. Bun is still used at runtime for
`frontend/bun-ws.ts`, which provides `ws://localhost:8080` for realtime
webcam and dataset detection flows.

## Model Setup

Model binaries are intentionally ignored by git because they are large.
After cloning on another computer, copy one of these files into
`backend/model/`:

```text
backend/model/durian_yolo26m_seg.pt
backend/model/durian_yolov8.pt
backend/model/durian_yolo26m_seg.onnx
backend/model/durian_yolov8.onnx
backend/model/durian_yolo26m_seg.engine
```

The backend checks those names in order. You can also keep the model anywhere
and point the backend to it:

```powershell
$env:DURIAN_MODEL_PATH="D:\path\to\model.pt"
```

```bash
export DURIAN_MODEL_PATH="/path/to/model.pt"
```

Ultralytics settings are stored in the local `backend/.ultralytics/` folder at runtime,
so the app does not depend on a user-specific Windows `AppData` path.

## Backend Setup

```bash
conda activate admin
cd backend
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 9000 --reload
```

Check the backend:

```text
http://127.0.0.1:9000/health/
http://127.0.0.1:9000/docs
```

The health endpoint should return `"model_loaded": true` before camera
detection will work.

## Frontend Setup

```bash
cd frontend
npm install
npm run dev:full
```

If Bun is not installed, run only the Next.js frontend:

```bash
cd frontend
npm run dev
```

Open:

```text
http://localhost:3000
```

By default, the frontend calls `http://localhost:9000`. If the backend is on
another computer, set:

```text
NEXT_PUBLIC_API_URL=http://BACKEND_IP:9000
NEXT_PUBLIC_WS_URL=ws://BACKEND_IP:8080
```

## Useful Endpoints

```text
GET  /health/
POST /detect/
GET  /api/scada/cameras/
POST /api/scada/cameras/
GET  /api/scada/frame/{slot}/
POST /api/scada/detect/{slot}/
WS   /ws/scada/detect/{slot}/
```

## Raspberry Pi Runtime

The optional runtime in `dist/durian_pi_runtime/` is separate from the main
backend. It expects an ONNX locator model at:

```text
dist/durian_pi_runtime/models/durian_fruit_locator.onnx
```

If you only run the FastAPI backend and Next.js frontend on a PC, this Pi
model is not required.

## Before Pushing

Do not commit local runtime artifacts:

```text
backend/**/*.db
backend/model/*.pt
backend/model/*.onnx
backend/model/*.engine
frontend/node_modules/
Ultralytics/**/*.json
__pycache__/
```

Those are covered by `.gitignore`. Commit source code, docs, lockfiles, and
small config examples only.
