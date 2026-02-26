import type { ActorIdentity, AtHandle, Did } from '@mutual-hub/shared';

const didPattern = /^did:[a-z0-9:._%-]+$/i;
const atHandlePattern = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

export interface AtSession {
    did: Did;
    handle: AtHandle;
    accessJwt: string;
    refreshJwt: string;
    issuedAt: string;
    accessExpiresAt: string;
    refreshExpiresAt?: string;
}

export interface AtSessionCreateRequest {
    identifier: AtHandle | Did;
    password: string;
}

export interface AtHandleResolution {
    did: Did;
    handle: AtHandle;
    displayName?: string;
    avatarUrl?: string;
    trustScore?: number;
}

export interface AtAuthClient {
    createSession(request: AtSessionCreateRequest): Promise<AtSession>;
    refreshSession(refreshJwt: string): Promise<AtSession>;
    resolveHandle(handle: AtHandle): Promise<AtHandleResolution>;
}

export function assertDid(value: string): asserts value is Did {
    if (!didPattern.test(value)) {
        throw new Error(`Expected DID format, got: ${value}`);
    }
}

export function assertAtHandle(value: string): asserts value is AtHandle {
    if (!atHandlePattern.test(value)) {
        throw new Error(`Expected AT handle format, got: ${value}`);
    }
}

export function isSessionExpiringSoon(
    session: AtSession,
    now = Date.now(),
    skewSeconds = 120,
): boolean {
    const expiry = Date.parse(session.accessExpiresAt);
    if (Number.isNaN(expiry)) {
        return true;
    }

    return expiry - now <= skewSeconds * 1000;
}

function normalizeSession(session: AtSession): AtSession {
    assertDid(session.did);
    assertAtHandle(session.handle);

    if (!session.accessJwt || !session.refreshJwt) {
        throw new Error('AT session tokens cannot be empty');
    }

    if (
        Number.isNaN(Date.parse(session.issuedAt)) ||
        Number.isNaN(Date.parse(session.accessExpiresAt))
    ) {
        throw new Error(
            'AT session timestamps must be valid ISO datetime strings',
        );
    }

    return session;
}

export class AtAuthService {
    constructor(
        private readonly client: AtAuthClient,
        private readonly refreshSkewSeconds = 120,
    ) {}

    async signIn(request: AtSessionCreateRequest): Promise<AtSession> {
        if (request.identifier.startsWith('did:')) {
            assertDid(request.identifier);
        } else {
            assertAtHandle(request.identifier);
        }

        if (!request.password) {
            throw new Error('Password must be provided for session creation');
        }

        const session = await this.client.createSession(request);
        return normalizeSession(session);
    }

    async refreshSession(currentSession: AtSession): Promise<AtSession> {
        const refreshed = await this.client.refreshSession(
            currentSession.refreshJwt,
        );
        return normalizeSession(refreshed);
    }

    async ensureFreshSession(
        currentSession: AtSession,
        now = Date.now(),
    ): Promise<AtSession> {
        if (
            !isSessionExpiringSoon(currentSession, now, this.refreshSkewSeconds)
        ) {
            return currentSession;
        }

        return this.refreshSession(currentSession);
    }

    async resolveHandle(handle: AtHandle): Promise<ActorIdentity> {
        assertAtHandle(handle);
        const resolved = await this.client.resolveHandle(handle);

        assertDid(resolved.did);
        assertAtHandle(resolved.handle);

        return {
            did: resolved.did,
            handle: resolved.handle,
            displayName: resolved.displayName,
            avatarUrl: resolved.avatarUrl,
            trustScore: resolved.trustScore ?? 0.5,
        };
    }
}
