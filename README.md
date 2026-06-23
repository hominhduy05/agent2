# He Thong Phan Loai & Nhan Dien Sau Rieng

He thong IoT thoi gian thuc phan loai sau rieng su dung YOLOv8, FastAPI, Next.js + Bun.

---

## Kien truc he thong

```
Browser (Next.js)
    │ REST / WebSocket
    ▼
FastAPI Backend — app_scada.py (port 9000)
    ├── routers/
    │   ├── scada_router.py   — WebSocket, RTSP camera proxy
    │   └── dataset_router.py — Detection, Dataset CRUD
    ├── core/
    │   ├── shared.py       — Model config, engines, Pydantic schemas
    │   ├── auth.py         — JWT helpers (hien chua dung)
    │   ├── database.py     — SQLAlchemy models
    │   └── sort_tracker.py — SORT multi-object tracking
    ├── services/
    │   ├── dataset_service.py  — Luu anh + YOLO labels
    │   └── mqtt_publisher.py   — MQTT broker client
    └── YOLO Inference Engine   → durian_yolov8.pt/.onnx/.engine
```

---

## Cau truc project

> Luu y: Thu muc thuc te trong repo la `backend/` va `frontend/` (khong co `system/`).

```
backend/
├── app_scada.py               # FastAPI server — mount routers (port 9000)
├── routers/
│   ├── __init__.py
│   ├── scada_router.py        # WebSocket, RTSP camera proxy
│   └── dataset_router.py      # Detection, Dataset CRUD
├── inference.py               # Deprecated
├── model/                     # Model weights
│   ├── durian_yolov8.pt       # YOLOv8 PyTorch (UU TIEN)
│   ├── durian_yolov8.onnx     # YOLOv8 ONNX
│   └── durian_yolov8.engine   # TensorRT CUDA
├── core/
│   ├── __init__.py
│   ├── auth.py                # JWT helpers (hien chua dung)
│   ├── database.py
│   ├── sort_tracker.py
│   └── shared.py
├── services/
│   ├── dataset_service.py     # Luu anh + YOLO labels
│   └── mqtt_publisher.py      # MQTT broker client
└── scripts/
    ├── train.py
    ├── export_model.py
    └── evaluate_model.py

frontend/  (Next.js + Bun)
├── app/
│   ├── page.tsx               # Root → redirect /dashboard
│   ├── login/
│   ├── dashboard/
│   ├── scada/                 # Camera realtime + detection
│   └── dataset/               # Thu thap anh + gan nhan
├── components/
│   ├── layout/
│   ├── scada/
│   ├── dashboard/
│   └── ui/
└── lib/
    ├── api.ts
    ├── scada-camera.ts
    ├── ws-client.ts
    └── types.ts
```

---

## Thiet lap moi truong

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
```

### 2. Frontend

```bash
cd frontend
bun install
```

---

## Khoi dong he thong

### Backend (port 9000)

```bash
cd backend
uvicorn app_scada:app --reload --port 9000
```

- API docs: http://localhost:9000/docs
- Health check: http://localhost:9000/health/
- Model tu dong load khi start

### Frontend (dev)

```bash
cd frontend
bun run dev --port 3000
```

- Trinh duyet: http://localhost:3000

#### Ghi chu (Windows / Next.js)

- `bun run lint` hien se **fail** vi `next lint` da deprecated (Next.js 15) va yeu cau config ESLint interactive.
- `bun run build` co the bi treo/crash (exit code 4294967295) tren Windows. Neu chi can chay demo, uu tien `dev`.

---

## Inference Model

### Thu tu uu tien load

| Thu tu | File | Engine | Thiet bi |
|--------|------|--------|----------|
| 1 | `durian_yolov8.pt` | YOLOEngine (ultralytics) | CUDA / CPU |
| 2 | `durian_yolov8.onnx` | YOLOEngine (ultralytics) | CUDA / CPU |

### Classes nhan dien

```
defective  → hu, sau ray
immature   → chua chin
mature     → chin
```

---

## WebSocket — Realtime Detection

```
ws://localhost:9000/ws/scada/detect/{slot}/
```

**Client → Server:**

```json
{ "type": "frame", "data": "<base64 jpeg>" }
{ "type": "set_confidence", "value": 0.25 }
```

**Server → Client:**

```json
{
  "type": "result",
  "slot": 0,
  "detections": [{ "x1": 0, "y1": 0, "x2": 100, "y2": 200, "confidence": 0.92, "class_name": "mature" }],
  "image_width": 640,
  "image_height": 480,
  "unique_mature": 1,
  "unique_immature": 0,
  "unique_defective": 0
}
```

---

## API Endpoints

### Detection

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| `POST` | `/detect/?conf=0.25` | Upload anh → YOLO detection |
| `POST` | `/api/scada/detect/{slot}/?conf=0.25` | Detection frame tu IP camera slot |
| `POST` | `/api/detect/batch/` | Batch detection |

### SCADA — RTSP Camera

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| `GET` | `/api/scada/cameras/` | Lay cau hinh 4 slots RTSP |
| `POST` | `/api/scada/cameras/` | Luu cau hinh RTSP URLs |
| `GET` | `/api/scada/frame/{slot}/` | Doc 1 frame JPEG tu IP camera |
| `POST` | `/api/scada/cameras/{slot}/start/` | Bat camera IP (background thread) |
| `POST` | `/api/scada/cameras/{slot}/stop/` | Tat camera IP |
| `WS` | `/ws/scada/detect/{slot}/` | Realtime detection qua WebSocket |

### Dataset

| Method | Endpoint | Mo ta |
|--------|----------|-------|
| `POST` | `/api/dataset/save-face/` | Luu anh + labels YOLO |
| `GET` | `/api/dataset/items/` | Danh sach items |
| `GET` | `/api/dataset/stats/` | Thong ke so anh theo nhan |
| `DELETE` | `/api/dataset/items/{cat}/{label}/{file}/` | Xoa item |
| `GET` | `/api/dataset/export/?category=condition` | Export ZIP dataset |
| `GET` | `/api/dataset/data-yaml/?category=condition` | Generate `data.yaml` |

---

## Cac trang chinh

| Route | Mo ta |
|-------|---------|
| `/scada` | Camera realtime, detection sau rieng |
| `/dataset` | Thu thap anh + gan nhan de train YOLOv8 |

---

## Dataset — Thu thap anh cho YOLO

### Luong hoat dong

1. Upload/camera 4 mat trai cay (Truoc, Trai, Phai, Sau)
2. YOLOv8 detect bounding boxes tren tung anh
3. Chon **tieu chi xuat khau** (A / B / C / D) va **tinh trang thuc te** (Xanh / Suong / Chin / Sau ray / Hu)
4. Bam **Luu Dataset** → moi face luu **2 anh** vao 2 folder → **8 anh / 4 mat**
5. Bam **Export ZIP** de export dataset chuan YOLO

### Cau truc dataset

```
dataset/
├── images/
│   ├── export_criteria/
│   │   ├── A/  {timestamp}_{face}.jpg
│   │   ├── B/  ...
│   │   ├── C/  ...
│   │   └── D/  ...
│   └── condition/
│       ├── Xanh/    {timestamp}_{face}.jpg
│       ├── Suong/   ...
│       ├── Chin/    ...
│       ├── Sau ray/ ...
│       └── Hu/      ...
└── labels/                     (mirror cau truc images/)
    ├── export_criteria/
    │   └── {timestamp}_{face}.txt   ← YOLO format
    └── condition/
        └── {timestamp}_{face}.txt   ← YOLO format
```

### Dinh dang YOLO label (`.txt`)

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

---

## Huan luyen & Export Model

### Huan luyen

```bash
cd backend
python scripts/train.py
```

Model luu tai `backend/model/durian_yolov8.pt`.

### Export sang ONNX

```bash
cd backend
python scripts/export_model.py
```

### Export sang TensorRT (can GPU CUDA)

```bash
cd backend
python -c "
from ultralytics import YOLO
model = YOLO('model/durian_yolov8.pt')
model.export(format='engine')
"
```

---

## Yeu cau he thong

- Python 3.10+
- Bun 1.0+
- CUDA GPU (tuy chon)
- Camera webcam / IP camera (RTSP) cho chuc nang SCADA
