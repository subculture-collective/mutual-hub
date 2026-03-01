import { createServer, type ServerResponse } from 'node:http';
import {
    CONTRACT_VERSION,
    loadModerationWorkerConfig,
    type ModerationDecisionEvent,
    type ServiceHealth,
} from '@patchwork/shared';
import {
    createFixtureModerationWorkerService,
    type ModerationWorkerServiceOptions,
} from './moderation-service.js';
import { InMemoryQueueStore } from './queue-store.js';
import { InMemoryAuditStore } from './audit-store.js';
import { ModerationMetrics } from './metrics.js';

const config = loadModerationWorkerConfig();

const databaseUrl = process.env.DATABASE_URL;

const metrics = new ModerationMetrics();

const serviceOptions: ModerationWorkerServiceOptions = (() => {
    if (databaseUrl) {
        // Production mode: would use Postgres-backed stores.
        // For now, fall back to in-memory stores that persist within process lifetime.
        console.log(
            '[moderation-worker] DATABASE_URL detected; using in-memory stores (Postgres stores planned).',
        );
    }

    // Dev/test mode (and current prod fallback): in-memory stores with metrics.
    const queueStore = new InMemoryQueueStore();
    const auditStore = new InMemoryAuditStore();
    return { queueStore, auditStore, metrics };
})();

const moderationService = createFixtureModerationWorkerService(serviceOptions);

const healthPayload: ServiceHealth = {
    service: 'moderation-worker',
    status: 'ok',
    contractVersion: CONTRACT_VERSION,
    did: config.ATPROTO_SERVICE_DID,
};

const renderPrometheusMetrics = (): string => {
    const uptimeSeconds = Math.floor(process.uptime());

    const baseMetrics = [
        '# HELP patchwork_service_up Service health status (1 = up).',
        '# TYPE patchwork_service_up gauge',
        'patchwork_service_up{project="patchwork",service="moderation-worker",component="thimble"} 1',
        '# HELP patchwork_process_uptime_seconds Process uptime in seconds.',
        '# TYPE patchwork_process_uptime_seconds counter',
        `patchwork_process_uptime_seconds{project="patchwork",service="moderation-worker",component="thimble"} ${uptimeSeconds}`,
    ].join('\n');

    const moderationMetricsText = metrics.renderPrometheus();

    return `${baseMetrics}\n${moderationMetricsText}`;
};

const sampleDecision: ModerationDecisionEvent = {
    eventId: 'mod-phase1-sample',
    subjectUri: 'at://did:example:author/app.mutual.aid/abc123',
    action: 'none',
    reason: 'phase1 baseline stub',
    decidedAt: new Date().toISOString(),
};

interface ModerationRouteResult {
    statusCode: number;
    body: unknown;
    contentType?: string;
}

type ModerationRouteHandler = (requestUrl: URL) => ModerationRouteResult;

const routeHandlers: Readonly<Record<string, ModerationRouteHandler>> = {
    '/health': () => ({
        statusCode: 200,
        body: healthPayload,
    }),
    '/metrics': () => ({
        statusCode: 200,
        body: renderPrometheusMetrics(),
        contentType: 'text/plain; version=0.0.4',
    }),
    '/decisions/sample': () => ({
        statusCode: 200,
        body: sampleDecision,
    }),
    '/moderation/queue/enqueue': requestUrl =>
        moderationService.enqueueFromParams(requestUrl.searchParams),
    '/moderation/queue': requestUrl =>
        moderationService.listQueueFromParams(requestUrl.searchParams),
    '/moderation/policy/apply': requestUrl =>
        moderationService.applyPolicyFromParams(requestUrl.searchParams),
    '/moderation/state': requestUrl =>
        moderationService.getStateFromParams(requestUrl.searchParams),
    '/moderation/audit': requestUrl =>
        moderationService.listAuditFromParams(requestUrl.searchParams),
};

const writeJson = (
    response: ServerResponse,
    statusCode: number,
    body: unknown,
): void => {
    response.writeHead(statusCode, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
};

const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost');

    const handler = routeHandlers[requestUrl.pathname];
    if (handler) {
        const result = handler(requestUrl);

        if (result.contentType) {
            response.writeHead(result.statusCode, {
                'content-type': result.contentType,
            });
            response.end(String(result.body));
            return;
        }

        writeJson(response, result.statusCode, result.body);
        return;
    }

    writeJson(response, 404, { error: 'Not Found' });
});

server.listen(config.MODERATION_PORT, '0.0.0.0', () => {
    console.log(
        `[moderation-worker] listening on http://0.0.0.0:${config.MODERATION_PORT} (concurrency=${config.MODERATION_WORKER_CONCURRENCY})`,
    );
});
