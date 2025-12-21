import { describe, it, expect } from 'vitest';
import { generateInitialState, gameReducer } from '../game/logic';
import type { Action, Point } from '../game/types';

/**
 * Stronger replay round-trip: run several 'WAIT' turns (which exercise enemy AI and RNG),
 * then replay the same actions from the same seed and assert final states match.
 */

describe('replay round-trip (stress)', () => {
  it('replaying repeated waits yields identical final state', () => {
    const seed = 'stress-replay-seed-42';
    const s0 = generateInitialState(1, seed, seed);

    const actions: Action[] = [];
    const turns = 6;
    for (let i = 0; i < turns; i++) actions.push({ type: 'WAIT' });

    let s = s0;
    for (const a of actions) {
      s = gameReducer(s, a);
    }

    const finalState = s;

    // Now replay
    let r = generateInitialState(1, seed, seed);
    for (const a of actions) {
      r = gameReducer(r, a);
    }

    // Compare basic invariants
    expect(r.player.position).toEqual(finalState.player.position);
    expect(r.player.hp).toEqual(finalState.player.hp);
    expect(r.enemies.length).toEqual(finalState.enemies.length);

    // Compare enemy positions and hp
  const mapById = (arr: Array<{ id: string; hp: number; position: Point }>) => Object.fromEntries(arr.map(e => [e.id, { hp: e.hp, pos: e.position }]));
    expect(mapById(r.enemies)).toEqual(mapById(finalState.enemies));
  });
});
