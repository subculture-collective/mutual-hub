import { createServer, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CONTRACT_VERSION,
    loadApiConfig,
    type ServiceHealth,
} from '@mutual-hub/shared';
import { createFixtureChatService } from './chat-service.js';
import { createFixtureQueryService } from './query-service.js';
import { createFixtureVolunteerService } from './volunteer-service.js';

const config = loadApiConfig();
const queryService = createFixtureQueryService();
const chatService = createFixtureChatService();
const volunteerService = createFixtureVolunteerService();

const healthPayload: ServiceHealth = {
    service: 'api',
    status: 'ok',
    contractVersion: CONTRACT_VERSION,
    did: config.ATPROTO_SERVICE_DID,
};

const writeJson = (
    response: ServerResponse,
    statusCode: number,
    body: unknown,
): void => {
    response.writeHead(statusCode, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
};

interface ApiRouteResult {
    statusCode: number;
    body: unknown;
}

type ApiRouteHandler = (requestUrl: URL) => ApiRouteResult;

const contractRoutes = [
    '/query/map',
    '/query/feed',
    '/query/directory',
    '/chat/initiate',
    '/chat/route',
    '/chat/conversations',
    '/chat/safety/evaluate',
    '/chat/safety/block',
    '/chat/safety/mute',
    '/chat/safety/report',
    '/chat/safety/signals/drain',
    '/chat/safety/metrics',
    '/chat/route/preference-aware',
    '/volunteer/profile/upsert',
    '/volunteer/profiles',
    '/health',
] as const;

const routeHandlers: Readonly<Record<string, ApiRouteHandler>> = {
    '/health': () => ({
        statusCode: 200,
        body: healthPayload,
    }),
    '/contracts': () => ({
        statusCode: 200,
        body: {
            contractVersion: CONTRACT_VERSION,
            routes: contractRoutes,
        },
    }),
    '/query/map': requestUrl => queryService.queryMap(requestUrl.searchParams),
    '/query/feed': requestUrl =>
        queryService.queryFeed(requestUrl.searchParams),
    '/query/directory': requestUrl =>
        queryService.queryDirectory(requestUrl.searchParams),
    '/chat/initiate': requestUrl =>
        chatService.initiateFromParams(requestUrl.searchParams),
    '/chat/route': requestUrl =>
        chatService.routeScenarioFromParams(requestUrl.searchParams),
    '/chat/conversations': requestUrl =>
        chatService.listConversationsFromParams(requestUrl.searchParams),
    '/chat/safety/evaluate': requestUrl =>
        chatService.evaluateSafetyFromParams(requestUrl.searchParams),
    '/chat/safety/block': requestUrl =>
        chatService.blockFromParams(requestUrl.searchParams),
    '/chat/safety/mute': requestUrl =>
        chatService.muteFromParams(requestUrl.searchParams),
    '/chat/safety/report': requestUrl =>
        chatService.reportFromParams(requestUrl.searchParams),
    '/chat/safety/signals/drain': () => chatService.drainModerationSignals(),
    '/chat/safety/metrics': () => chatService.safetyMetrics(),
    '/chat/route/preference-aware': requestUrl =>
        volunteerService.routePreferenceAwareFromParams(requestUrl.searchParams),
    '/volunteer/profile/upsert': requestUrl =>
        volunteerService.upsertFromParams(requestUrl.searchParams),
    '/volunteer/profiles': () => volunteerService.listFromParams(),
};

export const createApiServer = () => {
    return createServer((request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');

        const handler = routeHandlers[requestUrl.pathname];
        if (handler) {
            const result = handler(requestUrl);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        writeJson(response, 404, {
            error: {
                code: 'UNSUPPORTED_ROUTE',
                message: `Route not found: ${requestUrl.pathname}`,
            },
        });
    });
};

export const startApiServer = () => {
    const server = createApiServer();
    server.listen(config.API_PORT, config.API_HOST, () => {
        console.log(
            `[api] listening on http://${config.API_HOST}:${config.API_PORT} (contracts=${CONTRACT_VERSION})`,
        );
    });
    return server;
};

const isExecutedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isExecutedDirectly) {
    startApiServer();
}
