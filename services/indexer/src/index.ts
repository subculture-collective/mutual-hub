import { createServer, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CONTRACT_VERSION,
    loadIndexerConfig,
    type ServiceHealth,
} from '@mutual-hub/shared';
import { createFixtureIndexerPipeline } from './pipeline.js';

const config = loadIndexerConfig();
const pipeline = createFixtureIndexerPipeline();

const healthPayload: ServiceHealth = {
    service: 'indexer',
    status: 'ok',
    contractVersion: CONTRACT_VERSION,
    did: config.ATPROTO_SERVICE_DID,
};

const writeJson = (
    response: ServerResponse,
    statusCode: number,
    body: unknown,
) => {
    response.writeHead(statusCode, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
};

interface IndexerRouteResult {
    statusCode: number;
    body: unknown;
}

type IndexerRouteHandler = (requestUrl: URL) => IndexerRouteResult;

const routeHandlers: Readonly<Record<string, IndexerRouteHandler>> = {
    '/health': () => ({
        statusCode: 200,
        body: healthPayload,
    }),
    '/ingestion/metrics': () => ({
        statusCode: 200,
        body: {
            metrics: pipeline.getMetrics(),
            checkpointSeq: pipeline.getCheckpointSeq(),
        },
    }),
    '/ingestion/logs': () => ({
        statusCode: 200,
        body: {
            logs: pipeline.getLogs(),
        },
    }),
    '/indexes/stats': () => ({
        statusCode: 200,
        body: {
            stats: pipeline.getStats(),
        },
    }),
    '/events/sample': () => ({
        statusCode: 200,
        body: {
            sampleFeed: pipeline.queryFeed({
                latitude: 40.7128,
                longitude: -74.006,
                radiusKm: 25,
                page: 1,
                pageSize: 1,
                nowIso: '2026-02-26T13:00:00.000Z',
            }),
        },
    }),
};

export const createIndexerServer = () => {
    return createServer((request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');

        const handler = routeHandlers[requestUrl.pathname];
        if (handler) {
            const result = handler(requestUrl);
            writeJson(response, result.statusCode, result.body);
            return;
        }

        writeJson(response, 404, { error: 'Not Found' });
    });
};

export const startIndexerServer = () => {
    const server = createIndexerServer();
    server.listen(config.INDEXER_PORT, '0.0.0.0', () => {
        console.log(
            `[indexer] listening on http://0.0.0.0:${config.INDEXER_PORT} (firehose=${config.INDEXER_FIREHOSE_URL}, contracts=${CONTRACT_VERSION})`,
        );
    });
    return server;
};

const isExecutedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isExecutedDirectly) {
    startIndexerServer();
}
