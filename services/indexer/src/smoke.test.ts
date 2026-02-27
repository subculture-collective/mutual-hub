import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '@mutual-hub/shared';

describe('indexer service shell', () => {
    it('references shared contracts', () => {
        expect(CONTRACT_VERSION).toBe('0.8.0-phase8');
    });
});
