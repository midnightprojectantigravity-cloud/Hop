import { describe, expect, it } from 'vitest';
import { generateInitialState } from '@hop/engine';
import { reviveFloor10ButcherState } from '../app/dev-floor10-butcher-rescue';

describe('dev floor 10 butcher rescue', () => {
  it('restores a butcher to an in-progress floor 10 state', () => {
    const floor10 = generateInitialState(10, 'dev-floor10-butcher-rescue');
    const rescued = reviveFloor10ButcherState({
      ...floor10,
      enemies: [],
      dyingEntities: []
    });

    expect(rescued).not.toBeNull();
    expect(rescued?.enemies).toHaveLength(1);
    expect(rescued?.enemies[0]?.subtype).toBe('butcher');
    expect(rescued?.enemies[0]?.enemyType).toBe('boss');
    expect(rescued?.enemies[0]?.hp).toBeGreaterThan(0);
    expect(rescued?.message.at(-1)).toContain('The Butcher rises again');
  });

  it('does nothing when the butcher is already alive', () => {
    const floor10 = generateInitialState(10, 'dev-floor10-butcher-alive');
    expect(reviveFloor10ButcherState(floor10)).toBeNull();
  });
});
