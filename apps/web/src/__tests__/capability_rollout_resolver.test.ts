import { describe, expect, it, vi } from 'vitest';
import {
  resolveUiCapabilityRollout,
  setUiCapabilityRollout
} from '../app/capability-rollout';

describe('capability rollout resolver', () => {
  it('defaults both rollout toggles to false', () => {
    expect(resolveUiCapabilityRollout({ search: '' })).toEqual({
      capabilityPassivesEnabled: false,
      movementRuntimeEnabled: false
    });
  });

  it('uses env defaults when query does not provide overrides', () => {
    expect(resolveUiCapabilityRollout({
      search: '',
      envCapabilityPassives: 'enabled',
      envMovementRuntime: '1'
    })).toEqual({
      capabilityPassivesEnabled: true,
      movementRuntimeEnabled: true
    });
  });

  it('prefers query overrides over env defaults', () => {
    expect(resolveUiCapabilityRollout({
      search: '?cap_passives=off&movement_runtime=on',
      envCapabilityPassives: 'true',
      envMovementRuntime: 'false'
    })).toEqual({
      capabilityPassivesEnabled: false,
      movementRuntimeEnabled: true
    });
  });

  it('normalizes toggle aliases', () => {
    expect(resolveUiCapabilityRollout({
      search: '?cap_passives=1&movement_runtime=disabled'
    })).toEqual({
      capabilityPassivesEnabled: true,
      movementRuntimeEnabled: false
    });
  });

  it('no-ops safely when window is unavailable', () => {
    setUiCapabilityRollout({ capabilityPassivesEnabled: true });
    setUiCapabilityRollout({ movementRuntimeEnabled: true });
    expect(true).toBe(true);
  });

  it('updates rollout query params when window is available', () => {
    const replaceState = vi.fn();
    const mockWindow = {
      location: { href: 'https://example.test/hub?intel=strict' },
      history: { replaceState }
    } as unknown as Window & typeof globalThis;
    const originalWindow = (globalThis as any).window;
    (globalThis as any).window = mockWindow;
    try {
      setUiCapabilityRollout({
        capabilityPassivesEnabled: true,
        movementRuntimeEnabled: false
      });
      expect(replaceState).toHaveBeenCalledTimes(1);
      const nextUrl = String(replaceState.mock.calls[0]?.[2] || '');
      expect(nextUrl).toContain('cap_passives=on');
      expect(nextUrl).toContain('movement_runtime=off');
      expect(nextUrl).toContain('intel=strict');
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as any).window;
      } else {
        (globalThis as any).window = originalWindow;
      }
    }
  });
});
