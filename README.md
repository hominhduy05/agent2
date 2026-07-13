# Smart Durian Sorting System

Repository này chứa hệ thống phân loại sầu riêng theo thời gian thực và lớp
Agentic AI giám sát đang được tách riêng để review trước khi tích hợp vào runtime
chính.

Hiện codebase được tổ chức thành 2 phần chính:

| Folder | Vai trò | Trạng thái |
| --- | --- | --- |
| `SFDS/` | Hệ thống chính: FastAPI backend, Next.js frontend, YOLO inference, SCADA, camera, dataset, sorting, PostgreSQL/SQLite, ESP32 relay | Runtime chính |
| `agentic/` | Scaffold Agentic AI: monitor, anomaly detection, recommendation, action policy, UI/API mẫu | Staging, chưa nằm trong luồng điều khiển thật |

> Nguyên tắc an toàn: luồng camera -> YOLO -> sorting -> relay/cylinder vẫn là
> deterministic. Agentic AI chỉ quan sát, phân tích, cảnh báo, gợi ý và audit;
> không trực tiếp điều khiển relay, cylinder hoặc emergency flow.

---

## Cấu trúc thư mục tổng

```text
.
├── README.md
├── SFDS/
│   ├── README.md
│   ├── sfds.bat
│   ├── docker-compose.postgres.yml
│   ├── docker/
│   │   └── postgres/
│   ├── scripts/
│   │   └── sfds.ps1
│   ├── docs/
│   │   └── agentic-ai-structure.md
│   ├── backend/
│   │   ├── main.py
│   │   ├── requirements.txt
│   │   ├── api/
│   │   ├── core/
│   │   ├── db/
│   │   ├── routers/
│   │   ├── services/
│   │   ├── scripts/
│   │   ├── esp32/
│   │   ├── dataset/
│   │   ├── model/
│   │   └── runs/
│   └── frontend/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── icons/
│       ├── lib/
│       ├── public/
│       ├── package.json
│       └── bun-ws.ts
└── agentic/
    ├── README.md
    ├── SFDS_AGENTIC_AI_IMPLEMENTATION_PROMPT.md
    ├── backend/
    │   ├── agentic/
    │   │   ├── actions/
    │   │   ├── agents/
    │   │   ├── analyzers/
    │   │   ├── memory/
    │   │   ├── monitors/
    │   │   ├── policies/
    │   │   ├── runtime/
    │   │   └── schemas/
    │   └── routers/
    │       └── agent_router.py
    ├── frontend/
    │   ├── app/
    │   ├── components/
    │   └── lib/
    └── tests/
```

---

## SFDS runtime chính

`SFDS/` là ứng dụng đang chạy thật.

### Backend

Backend nằm tại `SFDS/backend/` và dùng FastAPI.

Các nhóm chính:

| Path | Mục đích |
| --- | --- |
| `main.py` | Khởi tạo FastAPI app, CORS, database, serial scale reader và mount router |
| `routers/scada_router.py` | Camera, SCADA, WebSocket realtime detection, sorting endpoints |
| `routers/dataset_router.py` | Dataset capture, label, export và detect API |
| `routers/audit_router.py` | Audit detection/sorting/summary |
| `core/` | Inference engine, tracking, auth, shared state, database helpers |
| `db/` | SQLAlchemy models, session, repository, database lifecycle |
| `services/` | Sorting controller, MQTT publisher, ESP32 relay, scale reader, dataset service, logging |
| `scripts/` | Train, evaluate, export model, prepare dataset |
| `esp32/` | Firmware relay controller |
| `model/` | Nơi đặt model YOLO local, không commit model lớn |
| `dataset/` | Ảnh và label YOLO thu thập tại máy |

Backend mặc định chạy ở:

```text
http://127.0.0.1:9000
```

Endpoint quan trọng:

```text
GET  /health/
POST /detect/
GET  /api/scada/cameras/
GET  /api/scada/cameras/health/
POST /api/scada/detect/{slot}/
WS   /ws/scada/detect/{slot}/
GET  /api/scada/sorting/config/
GET  /api/scada/sorting/commands/
GET  /api/scada/sorting/esp32/
GET  /api/audit/detections/
GET  /api/audit/sorting-commands/
GET  /api/audit/summary/
```

### Frontend

Frontend nằm tại `SFDS/frontend/` và dùng Next.js.

Các nhóm chính:

| Path | Mục đích |
| --- | --- |
| `app/` | App Router, layout, login, admin pages |
| `app/(admin)/scada/` | SCADA dashboard, monitor, camera room |
| `app/(admin)/dataset/` | Thu thập ảnh, gán nhãn, quản lý dataset |
| `app/(admin)/analytics/` | Thống kê và phân tích |
| `app/(admin)/detection-history/` | Lịch sử detection |
| `app/(admin)/statistics/` | Thống kê trái và hệ thống |
| `components/` | UI, dashboard, layout, SCADA camera components |
| `hooks/` | Hook realtime và SCADA state |
| `lib/` | API client, WebSocket client, auth, stores, camera/detection utilities |
| `bun-ws.ts` | WebSocket proxy cũ cho một số flow realtime |

Frontend mặc định chạy ở:

```text
http://127.0.0.1:3000
```

---

## Chạy nhanh trên Windows

Vào folder `SFDS/` rồi chạy:

```bat
sfds.bat
```

Lệnh này chạy chế độ server/factory:

1. Khởi động PostgreSQL bằng Docker.
2. Chuẩn bị Conda backend environment.
3. Cài backend dependencies nếu cần.
4. Cài frontend dependencies nếu cần.
5. Chọn IP LAN và port còn trống.
6. Mở backend, frontend và Bun proxy nếu có Bun.
7. Lưu URL vào `SFDS/sfds_launch_info.txt`.

Chạy demo/dev không cần Docker PostgreSQL:

```bat
sfds.bat dev
```

Một số lệnh hỗ trợ:

```bat
sfds.bat db-status
sfds.bat db-logs
sfds.bat backup
sfds.bat camera-check
sfds.bat webcam-check
```

Xem chi tiết trong `SFDS/README.md`.

---

## Chạy thủ công

### Backend

```bash
cd SFDS/backend
conda activate admin
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 9000 --reload
```

Kiểm tra:

```text
http://127.0.0.1:9000/health/
http://127.0.0.1:9000/docs
```

### Frontend

```bash
cd SFDS/frontend
npm install
npm run dev
```

Nếu cần chạy kèm Bun WebSocket proxy:

```bash
npm run dev:full
```

---

## Model YOLO

Model lớn không được commit vào git. Sau khi clone hoặc chuyển máy, đặt model
vào:

```text
SFDS/backend/model/
```

Các tên file backend đang hỗ trợ:

```text
durian_yolo26m_seg.pt
durian_yolov8.pt
durian_yolo26m_seg.onnx
durian_yolov8.onnx
durian_yolo26m_seg.engine
```

Hoặc trỏ trực tiếp bằng biến môi trường:

```powershell
$env:DURIAN_MODEL_PATH="D:\path\to\model.pt"
```

Thiết bị inference:

```bat
set DURIAN_DEVICE=auto
set DURIAN_DEVICE=cpu
set DURIAN_DEVICE=cuda
```

---

## Database và storage

SFDS hỗ trợ:

| Mode | Mục đích |
| --- | --- |
| SQLite local | Demo/dev nhanh |
| PostgreSQL offline qua Docker | Factory/server mode |

Các dữ liệu runtime quan trọng:

```text
SFDS/backend/dataset/      Ảnh và label YOLO
SFDS/backend/model/        Model local
SFDS/backend/runs/         Kết quả train/evaluate
SFDS/logs/                 Log vận hành
SFDS/sfds_launch_info.txt  URL sau khi chạy launcher
```

Các file runtime/machine-specific như database local, model, camera config,
node_modules và cache đã được ignore.

---

## Sorting và phần cứng

Luồng sorting nằm trong `SFDS/backend/services/` và `SFDS/backend/routers/scada_router.py`.

Các thành phần liên quan:

| Thành phần | File/folder |
| --- | --- |
| Vote/final grade/sorting command | `services/sorting_controller.py` |
| Publish MQTT/event | `services/mqtt_publisher.py` |
| ESP32 relay bridge | `services/esp32_relay_controller.py` |
| Serial scale | `services/serial_scale_reader.py` |
| Firmware | `backend/esp32/final2.ino` |

Mặc định nên giữ chế độ dry-run trong giai đoạn commissioning. Chỉ bật relay
thật khi đã kiểm tra wiring, delay, sensor và rule sorting.

---

## Agentic AI scaffold

`agentic/` là lớp Agentic AI giám sát đang được để riêng ngoài runtime chính.
Mục tiêu là review và kiểm thử trước khi copy/wire vào `SFDS/`.

Các phần chính:

| Path | Mục đích |
| --- | --- |
| `backend/agentic/runtime/` | Orchestrator và vòng đời agent run |
| `backend/agentic/monitors/` | Thu thập snapshot hệ thống |
| `backend/agentic/analyzers/` | Rule-based anomaly detection |
| `backend/agentic/agents/supervisor/` | Supervisor giải thích cảnh báo và khuyến nghị |
| `backend/agentic/actions/` | Action registry và executor an toàn |
| `backend/agentic/policies/` | Threshold, policy, approval/risk checks |
| `backend/agentic/memory/` | Event store MVP và alert deduplication |
| `backend/agentic/schemas/` | Pydantic schemas |
| `backend/routers/agent_router.py` | Router API mẫu để wire vào SFDS backend |
| `frontend/app/(admin)/agent/` | Trang admin Agent mẫu |
| `frontend/components/agent/` | Overview, alerts, recommendations, timeline |
| `tests/` | Test safety và anomaly rules |

Endpoint MVP của scaffold:

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

Khi tích hợp vào runtime chính, target dự kiến là:

```text
SFDS/backend/agentic/
SFDS/backend/routers/agent_router.py
SFDS/frontend/app/(admin)/agent/
SFDS/frontend/components/agent/
SFDS/frontend/lib/agent-api.ts
SFDS/frontend/lib/agent-types.ts
```

Sau đó mount router trong `SFDS/backend/main.py`:

```python
from routers.agent_router import router as agent_router

app.include_router(agent_router)
```

---

## Test nhanh

Chạy test Agentic AI scaffold:

```bash
python -m pytest agentic/tests
```

Chạy backend health sau khi start SFDS:

```text
http://127.0.0.1:9000/health/
```

Chạy camera check:

```bat
cd SFDS
sfds.bat camera-check
```

---

## Tài liệu chi tiết

| File | Nội dung |
| --- | --- |
| `SFDS/README.md` | Hướng dẫn chạy SFDS, model, camera, PostgreSQL offline, sorting/relay |
| `agentic/README.md` | Mô tả scaffold Agentic AI và target tích hợp |
| `agentic/SFDS_AGENTIC_AI_IMPLEMENTATION_PROMPT.md` | Prompt/spec thiết kế Agentic AI supervision layer |
| `SFDS/docs/agentic-ai-structure.md` | Ghi chú cấu trúc Agentic AI trong ngữ cảnh SFDS |

---

## Ghi chú trước khi commit

Không commit các artifact runtime hoặc file nặng:

```text
SFDS/backend/**/*.db
SFDS/backend/model/*.pt
SFDS/backend/model/*.onnx
SFDS/backend/model/*.engine
SFDS/frontend/node_modules/
SFDS/backend/__pycache__/
SFDS/backend/.ultralytics/
```

Nên commit:

```text
source code
README/docs
requirements.txt
package.json
package-lock.json
config example
test files
```
