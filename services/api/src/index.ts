import { createServer, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CONTRACT_VERSION,
    loadApiConfig,
    type ServiceHealth,
} from '@mutual-hub/shared';
import { createFixtureQueryService } from './query-service.js';

const config = loadApiConfig();
const queryService = createFixtureQueryService();

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
