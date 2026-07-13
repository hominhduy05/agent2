# Cấu trúc Agentic AI cho SFDS

Tài liệu này đề xuất cấu trúc thêm một lớp agentic AI để quản lý và giám sát hệ thống SFDS hiện có. Mục tiêu là để agent quan sát tình trạng hệ thống, phân tích bất thường, tạo cảnh báo, gợi ý thao tác vận hành và có thể điều phối một số hành động an toàn sau khi được kiểm soát.

## Hiện trạng SFDS

SFDS hiện có các phần chính:

- Backend FastAPI tại `backend/main.py`.
- Realtime SCADA, camera, WebSocket và sorting tại `backend/routers/scada_router.py`.
- Audit API tại `backend/routers/audit_router.py`.
- Database model cho camera, detection event, sorting command tại `backend/db/models.py`.
- Repository audit/persistence tại `backend/db/repositories.py`.
- Sorting controller, ESP32 relay, MQTT/event webhook và log file tại `backend/services/`.
- Frontend Next.js với các màn SCADA, camera manager, thống kê, detection history tại `frontend/app/(admin)/`.

Các nguồn dữ liệu phù hợp cho agent:

- `/health/`: model, device, database, cân serial.
- `/api/scada/cameras/health/`: tình trạng camera, latency, online/offline.
- `/api/scada/sorting/config/`: cấu hình phân loại, dry-run, route, relay.
- `/api/scada/sorting/commands/`: lệnh sorting gần đây.
- `/api/scada/sorting/esp32/`: tình trạng relay ESP32.
- `/api/audit/summary/`: tổng quan detection/sorting theo thời gian.
- `/api/audit/detections/`: lịch sử nhận diện.
- `/api/audit/sorting-commands/`: lịch sử lệnh phân loại.
- `logs/sfds_sorting.log`: log sự kiện sorting/camera/hardware.
- MQTT/webhook events: `detection.completed`, `sorting.command`.

## Vai trò của Agentic AI

Đề xuất chia agent thành 5 vai trò nhỏ thay vì một agent lớn:

1. `MonitorAgent`: kiểm tra health backend, camera, database, serial scale, ESP32.
2. `AnomalyAgent`: phát hiện bất thường như camera offline, confidence giảm, latency cao, nhiều frame bị từ chối, lệnh sorting bị lỗi.
3. `OpsAdvisorAgent`: giải thích nguyên nhân có khả năng xảy ra và đưa checklist xử lý cho người vận hành.
4. `ReportAgent`: tạo báo cáo ca/ngày về số lượng, grade, lỗi, uptime, sorting command.
5. `ControlAgent`: thực hiện hành động có kiểm soát như health check lại, reset trạng thái mềm, bật/tắt demo mode, đọc log, đề xuất finalize batch. Các thao tác rủi ro cần yêu cầu xác nhận.

## Cấu trúc thư mục đề xuất

```text
SFDS/
  backend/
    agents/
      __init__.py
      agent_orchestrator.py        # Điều phối các agent con
      agent_state.py               # Snapshot hệ thống, memory ngắn hạn
      schemas.py                   # Pydantic schemas cho insight, alert, action
      policies.py                  # Quy tắc an toàn, quyền hành động
      prompts.py                   # Prompt/template nếu dùng LLM

      monitors/
        __init__.py
        health_monitor.py          # Backend/model/db/scale/ESP32 health
        camera_monitor.py          # Camera online/latency/configured
        sorting_monitor.py         # Sorting config/commands/dry-run/hardware
        audit_monitor.py           # Detection summary, grade, confidence
        log_monitor.py             # Parse sfds_sorting.log

      analyzers/
        __init__.py
        anomaly_detector.py        # Rule-based bất thường
        root_cause.py              # Gom triệu chứng thành nguyên nhân
        trend_analyzer.py          # Xu hướng theo giờ/ca/ngày

      actions/
        __init__.py
        action_registry.py         # Danh sách tool/hành động agent được phép gọi
        scada_actions.py           # Gọi các endpoint SCADA an toàn
        report_actions.py          # Sinh báo cáo vận hành

      memory/
        __init__.py
        event_store.py             # Lưu insight/alert/action history
        summarizer.py              # Tóm tắt trạng thái gần đây

    routers/
      agent_router.py              # API agent cho frontend

    db/
      agent_models.py              # Bảng agent_alerts, agent_runs, agent_actions
      agent_repositories.py        # Query/lưu lịch sử agent

  frontend/
    app/(admin)/
      agent/
        page.tsx                   # Trung tâm agentic AI
        page.module.css

    components/agent/
      AgentOverview.tsx            # Tổng quan sức khỏe hệ thống
      AgentChatPanel.tsx           # Hỏi đáp vận hành
      AgentAlerts.tsx              # Alert/insight đang mở
      AgentRecommendations.tsx     # Khuyến nghị xử lý
      AgentRunTimeline.tsx         # Timeline lần agent kiểm tra

    lib/
      agent-api.ts                 # Client gọi /api/agent/*
      agent-types.ts               # TypeScript types
```

## API backend nên thêm

```text
GET  /api/agent/status/
POST /api/agent/run-check/
GET  /api/agent/alerts/
POST /api/agent/alerts/{alert_id}/ack/
GET  /api/agent/recommendations/
POST /api/agent/chat/
GET  /api/agent/reports/shift/
GET  /api/agent/reports/daily/
GET  /api/agent/actions/
POST /api/agent/actions/execute/
```

Ý nghĩa:

- `status`: snapshot tổng hợp health, camera, sorting, database, ESP32.
- `run-check`: chạy một vòng agent thủ công.
- `alerts`: danh sách cảnh báo do agent sinh ra.
- `recommendations`: đề xuất hành động theo trạng thái hiện tại.
- `chat`: hỏi agent bằng ngôn ngữ tự nhiên, ví dụ "vì sao camera 3 offline?".
- `reports`: báo cáo ca/ngày từ audit database.
- `actions`: danh sách hành động agent được phép thực hiện.
- `actions/execute`: thực hiện hành động, có policy kiểm soát.

## Database bổ sung

```text
agent_runs
  id
  started_at
  finished_at
  status
  trigger_source       # manual | scheduled | webhook
  summary
  raw_snapshot_json

agent_alerts
  id
  run_id
  code                 # CAMERA_OFFLINE, LOW_CONFIDENCE, ESP32_DISCONNECTED...
  severity             # info | warning | critical
  title
  message
  source
  camera_slot
  is_active
  acknowledged_at
  created_at

agent_recommendations
  id
  alert_id
  priority
  recommendation
  action_key
  requires_confirmation
  created_at

agent_actions
  id
  action_key
  requested_by
  payload_json
  result_json
  status
  created_at
```

## Luồng xử lý agent

```text
1. Agent nhận trigger
   - Người vận hành bấm "Run check"
   - Scheduler chạy mỗi 30-60 giây
   - Webhook/MQTT event báo detection hoặc sorting command mới

2. Monitor thu thập snapshot
   - Backend health
   - Camera health
   - Sorting config/commands
   - ESP32 relay
   - Audit summary
   - Sorting log gần nhất

3. Analyzer phát hiện bất thường
   - Camera configured nhưng offline
   - Latency vượt ngưỡng
   - Model chưa load
   - Database lỗi
   - ESP32 mất kết nối
   - Sorting đang dry-run trong lúc hệ thống cần chạy thật
   - Confidence trung bình giảm
   - Detection count bất thường theo camera

4. Advisor sinh insight
   - Mức độ nghiêm trọng
   - Nguyên nhân có khả năng
   - Checklist xử lý
   - Hành động agent có thể làm

5. Lưu kết quả
   - agent_runs
   - agent_alerts
   - agent_recommendations

6. Frontend hiển thị
   - Health score
   - Alert đang mở
   - Timeline agent runs
   - Chat vận hành
   - Report ca/ngày
```

## Policy an toàn

Các hành động agent được chia 3 mức:

```text
SAFE_READ
  - đọc health
  - đọc camera status
  - đọc audit summary
  - đọc log
  - tạo báo cáo

SAFE_WRITE
  - acknowledge alert
  - chạy lại health check
  - lưu recommendation
  - bật/tắt demo mode nếu đang ở chế độ demo

CONFIRM_REQUIRED
  - finalize batch
  - thay đổi camera config
  - thay đổi sorting config
  - gửi lệnh relay/ESP32
  - tắt/mở luồng camera
```

Ở giai đoạn đầu, nên chỉ triển khai `SAFE_READ` và `SAFE_WRITE`. Nhóm `CONFIRM_REQUIRED` chỉ hiển thị đề xuất, chưa tự chạy.

## Version 1 nên làm trước

MVP nên nhỏ nhưng hữu ích:

```text
Backend
  - backend/agents/monitors/*
  - backend/agents/analyzers/anomaly_detector.py
  - backend/agents/agent_orchestrator.py
  - backend/routers/agent_router.py
  - GET /api/agent/status/
  - POST /api/agent/run-check/

Frontend
  - frontend/lib/agent-api.ts
  - frontend/app/(admin)/agent/page.tsx
  - AgentOverview
  - AgentAlerts
  - AgentRecommendations
```

Rule phát hiện ban đầu:

```text
CAMERA_OFFLINE
  Nếu camera configured=true và online=false.

CAMERA_LATENCY_HIGH
  Nếu latency_ms > 2000.

MODEL_NOT_LOADED
  Nếu /health/ trả model_loaded=false.

DATABASE_DEGRADED
  Nếu /health/ database không sẵn sàng.

ESP32_DISCONNECTED
  Nếu sorting config enabled=true nhưng ESP32 connected=false.

SORTING_DRY_RUN_ACTIVE
  Nếu sorting enabled=true nhưng dry_run=true.

LOW_CONFIDENCE_AVERAGE
  Nếu avg_confidence trong audit summary thấp hơn ngưỡng cấu hình.
```

## Tích hợp với SFDS hiện tại

Thay đổi backend tối thiểu:

```python
from routers.agent_router import router as agent_router

app.include_router(agent_router)
```

Agent nên gọi trực tiếp service/repository nội bộ thay vì gọi HTTP loopback khi chạy cùng backend. Ví dụ:

- Dùng `get_database_info()` cho database health.
- Dùng `get_serial_scale_status()` cho cân.
- Dùng `get_esp32_relay_status()` cho ESP32.
- Dùng `get_sorting_config()` và `get_recent_sorting_commands()`.
- Dùng `get_detection_summary()` qua database session.
- Với camera health, có thể tách `_check_camera_slot` từ `scada_router.py` sang service riêng để agent dùng lại sạch hơn.

## Giai đoạn mở rộng

Sau MVP có thể thêm:

- Scheduler chạy nền mỗi 60 giây.
- WebSocket `/ws/agent/status/` để frontend nhận alert realtime.
- LLM chat để hỏi đáp vận hành bằng tiếng Việt.
- Báo cáo PDF/Excel theo ca.
- Học baseline theo từng camera để phát hiện drift.
- Tích hợp MQTT để agent nhận event realtime thay vì polling.
- Runbook theo lỗi: camera, model, database, ESP32, cân, sorting.

