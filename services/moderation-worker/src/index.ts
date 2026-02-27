import { createServer, type ServerResponse } from 'node:http';
import {
    CONTRACT_VERSION,
    loadModerationWorkerConfig,
    type ModerationDecisionEvent,
    type ServiceHealth,
} from '@mutual-hub/shared';
import { createFixtureModerationWorkerService } from './moderation-service.js';

const config = loadModerationWorkerConfig();
const moderationService = createFixtureModerationWorkerService();

const healthPayload: ServiceHealth = {
    service: 'moderation-worker',
    status: 'ok',
    contractVersion: CONTRACT_VERSION,
    did: config.ATPROTO_SERVICE_DID,
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
}

type ModerationRouteHandler = (requestUrl: URL) => ModerationRouteResult;

const routeHandlers: Readonly<Record<string, ModerationRouteHandler>> = {
    '/health': () => ({
        statusCode: 200,
        body: healthPayload,
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
