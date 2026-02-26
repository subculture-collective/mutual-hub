import { describe, expect, it } from 'vitest';
import { loadApiConfig } from './config.js';

describe('config schema', () => {
    it('fails fast with a clear message for invalid DID', () => {
        const previous = process.env.ATPROTO_SERVICE_DID;
        process.env.ATPROTO_SERVICE_DID = 'not-a-did';

        expect(() => loadApiConfig()).toThrowError(/ATPROTO_SERVICE_DID/);

        process.env.ATPROTO_SERVICE_DID = previous;
    });
});
