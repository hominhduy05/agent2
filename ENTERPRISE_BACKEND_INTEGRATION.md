# Enterprise Backend Integration

This workspace has two backend services:

- `SFDS backend` (`http://localhost:9000`): SCADA, camera, YOLO inference, dataset.
- `Agent backend` (`http://localhost:8001`): AI assistant, reports, REST proxy, event ingestion.

## Integration Pattern

Use REST for request/response workflows:

- Health checks
- Camera configuration
- Dataset statistics
- Image detection on demand
- Reports and AI chat

Use events for realtime production signals:

- Detection completed
- Reject/alarm decisions
- Conveyor status
- OEE/shift metrics

## REST Data Flow

```text
Frontend -> Agent BE -> SFDS BE -> Agent BE -> Frontend
```

Agent proxy endpoints:

- `GET /api/sfds/health`
- `GET /api/sfds/cameras`
- `GET /api/sfds/stats`
- `POST /api/sfds/detection`

SFDS source endpoints:

- `GET /health/`
- `GET /api/scada/cameras/`
- `GET /api/dataset/stats/`
- `POST /detect/`

## Event Contract

Events use this envelope:

```json
{
  "event_id": "uuid",
  "event_type": "detection.completed",
  "source": "sfds",
  "version": "1.0",
  "occurred_at": "2026-06-02T10:30:00Z",
  "line_id": "line_01",
  "camera_slot": 0,
  "correlation_id": null,
  "payload": {}
}
```

Current SFDS event:

- `detection.completed`

Agent event endpoints:

- `POST /api/sfds/events`
- `GET /api/sfds/events?limit=50`
- `GET /api/sfds/events?event_type=detection.completed`

## Local Deployment

For simple local REST-only use:

```env
SFDS_BASE_URL=http://localhost:9000
```

To push SFDS events to Agent without a broker:

```env
SFDS_EVENT_WEBHOOK_URL=http://localhost:8001/api/sfds/events
```

To publish events to MQTT:

```env
MQTT_HOST=localhost:1883
MQTT_TOPIC_PREFIX=durian
```

In production, keep REST behind an internal gateway and route events through MQTT, Kafka, RabbitMQ, or another managed broker. The event envelope should stay the same when the transport changes.
