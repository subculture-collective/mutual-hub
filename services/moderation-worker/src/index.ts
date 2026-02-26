import { createServer } from 'node:http';
import {
    CONTRACT_VERSION,
    loadModerationWorkerConfig,
    type ModerationDecisionEvent,
    type ServiceHealth,
} from '@mutual-hub/shared';

const config = loadModerationWorkerConfig();

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

const server = createServer((request, response) => {
    if (request.url === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(healthPayload));
        return;
    }

    if (request.url === '/decisions/sample') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify(sampleDecision));
        return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(config.MODERATION_PORT, '0.0.0.0', () => {
    console.log(
        `[moderation-worker] listening on http://0.0.0.0:${config.MODERATION_PORT} (concurrency=${config.MODERATION_WORKER_CONCURRENCY})`,
    );
});
