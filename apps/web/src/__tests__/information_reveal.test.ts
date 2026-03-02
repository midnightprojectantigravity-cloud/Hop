import { describe, expect, it } from 'vitest';
import { resolveUiInformationRevealMode } from '../app/information-reveal';

describe('information reveal mode resolution', () => {
  it('defaults to force_reveal mode when no overrides are provided', () => {
    expect(resolveUiInformationRevealMode({ search: '' })).toBe('force_reveal');
  });

  it('uses env mode when query does not specify intel mode', () => {
    expect(resolveUiInformationRevealMode({ search: '', envMode: 'strict' })).toBe('strict');
  });

  it('prefers query over env when both are provided', () => {
    expect(resolveUiInformationRevealMode({ search: '?intel=strict', envMode: 'force_reveal' })).toBe('strict');
  });

  it('normalizes force reveal aliases', () => {
    expect(resolveUiInformationRevealMode({ search: '?intel=full' })).toBe('force_reveal');
    expect(resolveUiInformationRevealMode({ search: '?intel=force' })).toBe('force_reveal');
  });
});
