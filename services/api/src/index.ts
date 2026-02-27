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

export const createApiServer = () => {
    return createServer((request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');

        if (requestUrl.pathname === '/health') {
            writeJson(response, 200, healthPayload);
            return;
        }

        if (requestUrl.pathname === '/contracts') {
            writeJson(response, 200, {
                contractVersion: CONTRACT_VERSION,
                routes: [
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
                ],
            });
            return;
        }

        if (requestUrl.pathname === '/query/map') {
            const result = queryService.queryMap(requestUrl.searchParams);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/query/feed') {
            const result = queryService.queryFeed(requestUrl.searchParams);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/query/directory') {
            const result = queryService.queryDirectory(requestUrl.searchParams);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/initiate') {
            const result = chatService.initiateFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/route') {
            const result = chatService.routeScenarioFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/conversations') {
            const result = chatService.listConversationsFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/safety/evaluate') {
            const result = chatService.evaluateSafetyFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/safety/block') {
            const result = chatService.blockFromParams(requestUrl.searchParams);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/safety/mute') {
            const result = chatService.muteFromParams(requestUrl.searchParams);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/safety/report') {
            const result = chatService.reportFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/safety/signals/drain') {
            const result = chatService.drainModerationSignals();
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/safety/metrics') {
            const result = chatService.safetyMetrics();
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/chat/route/preference-aware') {
            const result = volunteerService.routePreferenceAwareFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/volunteer/profile/upsert') {
            const result = volunteerService.upsertFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (requestUrl.pathname === '/volunteer/profiles') {
            const result = volunteerService.listFromParams();
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
