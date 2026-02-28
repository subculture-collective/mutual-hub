import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscoveryIndexStore } from '@patchwork/shared';

vi.mock('./db/discovery-events.js', () => ({
    createPostgresPool: vi.fn(),
    appendDiscoveryEvents: vi.fn(),
}));

import { ApiDiscoveryQueryService } from './query-service.js';
import { createAidPostService } from './aid-post-service.js';
import {
    appendDiscoveryEvents,
    createPostgresPool,
} from './db/discovery-events.js';

const buildCreateParams = () => {
    return new URLSearchParams({
        authorDid: 'did:example:resident-1',
        title: 'Need groceries for tonight',
        description: 'Requesting pantry support for two households.',
        category: 'food',
        urgency: 'high',
        latitude: '40.7128',
        longitude: '-74.0060',
        precisionKm: '0.5',
        now: '2026-02-28T12:00:00.000Z',
        rkey: 'post-test-001',
    });
};

describe('ApiAidPostService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('creates an aid post and makes it discoverable in feed queries', async () => {
        const queryService = new ApiDiscoveryQueryService(
            new DiscoveryIndexStore(),
        );
        const service = createAidPostService(queryService, {
            dataSource: 'fixture',
        });

        const createResult =
            await service.createFromParams(buildCreateParams());
        expect(createResult.statusCode).toBe(201);

        const feedResult = queryService.queryFeed(
            new URLSearchParams({
                latitude: '40.7128',
                longitude: '-74.0060',
                radiusKm: '20',
                status: 'open',
                page: '1',
                pageSize: '10',
            }),
        );

        expect(feedResult.statusCode).toBe(200);
        const body = feedResult.body as {
            results: Array<{ uri: string; title: string }>;
        };

        expect(
            body.results.some(item => item.uri.includes('/post-test-001')),
        ).toBe(true);
        expect(
            body.results.some(item => item.title.includes('groceries')),
        ).toBe(true);
    });

    it('returns 400 when required fields are missing', async () => {
        const queryService = new ApiDiscoveryQueryService(
            new DiscoveryIndexStore(),
        );
        const service = createAidPostService(queryService, {
            dataSource: 'fixture',
        });

        const createResult = await service.createFromParams(
            new URLSearchParams({
                title: 'Missing author and coordinates',
            }),
        );

        expect(createResult.statusCode).toBe(400);
        expect(
            (createResult.body as { error: { code: string } }).error.code,
        ).toBe('INVALID_QUERY');
    });

    it('persists normalized events to postgres in postgres mode', async () => {
        const queryService = new ApiDiscoveryQueryService(
            new DiscoveryIndexStore(),
        );
        const pool = { end: vi.fn() } as never;
        vi.mocked(appendDiscoveryEvents).mockResolvedValue(undefined);

        const service = createAidPostService(queryService, {
            dataSource: 'postgres',
            databaseUrl:
                'postgresql://patchwork:patchwork@localhost:5432/patchwork',
            pool,
        });

        const createResult =
            await service.createFromParams(buildCreateParams());

        expect(createResult.statusCode).toBe(201);
        expect(createPostgresPool).not.toHaveBeenCalled();
        expect(appendDiscoveryEvents).toHaveBeenCalledWith(
            pool,
            expect.anything(),
        );
        expect(appendDiscoveryEvents).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when postgres persistence fails and does not index record', async () => {
        const queryService = new ApiDiscoveryQueryService(
            new DiscoveryIndexStore(),
        );
        const pool = { end: vi.fn() } as never;
        vi.mocked(appendDiscoveryEvents).mockRejectedValue(
            new Error('insert failed'),
        );

        const service = createAidPostService(queryService, {
            dataSource: 'postgres',
            databaseUrl:
                'postgresql://patchwork:patchwork@localhost:5432/patchwork',
            pool,
        });

        const createResult =
            await service.createFromParams(buildCreateParams());

        expect(createResult.statusCode).toBe(500);

        const feedResult = queryService.queryFeed(
            new URLSearchParams({
                latitude: '40.7128',
                longitude: '-74.0060',
                radiusKm: '20',
                page: '1',
                pageSize: '10',
            }),
        );

        const body = feedResult.body as {
            results: Array<{ uri: string }>;
        };
        expect(
            body.results.some(item => item.uri.includes('/post-test-001')),
        ).toBe(false);
    });
});
