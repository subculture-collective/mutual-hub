import type { ModerationPolicyAction } from '@patchwork/shared';

const SERVICE_LABELS =
    'project="patchwork",service="moderation-worker",component="thimble"';

/**
 * Simple Prometheus-compatible metrics collector for moderation operations.
 * Exports log-based metric counters and gauges.
 */
export class ModerationMetrics {
    private queueDepth = 0;
    private readonly latencySamples: number[] = [];
    private readonly actionCounters = new Map<string, number>();
    private errorCount = 0;
    private readonly enqueueTimestamps = new Map<string, number>();

    /** Record when a queue item is enqueued (for latency tracking). */
    recordEnqueue(subjectUri: string): void {
        this.enqueueTimestamps.set(subjectUri, Date.now());
        this.queueDepth++;
    }

    /** Record when a queue item is dequeued/processed (for latency tracking). */
    recordDequeue(subjectUri: string): void {
        const enqueuedAt = this.enqueueTimestamps.get(subjectUri);
        if (enqueuedAt !== undefined) {
            const latencyMs = Date.now() - enqueuedAt;
            this.latencySamples.push(latencyMs / 1000);
            this.enqueueTimestamps.delete(subjectUri);
        }
        if (this.queueDepth > 0) {
            this.queueDepth--;
        }
    }

    /** Set the current queue depth (e.g., from store count). */
    setQueueDepth(depth: number): void {
        this.queueDepth = depth;
    }

    /** Record a policy action being applied. */
    recordAction(action: ModerationPolicyAction): void {
        const current = this.actionCounters.get(action) ?? 0;
        this.actionCounters.set(action, current + 1);
    }

    /** Record an error. */
    recordError(): void {
        this.errorCount++;
    }

    /** Get the current queue depth. */
    getQueueDepth(): number {
        return this.queueDepth;
    }

    /** Get the action count for a specific action type. */
    getActionCount(action: ModerationPolicyAction): number {
        return this.actionCounters.get(action) ?? 0;
    }

    /** Get the total error count. */
    getErrorCount(): number {
        return this.errorCount;
    }

    /** Get the average latency in seconds. */
    getAverageLatencySeconds(): number {
        if (this.latencySamples.length === 0) {
            return 0;
        }
        const sum = this.latencySamples.reduce(
            (accumulator, value) => accumulator + value,
            0,
        );
        return sum / this.latencySamples.length;
    }

    /** Get the total number of actions processed. */
    getTotalActions(): number {
        let total = 0;
        for (const count of this.actionCounters.values()) {
            total += count;
        }
        return total;
    }

    /** Render Prometheus-format text output. */
    renderPrometheus(): string {
        const lines: string[] = [];

        lines.push(
            '# HELP moderation_queue_depth Current number of items in the moderation queue.',
        );
        lines.push('# TYPE moderation_queue_depth gauge');
        lines.push(
            `moderation_queue_depth{${SERVICE_LABELS}} ${this.queueDepth}`,
        );

        lines.push(
            '# HELP moderation_queue_latency_seconds Time from enqueue to dequeue in seconds.',
        );
        lines.push('# TYPE moderation_queue_latency_seconds gauge');
        const avgLatency = this.getAverageLatencySeconds();
        lines.push(
            `moderation_queue_latency_seconds{${SERVICE_LABELS}} ${avgLatency.toFixed(6)}`,
        );

        lines.push(
            '# HELP moderation_actions_total Total moderation actions by type.',
        );
        lines.push('# TYPE moderation_actions_total counter');
        for (const [action, count] of this.actionCounters.entries()) {
            lines.push(
                `moderation_actions_total{${SERVICE_LABELS},action="${action}"} ${count}`,
            );
        }
        if (this.actionCounters.size === 0) {
            lines.push(
                `moderation_actions_total{${SERVICE_LABELS},action="none"} 0`,
            );
        }

        lines.push(
            '# HELP moderation_errors_total Total moderation processing errors.',
        );
        lines.push('# TYPE moderation_errors_total counter');
        lines.push(
            `moderation_errors_total{${SERVICE_LABELS}} ${this.errorCount}`,
        );

        return lines.join('\n');
    }

    /** Reset all metrics (useful for tests). */
    reset(): void {
        this.queueDepth = 0;
        this.latencySamples.length = 0;
        this.actionCounters.clear();
        this.errorCount = 0;
        this.enqueueTimestamps.clear();
    }
}
