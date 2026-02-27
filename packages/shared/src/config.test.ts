import { describe, expect, it } from 'vitest';
import { loadApiConfig } from './config.js';

describe('config schema', () => {
    it('fails fast with a clear message for invalid DID', () => {
        const previous = process.env.ATPROTO_SERVICE_DID;
        process.env.ATPROTO_SERVICE_DID = 'not-a-did';

        expect(() => loadApiConfig()).toThrowError(/ATPROTO_SERVICE_DID/);

        if (previous === undefined) {
            delete process.env.ATPROTO_SERVICE_DID;
        } else {
            process.env.ATPROTO_SERVICE_DID = previous;
        }
    });

    it('requires API_DATABASE_URL (or DATABASE_URL) when API_DATA_SOURCE is postgres', () => {
        const previousSource = process.env.API_DATA_SOURCE;
        const previousApiDatabaseUrl = process.env.API_DATABASE_URL;
        const previousDatabaseUrl = process.env.DATABASE_URL;
        const previousDid = process.env.ATPROTO_SERVICE_DID;

        process.env.API_DATA_SOURCE = 'postgres';
        process.env.API_DATABASE_URL = '';
        process.env.DATABASE_URL = '';
        process.env.ATPROTO_SERVICE_DID = 'did:example:test-service';

        expect(() => loadApiConfig()).toThrowError(
            /API_DATABASE_URL \(or DATABASE_URL\) is required/,
        );

        process.env.API_DATA_SOURCE = previousSource;

        if (previousApiDatabaseUrl === undefined) {
            delete process.env.API_DATABASE_URL;
        } else {
            process.env.API_DATABASE_URL = previousApiDatabaseUrl;
        }

        if (previousDatabaseUrl === undefined) {
            delete process.env.DATABASE_URL;
        } else {
            process.env.DATABASE_URL = previousDatabaseUrl;
        }

        if (previousDid === undefined) {
            delete process.env.ATPROTO_SERVICE_DID;
        } else {
            process.env.ATPROTO_SERVICE_DID = previousDid;
        }
    });
});
