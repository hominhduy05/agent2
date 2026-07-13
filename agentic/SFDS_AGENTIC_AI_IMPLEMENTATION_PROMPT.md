# SFDS Agentic AI Implementation Prompt

You are a senior AI systems architect and backend engineer working on an existing SFDS (Smart Fruit/Durian Sorting System) codebase.

Your task is to inspect the current repository first, understand the existing architecture, and then implement an Agentic AI supervision layer that monitors, analyzes, explains, and safely assists the existing SFDS system.

Do not replace the current SFDS architecture.
Do not rewrite working modules without a strong reason.
Do not put an LLM in the real-time control loop.
Do not allow an AI agent to directly control cylinders, relays, emergency systems, or other safety-critical hardware.

The existing deterministic sorting and hardware-control logic must remain the source of truth for real-time execution.

---

## 1. Current SFDS Context

The existing SFDS project is expected to contain components similar to:

- FastAPI backend:
  - `backend/main.py`

- SCADA, camera, WebSocket, sorting, and realtime logic:
  - `backend/routers/scada_router.py`

- Audit API:
  - `backend/routers/audit_router.py`

- Database models:
  - `backend/db/models.py`

- Repositories and persistence:
  - `backend/db/repositories.py`

- Sorting controller, ESP32 relay, MQTT/webhook, device integrations, and logging:
  - `backend/services/`

- Next.js frontend:
  - `frontend/app/(admin)/`

Potential existing data sources include:

- `/health/`
- `/api/scada/cameras/health/`
- `/api/scada/sorting/config/`
- `/api/scada/sorting/commands/`
- `/api/scada/sorting/esp32/`
- `/api/audit/summary/`
- `/api/audit/detections/`
- `/api/audit/sorting-commands/`
- `logs/sfds_sorting.log`
- MQTT/webhook events such as:
  - `detection.completed`
  - `sorting.command`

These names are examples based on the expected SFDS architecture.

You MUST inspect the repository and confirm the actual modules, functions, services, routers, models, and APIs before implementing anything.

Do not assume a function exists just because it is mentioned in this prompt.

---

## 2. Primary Objective

Add a new Agentic AI supervision layer with the following responsibilities:

1. Observe the current SFDS system state.
2. Collect health and operational snapshots.
3. Detect anomalies using deterministic rules first.
4. Investigate anomalies using available internal tools.
5. Generate operator-friendly insights and recommendations.
6. Store agent runs, alerts, recommendations, and actions.
7. Expose Agentic AI APIs to the frontend.
8. Keep all risky hardware actions behind explicit policies and human confirmation.
9. Preserve auditability and traceability.
10. Avoid unnecessary LLM calls when the system is healthy.

The initial MVP should prioritize reliability, observability, and safety over autonomy.

---

## 3. Important Architecture Principles

Follow these principles strictly.

### 3.1 Keep the real-time control loop deterministic

The following path must remain deterministic:

```text
Camera
  ->
Vision Model
  ->
Prediction A/B/C/D + confidence
  ->
Tracking / Routing Logic
  ->
Actuation Scheduling
  ->
PLC / ESP32 / Relay / Cylinder
```

Do NOT implement:

```text
Camera
  ->
Prediction
  ->
LLM Agent
  ->
Cylinder Command
```

The Agentic AI layer must sit above the existing control system.

---

### 3.2 Separate deterministic components from AI agents

The following should normally be deterministic:

- health collectors
- camera health checks
- sorting configuration readers
- audit queries
- log parsers
- threshold rules
- anomaly rules
- permission checks
- action policies
- action execution
- database writes
- approval enforcement

The following may use an LLM or agent reasoning:

- explaining anomalies
- combining multiple symptoms
- generating hypotheses
- suggesting operator checklists
- generating natural-language reports
- operational Q&A
- choosing which read-only diagnostic tool to call next

Do not turn every Python class into an "agent".

---

### 3.3 Prefer internal service calls over HTTP loopback

If the Agentic AI layer runs inside the same backend process or project:

Do NOT call:

```text
http://localhost:8000/api/scada/...
```

unless there is a strong architectural reason.

Instead:

```text
Agent Tool
  ->
Internal Service
  ->
Repository / Hardware Adapter
```

If router logic currently contains reusable operational logic, extract that logic into a service and let both the router and agent tool call the same service.

Example:

```text
CameraHealthService
      /        \
     v          v
REST Router   Agent Tool
```

---

## 4. Recommended Folder Structure

Use the following structure as a target, but adapt it to the real repository after inspection.

```text
SFDS/
  backend/
    agentic/
      __init__.py

      runtime/
        __init__.py
        orchestrator.py
        runner.py
        triggers.py

      agents/
        __init__.py

        supervisor/
          __init__.py
          agent.py
          instructions.py
          schemas.py

        advisor/
          __init__.py
          agent.py
          instructions.py
          schemas.py

        reporter/
          __init__.py
          agent.py
          instructions.py
          schemas.py

      monitors/
        __init__.py
        health_monitor.py
        camera_monitor.py
        sorting_monitor.py
        audit_monitor.py
        log_monitor.py

      analyzers/
        __init__.py
        anomaly_detector.py
        cause_analyzer.py
        trend_analyzer.py
        baseline_analyzer.py

      tools/
        __init__.py
        health_tools.py
        camera_tools.py
        sorting_tools.py
        audit_tools.py
        log_tools.py
        alert_tools.py
        report_tools.py

      workflows/
        __init__.py
        health_check_workflow.py
        anomaly_investigation.py
        incident_workflow.py
        daily_report_workflow.py

      state/
        __init__.py
        system_snapshot.py
        agent_state.py
        incident_state.py

      memory/
        __init__.py
        event_store.py
        incident_memory.py
        summarizer.py

      policies/
        __init__.py
        permissions.py
        action_policy.py
        approval_policy.py
        thresholds.py

      actions/
        __init__.py
        registry.py
        executor.py
        safe_actions.py
        controlled_actions.py

      schemas/
        __init__.py
        snapshot.py
        alert.py
        recommendation.py
        action.py
        report.py

      observability/
        __init__.py
        audit.py
        metrics.py
        tracing.py

    routers/
      agent_router.py

    db/
      agent_models.py
      agent_repositories.py
```

Do not create empty folders merely to match this structure.

Only add modules that are needed for the current implementation stage.

---

## 5. MVP Scope

Implement Version 1 first.

Version 1 should include:

### Backend

- deterministic system snapshot collection
- deterministic rule-based anomaly detection
- one `SupervisorAgent`
- agent run persistence
- alert persistence
- recommendation persistence
- safe read-only diagnostic tools
- controlled action registry
- Agentic AI API router

### Frontend

- Agent Overview page
- Current system health summary
- Active alerts
- Recommendations
- Agent run timeline

Do NOT build five LLM agents in Version 1.

The preferred MVP is:

```text
Trigger
  ->
Snapshot Collectors
  ->
System Snapshot
  ->
Rule-Based Anomaly Detector
  ->
If Normal:
    store metrics and finish
  ->
If Anomaly:
    run SupervisorAgent
      ->
    investigate with read-only tools
      ->
    generate insight
      ->
    generate recommendation
      ->
    persist results
```

---

## 6. Initial Agent Design

Start with only one LLM-powered agent:

```text
SupervisorAgent
```

Responsibilities:

- inspect anomaly findings
- call read-only diagnostic tools
- correlate evidence
- explain likely causes
- clearly distinguish facts from hypotheses
- generate next-step recommendations
- propose safe actions
- never directly execute unsafe hardware commands

The agent must not claim a root cause unless it is actually confirmed.

Preferred output structure:

```json
{
  "severity": "warning",
  "title": "Camera 3 appears offline",
  "confirmed_facts": [
    "camera_3.configured = true",
    "camera_3.online = false",
    "no frames received in the last 180 seconds"
  ],
  "hypotheses": [
    {
      "cause": "Network connectivity issue",
      "confidence": 0.72
    },
    {
      "cause": "Camera process failure",
      "confidence": 0.55
    }
  ],
  "recommended_checks": [
    "Check the camera network endpoint",
    "Check the camera capture process",
    "Verify power and cable connection"
  ],
  "proposed_actions": [
    {
      "action_key": "RECHECK_CAMERA_HEALTH",
      "requires_confirmation": false
    }
  ]
}
```

Use Pydantic structured outputs where practical.

---

## 7. Monitors

Implement deterministic monitors.

### 7.1 Health Monitor

Collect, where available:

- backend health
- model loaded status
- database status
- serial scale status
- critical device status

### 7.2 Camera Monitor

Collect:

- configured
- online/offline
- latency
- last successful frame
- recent detection count
- camera-specific errors

### 7.3 Sorting Monitor

Collect:

- sorting enabled
- dry-run mode
- current routing configuration
- recent sorting commands
- recent failures
- ESP32 / relay connection status

### 7.4 Audit Monitor

Collect:

- detection count
- grade/class distribution
- average confidence
- low-confidence rate
- sorting command count
- sorting error count

### 7.5 Log Monitor

Read only recent relevant lines.

Do not load an entire unbounded log file into memory or an LLM context.

Implement safe limits.

---

## 8. System Snapshot

Create a normalized system snapshot schema.

Example:

```json
{
  "captured_at": "2026-07-07T14:00:00+07:00",
  "backend": {
    "healthy": true
  },
  "model": {
    "loaded": true
  },
  "database": {
    "available": true
  },
  "cameras": [
    {
      "camera_id": "camera_3",
      "configured": true,
      "online": false,
      "latency_ms": null,
      "last_frame_at": "2026-07-07T13:57:00+07:00"
    }
  ],
  "sorting": {
    "enabled": true,
    "dry_run": false,
    "esp32_connected": true
  },
  "audit": {
    "detection_count": 420,
    "average_confidence": 0.88
  }
}
```

The snapshot is the shared source of truth for a single agent run.

Avoid allowing each agent or analyzer to independently fetch inconsistent system state unless a fresh diagnostic call is explicitly required.

---

## 9. Initial Deterministic Anomaly Rules

Implement these rules only if the underlying data is actually available.

### CAMERA_OFFLINE

Condition:

```text
camera.configured == true
AND
camera.online == false
```

### CAMERA_LATENCY_HIGH

Use configuration-based thresholds.

Do not hardcode `2000 ms` throughout the codebase.

Example:

```text
warning > configured warning threshold
critical > configured critical threshold
```

### MODEL_NOT_LOADED

Condition:

```text
model_loaded == false
```

### DATABASE_DEGRADED

Condition:

```text
database unavailable or unhealthy
```

### ESP32_DISCONNECTED

Condition:

```text
sorting.enabled == true
AND
esp32.connected == false
```

### SORTING_DRY_RUN_ACTIVE

Condition:

```text
sorting.enabled == true
AND
sorting.dry_run == true
```

Treat severity according to the real operating mode.

Do not assume dry-run is always an error.

### LOW_CONFIDENCE_AVERAGE

Use:

- configurable threshold
- minimum sample size
- time window

Example:

```text
sample_count >= min_sample_size
AND
average_confidence < threshold
```

### DETECTION_COUNT_ANOMALY

Prefer comparison to a historical or rolling baseline when available.

Avoid simplistic absolute thresholds when cameras have different normal behavior.

---

## 10. Threshold Configuration

Create centralized threshold configuration.

Example:

```yaml
agentic:
  anomaly_thresholds:
    camera:
      latency_warning_ms: 1500
      latency_critical_ms: 3000

    confidence:
      minimum_average: 0.75
      minimum_sample_size: 30

    esp32:
      disconnect_grace_seconds: 10
```

Adapt this format to the configuration approach already used by SFDS.

Do not introduce YAML if the project already uses environment variables or Pydantic settings consistently.

---

## 11. Action Safety Model

Implement four action risk levels:

```text
SAFE_READ
SAFE_WRITE
CONFIRM_REQUIRED
FORBIDDEN
```

### SAFE_READ

Examples:

- read health
- read camera status
- read audit summary
- read recent logs
- generate reports

May execute automatically.

### SAFE_WRITE

Examples:

- acknowledge an agent alert
- trigger a new health check
- save a recommendation
- toggle demo mode only if the existing system explicitly supports a safe demo mode

May execute automatically only through a known registered action and must be audited.

### CONFIRM_REQUIRED

Examples:

- finalize a batch
- modify camera configuration
- modify sorting configuration
- restart a camera stream
- send relay/ESP32 commands
- stop or start operational flows

Do not execute without explicit approval.

### FORBIDDEN

Examples:

- bypass safety interlocks
- disable emergency stop
- arbitrary relay commands
- arbitrary cylinder actuation
- arbitrary production database modification
- delete audit history
- directly replace production model
- disable safety policy enforcement

Always reject these actions.

---

## 12. Action Execution Architecture

Do not let the LLM execute arbitrary functions.

Use:

```text
Agent
  ->
Proposed Action
  ->
Action Registry
  ->
Policy Check
  ->
Payload Validation
  ->
Approval Check
  ->
Deterministic Action Executor
  ->
Existing SFDS Service
  ->
Audit Result
```

Example registry concept:

```python
ACTION_REGISTRY = {
    "RECHECK_HEALTH": ActionDefinition(
        risk_level="SAFE_WRITE",
        handler=recheck_health,
    ),
    "RESTART_CAMERA_STREAM": ActionDefinition(
        risk_level="CONFIRM_REQUIRED",
        handler=restart_camera_stream,
    ),
}
```

Never dynamically import arbitrary functions from user-provided action keys.

Unknown actions must be rejected.

---

## 13. Database Models

Add models carefully and follow the existing ORM style.

Recommended entities:

### agent_runs

Fields:

```text
id
started_at
finished_at
status
trigger_source
trigger_event_id
correlation_id
summary
snapshot_id or raw_snapshot_json
created_at
```

### agent_alerts

Fields:

```text
id
run_id
incident_id
code
severity
title
message
source
camera_slot
status
first_seen_at
last_seen_at
acknowledged_at
resolved_at
created_at
```

Preferred alert statuses:

```text
OPEN
ACKNOWLEDGED
INVESTIGATING
RESOLVED
SUPPRESSED
```

Do not rely only on:

```text
is_active = true/false
```

### agent_recommendations

Fields:

```text
id
alert_id
priority
recommendation
action_key
requires_confirmation
created_at
```

### agent_actions

Fields:

```text
id
action_key
risk_level
requested_by
payload_json
result_json
status
created_at
updated_at
```

Preferred action lifecycle:

```text
PROPOSED
PENDING_APPROVAL
APPROVED
REJECTED
EXECUTING
SUCCEEDED
FAILED
```

### agent_approvals

Fields:

```text
id
action_id
status
requested_at
requested_by
decided_at
decided_by
decision_reason
```

### agent_incidents

Fields:

```text
id
code
title
severity
status
opened_at
resolved_at
root_cause
resolution
```

### agent_tool_calls

Fields:

```text
id
run_id
tool_name
input_json
output_summary
status
started_at
finished_at
```

Implement only what is necessary for the current MVP.

Do not create excessive tables without use.

---

## 14. Deduplication and Correlation

The system may receive triggers from:

- scheduler
- manual run
- MQTT
- webhook

Prevent duplicate runs and duplicate alerts.

Use concepts such as:

```text
trigger_event_id
correlation_id
deduplication_key
```

For repeated anomalies:

```text
Existing active alert with same deduplication key?
  ->
Yes:
  update last_seen_at and evidence
No:
  create new alert
```

Do not create a new `CAMERA_OFFLINE` alert every 60 seconds for the same unresolved camera incident.

---

## 15. API Endpoints

Implement a clean Agentic AI API.

Recommended endpoints:

```text
GET  /api/agent/status

POST /api/agent/runs
GET  /api/agent/runs
GET  /api/agent/runs/{run_id}

GET  /api/agent/alerts
GET  /api/agent/alerts/{alert_id}
POST /api/agent/alerts/{alert_id}/acknowledge
POST /api/agent/alerts/{alert_id}/resolve

GET  /api/agent/incidents
GET  /api/agent/incidents/{incident_id}

GET  /api/agent/recommendations

POST /api/agent/chat

GET  /api/agent/reports/shift
GET  /api/agent/reports/daily

GET  /api/agent/actions
POST /api/agent/actions
GET  /api/agent/actions/{action_id}

POST /api/agent/actions/{action_id}/approve
POST /api/agent/actions/{action_id}/reject
POST /api/agent/actions/{action_id}/execute
```

For the MVP, implement only the endpoints required by the implemented frontend.

Do not add dead endpoints.

---

## 16. Frontend

Add a new admin section.

Recommended target:

```text
frontend/
  app/(admin)/
    agent/
      page.tsx
      page.module.css

  components/agent/
    AgentOverview.tsx
    AgentAlerts.tsx
    AgentRecommendations.tsx
    AgentRunTimeline.tsx
    AgentIncidents.tsx
    AgentActionApproval.tsx
    AgentEvidenceDrawer.tsx

  lib/
    agent-api.ts
    agent-types.ts
```

The frontend should show:

- overall system health
- active alerts
- severity
- evidence
- recommendations
- latest agent runs
- action approval state
- incident timeline

When an AI-generated conclusion is shown, provide evidence.

Example:

```text
Camera 3 may be offline
```

The UI should allow the operator to inspect:

```text
configured = true
online = false
last_frame_at = ...
recent_detection_count = 0
```

Do not display unexplained AI conclusions.

---

## 17. Scheduler and Event Triggers

Support these trigger types conceptually:

```text
manual
scheduled
webhook
mqtt
```

For Version 1:

- manual run is required
- scheduled run is optional
- MQTT/webhook-triggered execution can be added after MVP stability

Do not run an expensive LLM chain every 30–60 seconds.

Preferred logic:

```text
Every 30–60 seconds:
  collect deterministic snapshot
  run deterministic anomaly rules

If no anomaly:
  store lightweight metrics
  finish

If anomaly:
  invoke SupervisorAgent
```

This is important for latency, reliability, and cost.

---

## 18. Agent Chat

Implement chat only after basic monitoring works.

Example operator questions:

```text
Why is camera 3 offline?
```

```text
Why did average confidence drop in the last 30 minutes?
```

```text
What should the operator check first?
```

The chat agent must use internal tools and real SFDS data.

Do not let it answer operational questions purely from model memory when live system evidence is needed.

The answer should distinguish:

```text
Confirmed facts
Likely hypotheses
Recommended checks
```

---

## 19. Reports

Reports may include:

- total detections
- grade distribution A/B/C/D
- average confidence
- low-confidence rate
- camera uptime
- camera latency
- sorting command count
- sorting failure count
- ESP32 availability
- active incidents
- resolved incidents
- major anomalies
- operator actions

Do not generate operational metrics from LLM estimates.

All numeric values must come from actual SFDS data.

---

## 20. Observability and Audit

Every agent run should be traceable.

Capture:

- trigger source
- snapshot ID
- anomalies found
- tools called
- actions proposed
- actions executed
- approval decisions
- final summary
- execution errors
- timing information

Maintain a distinction between:

```text
AI trace
```

and:

```text
business / operational audit
```

If the chosen agent framework provides tracing, integrate it where useful, but still preserve SFDS business audit records.

---

## 21. Error Handling

Implement explicit failure handling.

Examples:

- camera monitor timeout
- database query failure
- ESP32 status unavailable
- log file missing
- malformed tool result
- LLM timeout
- invalid structured output
- duplicate trigger
- action policy rejection

The agent run should not crash silently.

A partial snapshot should clearly mark unavailable sources.

Example:

```json
{
  "database": {
    "status": "unavailable",
    "error": "connection timeout"
  }
}
```

Do not fabricate missing data.

---

## 22. Testing Requirements

Add tests for:

### Unit Tests

- anomaly rules
- threshold evaluation
- alert deduplication
- action policy
- action registry
- payload validation
- state transitions

### Integration Tests

- snapshot collection
- alert persistence
- agent run creation
- router endpoints
- internal service reuse

### Agent Tests

Use mocked tools where practical.

Test:

- agent does not invent unavailable facts
- agent distinguishes facts from hypotheses
- agent proposes only registered actions
- agent cannot execute forbidden actions

### Safety Tests

Verify:

- unknown action rejected
- forbidden action rejected
- confirm-required action cannot execute without approval
- arbitrary relay/cylinder action cannot be created from free-form input

---

## 23. Implementation Process

Follow this process exactly.

### Step 1: Inspect the repository

Before modifying code:

- inspect backend structure
- inspect existing routers
- inspect services
- inspect repositories
- inspect database models
- inspect configuration system
- inspect logging
- inspect MQTT/webhook implementation
- inspect frontend admin layout
- inspect current test setup

Produce a concise architecture summary.

### Step 2: Map existing reusable functions

Identify actual reusable functions for:

- database health
- model health
- serial scale status
- camera health
- sorting configuration
- sorting commands
- ESP32 state
- detection summary
- logs

If reusable logic is buried inside routers, identify minimal service extractions.

### Step 3: Produce an implementation plan

Before coding, list:

- files to add
- files to modify
- database migrations
- reused services
- extracted services
- API endpoints
- safety constraints

Keep the plan minimal.

### Step 4: Implement MVP backend

Recommended order:

1. schemas
2. system snapshot
3. monitors
4. rule-based anomaly detector
5. persistence
6. orchestrator
7. SupervisorAgent
8. tools
9. API router
10. tests

### Step 5: Implement MVP frontend

Add only the components required by working backend endpoints.

### Step 6: Validate

Run:

- tests
- linting
- type checks
- backend startup
- frontend build if available

Fix issues introduced by the implementation.

---

## 24. Coding Rules

Follow the existing project style.

Also follow these rules:

- use type hints
- use Pydantic schemas for API and structured agent outputs
- keep functions small
- avoid circular imports
- do not put business logic in FastAPI routers
- do not put large SQL logic inside agent tools
- use dependency injection patterns already present in the project
- use async only where appropriate
- do not swallow exceptions
- use structured logging
- never log secrets
- never expose API keys
- never allow arbitrary function execution
- never allow arbitrary shell execution from the agent
- never allow arbitrary SQL from the agent
- never allow arbitrary hardware commands from the agent

---

## 25. Non-Goals for Version 1

Do NOT implement these unless the repository already has a safe foundation and they are explicitly required:

- autonomous cylinder control
- autonomous relay control
- automatic safety configuration changes
- automatic production model replacement
- fully autonomous multi-agent company simulation
- vector database just for the sake of using RAG
- five LLM agents running continuously
- unrestricted shell access
- unrestricted database access
- autonomous code deployment
- Kubernetes
- Kafka unless already required by the existing system

---

## 26. Preferred MVP Result

The final MVP should work like this:

```text
Operator or Scheduler
        |
        v
Agent Orchestrator
        |
        v
Collect System Snapshot
        |
        v
Rule-Based Anomaly Detector
        |
   +----+----+
   |         |
 Normal    Anomaly
   |         |
   v         v
 Store     SupervisorAgent
             |
             v
      Diagnostic Tools
             |
             v
        Investigation
             |
             v
   Insight + Recommendation
             |
             v
       Persist Results
             |
             v
       Frontend Display
```

The SupervisorAgent must not be in the real-time sorting or cylinder-control loop.

---

## 27. Required Final Response After Implementation

After completing the work, provide:

### A. Repository Understanding

A concise summary of the existing SFDS architecture you discovered.

### B. Files Added

List all newly created files.

### C. Files Modified

List all modified files.

### D. Architecture Decisions

Explain:

- what remained deterministic
- what became agentic
- why the LLM is not in the hardware control loop
- how actions are protected

### E. Database Changes

List:

- models
- migrations
- indexes
- lifecycle fields

### F. API Changes

List all implemented endpoints.

### G. Safety Controls

Explain:

- action risk levels
- policy checks
- approval requirements
- forbidden actions

### H. Test Results

Report actual tests run and their real results.

Do not claim tests passed if they were not executed.

### I. Remaining Risks and Next Steps

Clearly list unfinished work and technical risks.

---

## 28. Final Priority Order

When trade-offs occur, prioritize:

```text
1. Safety
2. Correctness
3. Compatibility with existing SFDS
4. Observability
5. Maintainability
6. Simplicity
7. Agent autonomy
```

Agent autonomy is intentionally the lowest priority for Version 1.

Build a reliable supervision layer first.
Add autonomy only after the system has evidence, policies, approvals, and auditability.

Begin by inspecting the repository.
Do not start coding until you understand the actual SFDS structure.
