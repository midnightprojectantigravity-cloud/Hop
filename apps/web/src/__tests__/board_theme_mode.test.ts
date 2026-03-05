import { describe, expect, it } from 'vitest';
import { resolveBoardColorMode } from '../visual/biome-config';

describe('board theme mode resolver', () => {
  it('maps light board themes', () => {
    expect(resolveBoardColorMode('catacombs')).toBe('light');
    expect(resolveBoardColorMode('frozen')).toBe('light');
  });

  it('maps dark board themes', () => {
    expect(resolveBoardColorMode('inferno')).toBe('dark');
    expect(resolveBoardColorMode('throne')).toBe('dark');
    expect(resolveBoardColorMode('void')).toBe('dark');
  });

  it('falls back to dark for unknown themes', () => {
    expect(resolveBoardColorMode('unknown-theme')).toBe('dark');
    expect(resolveBoardColorMode(undefined)).toBe('dark');
  });
});
