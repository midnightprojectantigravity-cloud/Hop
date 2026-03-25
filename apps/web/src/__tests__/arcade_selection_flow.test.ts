import { describe, expect, it } from 'vitest';
import { resolveArcadeSplashStartRunRequest } from '../app/use-worldgen-session';

describe('arcade splash start contract', () => {
  it('launches the fixed Vanguard daily run immediately from the splash', () => {
    const result = resolveArcadeSplashStartRunRequest();

    expect(result.loadoutId).toBe('VANGUARD');
    expect(result.mode).toBe('daily');
    expect(result.source).toBe('arcade_start_run');
  });
});
