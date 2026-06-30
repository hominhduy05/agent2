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
auto-detects the server LAN IP, chooses free ports, and opens the app at a
network URL like:

```text
http://SERVER_IP:FRONTEND_PORT
```

Use the printed `Client URL` on other computers in the same network. The same
URL is saved to:

```text
sfds_launch_info.txt
```

Keep the service windows open while using the app. If the launcher is run as
Administrator, it also adds Windows Firewall rules for the selected frontend
and backend ports. Without Administrator permission, allow those printed TCP
ports manually if another computer cannot connect.

Browser webcam access only works on secure origins. On the server machine,
use the local URL that `run_all.bat` opens automatically:

```text
http://127.0.0.1:FRONTEND_PORT
```

Other computers can open the LAN `Client URL`, but browser/USB webcam access
from that remote computer may be blocked by Chrome unless HTTPS or a Chrome
secure-origin exception is configured. RTSP/IP camera mode still works through
the backend over the LAN URL.

Dependency installation is cached. The script skips Python/npm installs on
later runs unless `backend/requirements.txt` or `frontend/package-lock.json`
changes.

Inference device selection defaults to `auto`: GPU/CUDA is preferred when
available, and CPU is used as a fallback. To force a device:

```bat
set DURIAN_DEVICE=cpu
run_all.bat
```

or:

```bat
set DURIAN_DEVICE=cuda
run_all.bat
```

If you want to use a different Conda environment name, set `SFDS_CONDA_ENV`
before running the script:

```bat
set SFDS_CONDA_ENV=your_env_name
run_all.bat
```

On Windows Server, Anaconda may be installed outside the usual PATH. If
`run_all.bat` says Conda is missing even though it is installed, point the
launcher directly to Conda:

```bat
set "SFDS_CONDA_BAT=C:\ProgramData\anaconda3\condabin\conda.bat"
run_all.bat
```

Use the real path to `conda.bat` on that machine.

This project keeps `package-lock.json`, so npm is the safest package manager
for installing frontend dependencies. Bun is still used at runtime for
`frontend/bun-ws.ts`, which provides `ws://localhost:8080` for the older
generic detection proxy. The SCADA webcam realtime flow connects directly to
the FastAPI backend at `ws://127.0.0.1:9000/ws/scada/detect/{slot}/`.

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

## Camera Health Check

`run_all.bat` does not auto-open camera checks. To debug RTSP/IP camera
connections manually after the backend starts, run:

```text
check_cameras.bat
```

The script waits for `http://127.0.0.1:9000/health/`, prints the active
inference device, then checks camera slots `0` to `3` through:

```text
http://127.0.0.1:9000/api/scada/cameras/health/
```

RTSP camera settings are saved locally in:

```text
backend/scada_cameras.json
```

That file is ignored by git because camera URLs are machine-specific.

To debug browser webcam permissions manually, open:

```text
http://localhost:3000/webcam-check
```

or run:

```text
check_webcams.bat
```

Browser webcam checks must run inside the browser because Windows/browser
camera permissions cannot be verified from the backend. Allow camera access
when prompted, then click `Kiem tra webcam` to list and test local USB/webcam
devices.

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

By default, the frontend calls `http://127.0.0.1:9000`. If the backend is on
another computer, set:

```text
NEXT_PUBLIC_API_URL=http://BACKEND_IP:9000
NEXT_PUBLIC_WS_URL=ws://BACKEND_IP:9000
SFDS_BACKEND_HOST=0.0.0.0
```

`run_all.bat` sets those values automatically for the current machine.

## Useful Endpoints

```text
GET  /health/
POST /detect/
GET  /api/scada/cameras/
POST /api/scada/cameras/
GET  /api/scada/frame/{slot}/
POST /api/scada/detect/{slot}/
WS   /ws/scada/detect/{slot}/
GET  /api/scada/sorting/config/
GET  /api/scada/sorting/commands/
```

## Sorting / Relay Commands

After SCADA accepts fruit detections, the backend aggregates camera votes and
emits one sorting command per fruit. The default vote rule expects 5 camera
votes:

```text
3A + 1B + 1C -> final A -> relay 1 -> cylinder_1
3A + 1B + 1D -> final D -> pass_through, no relay pulse
2A + 2B + 1C -> final C -> relay 3 -> cylinder_3
```

Grade D is treated as a defect/safety veto when votes are finalized. Without
D, A/B/C use clear-majority voting. If no grade reaches majority, the system
routes to the strictest/lower-quality grade present.

Commands are published as enterprise events on topic `sorting/command`.
In a production line, a PLC, relay controller, or edge IO service should
subscribe to this command and handle the physical relay pulse. The inference
API does not drive GPIO directly.

The default is fail-safe: sorting decisions are generated for audit, but
physical actuation is disabled unless explicitly enabled.

```bat
set SORTING_ENABLED=true
set SORTING_DRY_RUN=false
set SORTING_GRADE_A_RELAY=1
set SORTING_GRADE_B_RELAY=2
set SORTING_GRADE_C_RELAY=3
set SORTING_VOTE_REQUIRED=5
set SORTING_CAMERAS_PER_ROOM=5
set SORTING_DEFECT_VETO=true
set SORTING_EARLY_DEFECT_VETO=false
set SORTING_GRADE_A_PULSE_MS=250
set SORTING_GRADE_B_PULSE_MS=250
set SORTING_GRADE_C_PULSE_MS=250
set SORTING_GRADE_A_DELAY_MS=0
set SORTING_GRADE_B_DELAY_MS=0
set SORTING_GRADE_C_DELAY_MS=0
```

Use `*_DELAY_MS` to compensate for the distance from the camera trigger point
to each cylinder at the current conveyor speed. Keep `SORTING_DRY_RUN=true`
while commissioning the PLC/relay wiring.

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
