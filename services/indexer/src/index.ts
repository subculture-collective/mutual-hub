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

export const createIndexerServer = () => {
    return createServer((request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');

        if (requestUrl.pathname === '/health') {
            writeJson(response, 200, healthPayload);
            return;
        }

        if (requestUrl.pathname === '/ingestion/metrics') {
            writeJson(response, 200, {
                metrics: pipeline.getMetrics(),
                checkpointSeq: pipeline.getCheckpointSeq(),
            });
            return;
        }

        if (requestUrl.pathname === '/ingestion/logs') {
            writeJson(response, 200, {
                logs: pipeline.getLogs(),
            });
            return;
        }

        if (requestUrl.pathname === '/indexes/stats') {
            writeJson(response, 200, {
                stats: pipeline.getStats(),
            });
            return;
        }

        if (requestUrl.pathname === '/events/sample') {
            writeJson(response, 200, {
                sampleFeed: pipeline.queryFeed({
                    latitude: 40.7128,
                    longitude: -74.006,
                    radiusKm: 25,
                    page: 1,
                    pageSize: 1,
                    nowIso: '2026-02-26T13:00:00.000Z',
                }),
            });
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
