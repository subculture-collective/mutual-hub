# SLI/SLO Definitions -- Patchwork Platform

## Service Level Indicators (SLIs)

All services expose Prometheus-compatible metrics at their `/metrics` endpoint.
Metric names follow the `patchwork_sli_` prefix with standard labels:

```
{project="patchwork", service="<api|indexer|moderation-worker>", component="<stitch|spool|thimble>"}
```

### Standard SLI Metrics

| Metric Name | Type | Description |
|---|---|---|
| `patchwork_sli_request_total` | counter | Total requests/events processed |
| `patchwork_sli_error_total` | counter | Total errors encountered |
| `patchwork_sli_request_duration_seconds` | counter | Cumulative request duration |
| `patchwork_sli_saturation_ratio` | gauge | Resource saturation (0-1) |

### Per-Service Metrics

#### API (`service="api"`)

- `patchwork_service_up` -- 1 when process is running
- `patchwork_process_uptime_seconds` -- process uptime
- `patchwork_sli_request_total` -- total HTTP requests served
- `patchwork_sli_error_total` -- total 5xx responses
- `patchwork_sli_request_duration_seconds` -- cumulative duration across all requests
- `patchwork_sli_saturation_ratio` -- heap memory saturation

#### Indexer (`service="indexer"`)

- `patchwork_service_up` -- 1 when process is running
- `patchwork_process_uptime_seconds` -- process uptime
- `patchwork_checkpoint_lag_seconds` -- seconds since last checkpoint
- `patchwork_checkpoint_healthy` -- 1 if checkpoint store is operational
- `patchwork_ingest_events_total` -- total firehose events processed
- `patchwork_ingest_errors_total` -- total ingestion errors
- `patchwork_sli_request_total` -- mirrors ingest_events_total (SLI-aligned)
- `patchwork_sli_error_total` -- mirrors ingest_errors_total (SLI-aligned)

#### Moderation Worker (`service="moderation-worker"`)

- `patchwork_service_up` -- 1 when process is running
- `patchwork_process_uptime_seconds` -- process uptime
- `moderation_queue_depth` -- current queue depth
- `moderation_queue_latency_seconds` -- average enqueue-to-dequeue latency
- `moderation_actions_total` -- total actions by type
- `moderation_errors_total` -- total processing errors
- `patchwork_sli_request_total` -- mirrors total actions (SLI-aligned)
- `patchwork_sli_error_total` -- mirrors moderation_errors_total (SLI-aligned)
- `patchwork_sli_saturation_ratio` -- queue depth / 1000 capacity

## Service Level Objectives (SLOs)

| SLO | Target | Measurement |
|---|---|---|
| Availability | 99.5% uptime per rolling 30-day window | `avg_over_time(patchwork_service_up[30d])` |
| API Latency (p95) | < 500ms | `histogram_quantile(0.95, patchwork_sli_request_duration_seconds)` |
| Error Rate | < 0.5% of total requests | `patchwork_sli_error_total / patchwork_sli_request_total` |
| Indexer Checkpoint Lag | < 60 seconds | `patchwork_checkpoint_lag_seconds` |
| Moderation Queue Latency | p95 < 30 seconds | `moderation_queue_latency_seconds` |

## Dashboard Query Examples

### Availability (all services)

```promql
avg_over_time(patchwork_service_up{project="patchwork"}[30d]) * 100
```

### API Error Rate (last 5m)

```promql
rate(patchwork_sli_error_total{service="api"}[5m])
/ rate(patchwork_sli_request_total{service="api"}[5m])
```

### Indexer Checkpoint Lag

```promql
patchwork_checkpoint_lag_seconds{service="indexer"}
```

### Moderation Queue Saturation

```promql
patchwork_sli_saturation_ratio{service="moderation-worker"}
```

### Memory Saturation Across All Services

```promql
patchwork_sli_saturation_ratio{project="patchwork"}
```

## Health Endpoints

Each service exposes two health endpoints:

| Endpoint | Purpose | HTTP Status |
|---|---|---|
| `GET /health` | Liveness probe. Returns current status with checks. | 200 always |
| `GET /health/ready` | Readiness probe. Returns 503 if any check is `not_ready`. | 200 or 503 |

Response schema:

```json
{
  "service": "api",
  "status": "ok | degraded | not_ready",
  "contractVersion": "0.8.0-phase8",
  "did": "did:web:example.com",
  "checks": {
    "database": { "status": "ok" },
    "checkpoint": { "status": "degraded", "message": "high lag" }
  }
}
```
