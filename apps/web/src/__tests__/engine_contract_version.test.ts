import { describe, expect, it } from 'vitest';
import { ENGINE_CONTRACT_VERSION } from '@hop/engine';

describe('engine contract version', () => {
  it('is exported and non-empty', () => {
    expect(typeof ENGINE_CONTRACT_VERSION).toBe('string');
    expect(ENGINE_CONTRACT_VERSION.length).toBeGreaterThan(0);
  });
});
