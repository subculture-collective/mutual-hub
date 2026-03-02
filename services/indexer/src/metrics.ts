import type { CheckpointHealth } from '@patchwork/shared';

/**
 * Ingestion runtime metrics for the indexer pipeline.
 * Tracks checkpoint health, event processing counts, and errors.
 */
export interface IngestionRuntimeMetrics {
    /** Seconds since the last checkpoint was saved. */
    checkpointLagSeconds: number | null;
    /** The sequence number of the most recent checkpoint write. */
    checkpointSequence: number | null;
    /** The firehose cursor stored in the last checkpoint. */
    checkpointCursor: number | null;
    /** Whether the checkpoint store is healthy. */
    checkpointHealthy: boolean;
    /** Total number of firehose events successfully processed. */
    ingestEventsTotal: number;
    /** Total number of processing errors. */
    ingestErrorsTotal: number;
    /** Process uptime in seconds. */
    uptimeSeconds: number;
}

/**
 * Mutable counters that the pipeline updates during ingestion.
 */
export class MetricsCollector {
    private _ingestEventsTotal = 0;
    private _ingestErrorsTotal = 0;

    recordEvents(count: number): void {
        this._ingestEventsTotal += count;
    }

    recordErrors(count: number): void {
        this._ingestErrorsTotal += count;
    }

    get ingestEventsTotal(): number {
        return this._ingestEventsTotal;
    }

    get ingestErrorsTotal(): number {
        return this._ingestErrorsTotal;
    }

    reset(): void {
        this._ingestEventsTotal = 0;
        this._ingestErrorsTotal = 0;
    }

    /**
     * Build a full metrics snapshot incorporating checkpoint health.
     */
    snapshot(checkpointHealth: CheckpointHealth): IngestionRuntimeMetrics {
        return {
            checkpointLagSeconds: checkpointHealth.lagSeconds,
            checkpointSequence:
                checkpointHealth.lastCheckpoint?.sequence ?? null,
            checkpointCursor:
                checkpointHealth.lastCheckpoint?.cursor ?? null,
            checkpointHealthy: checkpointHealth.healthy,
            ingestEventsTotal: this._ingestEventsTotal,
            ingestErrorsTotal: this._ingestErrorsTotal,
            uptimeSeconds: Math.floor(process.uptime()),
        };
    }
}

const PROMETHEUS_LABELS =
    '{project="patchwork",service="indexer",component="spool"}';

/**
 * Render ingestion runtime metrics in Prometheus exposition format.
 */
export const renderPrometheusRuntimeMetrics = (
    metrics: IngestionRuntimeMetrics,
): string => {
    const lines: string[] = [];

    lines.push(
        '# HELP patchwork_service_up Service health status (1 = up).',
        '# TYPE patchwork_service_up gauge',
        `patchwork_service_up${PROMETHEUS_LABELS} 1`,
    );

    lines.push(
        '# HELP patchwork_process_uptime_seconds Process uptime in seconds.',
        '# TYPE patchwork_process_uptime_seconds counter',
        `patchwork_process_uptime_seconds${PROMETHEUS_LABELS} ${metrics.uptimeSeconds}`,
    );

    lines.push(
        '# HELP patchwork_checkpoint_lag_seconds Seconds since last checkpoint save.',
        '# TYPE patchwork_checkpoint_lag_seconds gauge',
        `patchwork_checkpoint_lag_seconds${PROMETHEUS_LABELS} ${metrics.checkpointLagSeconds ?? -1}`,
    );

    lines.push(
        '# HELP patchwork_checkpoint_sequence Monotonic sequence of checkpoint writes.',
        '# TYPE patchwork_checkpoint_sequence counter',
        `patchwork_checkpoint_sequence${PROMETHEUS_LABELS} ${metrics.checkpointSequence ?? 0}`,
    );

    lines.push(
        '# HELP patchwork_checkpoint_cursor Last saved firehose cursor position.',
        '# TYPE patchwork_checkpoint_cursor gauge',
        `patchwork_checkpoint_cursor${PROMETHEUS_LABELS} ${metrics.checkpointCursor ?? -1}`,
    );

    lines.push(
        '# HELP patchwork_checkpoint_healthy Whether the checkpoint store is operational.',
        '# TYPE patchwork_checkpoint_healthy gauge',
        `patchwork_checkpoint_healthy${PROMETHEUS_LABELS} ${metrics.checkpointHealthy ? 1 : 0}`,
    );

    lines.push(
        '# HELP patchwork_ingest_events_total Total firehose events processed.',
        '# TYPE patchwork_ingest_events_total counter',
        `patchwork_ingest_events_total${PROMETHEUS_LABELS} ${metrics.ingestEventsTotal}`,
    );

    lines.push(
        '# HELP patchwork_ingest_errors_total Total ingestion errors.',
        '# TYPE patchwork_ingest_errors_total counter',
        `patchwork_ingest_errors_total${PROMETHEUS_LABELS} ${metrics.ingestErrorsTotal}`,
    );

    // SLI-aligned metrics for cross-service consistency
    lines.push(
        '# HELP patchwork_sli_request_total Total ingestion events (SLI-aligned).',
        '# TYPE patchwork_sli_request_total counter',
        `patchwork_sli_request_total${PROMETHEUS_LABELS} ${metrics.ingestEventsTotal}`,
    );

    lines.push(
        '# HELP patchwork_sli_error_total Total ingestion errors (SLI-aligned).',
        '# TYPE patchwork_sli_error_total counter',
        `patchwork_sli_error_total${PROMETHEUS_LABELS} ${metrics.ingestErrorsTotal}`,
    );

    return lines.join('\n');
};
