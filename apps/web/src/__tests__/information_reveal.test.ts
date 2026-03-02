import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveUiInformationRevealMode } from '../app/information-reveal';

describe('information reveal mode bridge', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to strict mode when no overrides are provided', () => {
    expect(resolveUiInformationRevealMode({ search: '' })).toBe('strict');
  });

  it('uses env override when provided', () => {
    expect(resolveUiInformationRevealMode({ search: '', envMode: 'force_reveal' })).toBe('force_reveal');
  });

  it('prefers query override over env setting', () => {
    expect(resolveUiInformationRevealMode({ search: '?intel=strict', envMode: 'force_reveal' })).toBe('strict');
  });

  it('supports short force mode query aliases', () => {
    expect(resolveUiInformationRevealMode({ search: '?intel=full' })).toBe('force_reveal');
  });
});
