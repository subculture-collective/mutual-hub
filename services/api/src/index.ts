import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    CONTRACT_VERSION,
    loadApiConfig,
    type ServiceHealth,
} from '@patchwork/shared';
import { createAidPostService } from './aid-post-service.js';
import { createFixtureChatService } from './chat-service.js';
import { createPostgresPool } from './db/discovery-events.js';
import {
    createFixtureQueryService,
    createPostgresQueryService,
} from './query-service.js';
import { createFixtureVerificationService } from './verification-service.js';
import { createFixtureSettingsService } from './settings-service.js';
import { createFixtureAuthService } from './auth-service.js';
import { createFixtureVolunteerService } from './volunteer-service.js';
import { createLifecycleService } from './lifecycle-service.js';
import { createAttachmentService } from './aid-post-service.js';
import { createOrgPortalService } from './org-portal-service.js';

const config = loadApiConfig();

const resolveQueryService = async () => {
    if (config.API_DATA_SOURCE !== 'postgres') {
        return createFixtureQueryService();
    }

    return createPostgresQueryService(
        // Config validation guarantees this is set when API_DATA_SOURCE=postgres
        (config.API_DATABASE_URL ?? config.DATABASE_URL)!,
    );
};

const queryService = await resolveQueryService();

const chatService = createFixtureChatService();
const verificationService = createFixtureVerificationService();
const settingsService = createFixtureSettingsService();
const volunteerService = createFixtureVolunteerService();
const lifecycleService = createLifecycleService();
const attachmentService = createAttachmentService();
const authService = createFixtureAuthService();
const orgPortalService = createOrgPortalService();

const databaseUrl = config.API_DATABASE_URL ?? config.DATABASE_URL;
const postgresPool =
    config.API_DATA_SOURCE === 'postgres' && databaseUrl
        ? createPostgresPool(databaseUrl)
        : undefined;

const aidPostService = createAidPostService(queryService, {
    dataSource: config.API_DATA_SOURCE,
    databaseUrl,
    pool: postgresPool,
});

const healthPayload: ServiceHealth = {
    service: 'api',
    status: 'ok',
    contractVersion: CONTRACT_VERSION,
    did: config.ATPROTO_SERVICE_DID,
};

const renderPrometheusMetrics = (): string => {
    const uptimeSeconds = Math.floor(process.uptime());

    return [
        '# HELP patchwork_service_up Service health status (1 = up).',
        '# TYPE patchwork_service_up gauge',
        'patchwork_service_up{project="patchwork",service="api",component="stitch"} 1',
        '# HELP patchwork_process_uptime_seconds Process uptime in seconds.',
        '# TYPE patchwork_process_uptime_seconds counter',
        `patchwork_process_uptime_seconds{project="patchwork",service="api",component="stitch"} ${uptimeSeconds}`,
    ].join('\n');
};

const writeJson = (
    response: ServerResponse,
    statusCode: number,
    body: unknown,
): void => {
    response.writeHead(statusCode, { 'content-type': 'application/json' });
    response.end(JSON.stringify(body));
};

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB

const readJsonBody = (request: IncomingMessage): Promise<unknown> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let totalSize = 0;
        request.on('data', (chunk: Buffer) => {
            totalSize += chunk.length;
            if (totalSize > MAX_BODY_SIZE) {
                request.destroy();
                reject(new Error('Request body too large'));
                return;
            }
            chunks.push(chunk);
        });
        request.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(new Error('Invalid JSON body'));
            }
        });
        request.on('error', reject);
    });
};

interface ApiRouteResult {
    statusCode: number;
    body: unknown;
    contentType?: string;
}

type ApiRouteHandler =
    | ((requestUrl: URL) => ApiRouteResult)
    | ((requestUrl: URL) => Promise<ApiRouteResult>);

const contractRoutes = [
    '/query/map',
    '/query/feed',
    '/query/directory',
    '/aid/post/create',
    '/chat/initiate',
    '/chat/route',
    '/chat/conversations',
    '/chat/safety/evaluate',
    '/chat/safety/block',
    '/chat/safety/mute',
    '/chat/safety/report',
    '/chat/safety/signals/drain',
    '/chat/safety/metrics',
    '/chat/message/send',
    '/chat/message/status',
    '/chat/message/retry',
    '/chat/messages',
    '/chat/route/preference-aware',
    '/volunteer/profile/upsert',
    '/volunteer/profiles',
    '/verification/status',
    '/verification/grant',
    '/verification/revoke',
    '/verification/renew',
    '/verification/appeal',
    '/verification/audit',
    '/account/settings',
    '/account/settings/audit',
    '/account/deactivate',
    '/account/export',
    '/aid/post/transition',
    '/aid/post/lifecycle',
    '/aid/post/assign',
    '/aid/post/accept',
    '/aid/post/decline',
    '/aid/post/handoff',
    '/aid/post/timeout-check',
    '/aid/post/attachments',
    '/aid/post/attachments/add',
    '/auth/session',
    '/auth/refresh',
    '/org/profile',
    '/org/create',
    '/org/member/invite',
    '/org/member/remove',
    '/org/member/role',
    '/org/members',
    '/org/service/upsert',
    '/org/service/status',
    '/org/services',
    '/org/audit',
    '/org/metrics',
    '/health',
    '/metrics',
] as const;

const routeHandlers: Readonly<Record<string, ApiRouteHandler>> = {
    '/health': () => ({
        statusCode: 200,
        body: healthPayload,
    }),
    '/metrics': () => ({
        statusCode: 200,
        body: renderPrometheusMetrics(),
        contentType: 'text/plain; version=0.0.4',
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
    '/chat/message/send': requestUrl =>
        chatService.sendMessageFromParams(requestUrl.searchParams),
    '/chat/message/status': requestUrl =>
        chatService.updateMessageStatusFromParams(requestUrl.searchParams),
    '/chat/message/retry': requestUrl =>
        chatService.retryMessageFromParams(requestUrl.searchParams),
    '/chat/messages': requestUrl =>
        chatService.getConversationHistoryFromParams(requestUrl.searchParams),
    '/chat/safety/signals/drain': () => chatService.drainModerationSignals(),
    '/chat/safety/metrics': () => chatService.safetyMetrics(),
    '/chat/route/preference-aware': requestUrl =>
        volunteerService.routePreferenceAwareFromParams(
            requestUrl.searchParams,
        ),
    '/volunteer/profile/upsert': requestUrl =>
        volunteerService.upsertFromParams(requestUrl.searchParams),
    '/volunteer/profiles': () => volunteerService.listFromParams(),
    '/verification/status': requestUrl =>
        verificationService.getStatus(requestUrl.searchParams),
    '/verification/grant': requestUrl =>
        verificationService.grant(requestUrl.searchParams),
    '/verification/revoke': requestUrl =>
        verificationService.revoke(requestUrl.searchParams),
    '/verification/renew': requestUrl =>
        verificationService.renew(requestUrl.searchParams),
    '/verification/appeal': requestUrl =>
        verificationService.appeal(requestUrl.searchParams),
    '/verification/audit': requestUrl =>
        verificationService.getAuditTrail(requestUrl.searchParams),
    '/account/settings': requestUrl =>
        settingsService.getSettings(requestUrl.searchParams),
    '/aid/post/create': requestUrl =>
        aidPostService.createFromParams(requestUrl.searchParams),
    '/aid/post/transition': requestUrl =>
        lifecycleService.transitionFromParams(requestUrl.searchParams),
    '/aid/post/lifecycle': requestUrl =>
        lifecycleService.queryFromParams(requestUrl.searchParams),
    '/auth/session': requestUrl =>
        authService.validateSessionFromParams(requestUrl.searchParams),
    '/auth/refresh': requestUrl =>
        authService.refreshSessionFromParams(requestUrl.searchParams),
    '/org/profile': requestUrl =>
        orgPortalService.getOrg(requestUrl.searchParams),
    '/org/create': requestUrl =>
        orgPortalService.createOrg(requestUrl.searchParams),
    '/org/member/invite': requestUrl =>
        orgPortalService.inviteMember(requestUrl.searchParams),
    '/org/member/remove': requestUrl =>
        orgPortalService.removeMember(requestUrl.searchParams),
    '/org/member/role': requestUrl =>
        orgPortalService.updateMemberRole(requestUrl.searchParams),
    '/org/members': requestUrl =>
        orgPortalService.listMembers(requestUrl.searchParams),
    '/org/service/upsert': requestUrl =>
        orgPortalService.upsertServiceListing(requestUrl.searchParams),
    '/org/service/status': requestUrl =>
        orgPortalService.updateServiceStatus(requestUrl.searchParams),
    '/org/services': requestUrl =>
        orgPortalService.listServices(requestUrl.searchParams),
    '/org/audit': requestUrl =>
        orgPortalService.getAuditTrail(requestUrl.searchParams),
    '/org/metrics': requestUrl =>
        orgPortalService.getPerformanceMetrics(requestUrl.searchParams),
    '/aid/post/timeout-check': requestUrl => {
        const postUri = requestUrl.searchParams.get('postUri');
        if (!postUri) {
            return {
                statusCode: 400,
                body: { error: { code: 'INVALID_INPUT', message: 'postUri is required.' } },
            };
        }
        return lifecycleService.checkAssignmentTimeout(
            postUri,
            requestUrl.searchParams.get('now') ?? undefined,
        );
    },
    '/aid/post/attachments': requestUrl =>
        attachmentService.getAttachmentsFromParams(requestUrl.searchParams),
};

export const createApiServer = () => {
    return createServer((request, response) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost');

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/auth/session'
        ) {
            void Promise.resolve()
                .then(() =>
                    authService.createSessionFromParams(
                        requestUrl.searchParams,
                    ),
                )
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'DELETE' &&
            requestUrl.pathname === '/auth/session'
        ) {
            const result = authService.deleteSessionFromParams(
                requestUrl.searchParams,
            );
            writeJson(response, result.statusCode, result.body);
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/create'
        ) {
            void readJsonBody(request)
                .then(body => aidPostService.createFromBody(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'PUT' &&
            requestUrl.pathname === '/account/settings'
        ) {
            void readJsonBody(request)
                .then(body => settingsService.updateSettings(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/account/settings/audit'
        ) {
            void readJsonBody(request)
                .then(body => settingsService.getAuditTrail(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/account/deactivate'
        ) {
            void readJsonBody(request)
                .then(body => settingsService.deactivateAccount(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/account/export'
        ) {
            void readJsonBody(request)
                .then(body => settingsService.exportAccountData(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/transition'
        ) {
            void readJsonBody(request)
                .then(body => lifecycleService.transitionFromBody(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/assign'
        ) {
            void readJsonBody(request)
                .then(body => lifecycleService.assignRequest(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/accept'
        ) {
            void readJsonBody(request)
                .then(body => lifecycleService.acceptAssignment(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/decline'
        ) {
            void readJsonBody(request)
                .then(body => lifecycleService.declineAssignment(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/handoff'
        ) {
            void readJsonBody(request)
                .then(body => lifecycleService.completeHandoff(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        if (
            request.method === 'POST' &&
            requestUrl.pathname === '/aid/post/attachments/add'
        ) {
            void readJsonBody(request)
                .then(body => attachmentService.addAttachment(body))
                .then(result => {
                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
            return;
        }

        const handler = routeHandlers[requestUrl.pathname];
        if (handler) {
            void Promise.resolve()
                .then(() => handler(requestUrl))
                .then(result => {
                    if (result.contentType) {
                        response.writeHead(result.statusCode, {
                            'content-type': result.contentType,
                        });
                        response.end(String(result.body));
                        return;
                    }

                    writeJson(response, result.statusCode, result.body);
                })
                .catch(error => {
                    writeJson(response, 500, {
                        error: {
                            code: 'UNHANDLED_ROUTE_ERROR',
                            message:
                                error instanceof Error ?
                                    error.message
                                :   'Unhandled route error.',
                        },
                    });
                });
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
            `[api] listening on http://${config.API_HOST}:${config.API_PORT} (contracts=${CONTRACT_VERSION}, datasource=${config.API_DATA_SOURCE})`,
        );
    });
    return server;
};

const isExecutedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isExecutedDirectly) {
    const server = startApiServer();
    process.on('SIGTERM', () => {
        server.close(() => {
            void postgresPool?.end();
        });
    });
}
