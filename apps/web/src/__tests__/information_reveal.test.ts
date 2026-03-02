import { describe, expect, it, vi } from 'vitest';
import { resolveUiInformationRevealMode, setUiInformationRevealMode } from '../app/information-reveal';

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

  it('no-ops safely when window is unavailable', () => {
    // Node-mode tests do not provide a window object.
    setUiInformationRevealMode('strict');
    setUiInformationRevealMode('force_reveal');
    expect(true).toBe(true);
  });

  it('updates intel query param when window is available', () => {
    const replaceState = vi.fn();
    const mockWindow = {
      location: { href: 'https://example.test/play?foo=1' },
      history: { replaceState }
    } as unknown as Window & typeof globalThis;
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = mockWindow;
    try {
      setUiInformationRevealMode('strict');
      expect(replaceState).toHaveBeenCalledTimes(1);
      expect(String(replaceState.mock.calls[0]?.[2] || '')).toContain('intel=strict');
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });
});
