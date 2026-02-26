import { describe, expect, it } from 'vitest';
import { CONTRACT_VERSION } from '@mutual-hub/shared';

describe('indexer service shell', () => {
  it('references shared contracts', () => {
    expect(CONTRACT_VERSION).toBe('0.2.0-phase2');
  });
});
