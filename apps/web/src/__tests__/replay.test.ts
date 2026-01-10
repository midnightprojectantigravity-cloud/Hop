import { describe, it, expect } from 'vitest';
import { generateInitialState, gameReducer } from '@hop/engine/logic';
import type { Action } from '@hop/engine/types';

describe('replay round-trip', () => {
  it('replaying recorded actions reaches same final state', () => {
    const seed = 'replay-seed-123';
    // generate initial state
    const s0 = generateInitialState(1, seed, seed);

    // Simulate a short play: move to a neighbor (if any)
    // Find a cell adjacent to player
    const playerPos = s0.player.position;
    // A neighbor in hex grid: try q+1
    const target = { q: playerPos.q + 1, r: playerPos.r, s: playerPos.s - 1 };

    const actions: Action[] = [
      { type: 'MOVE', payload: target },
      { type: 'WAIT' }
    ];

    // Apply actions
    let s = s0;
    for (const a of actions) {
      s = gameReducer(s, a as Action);
    }

    const finalState = s;

    // Now replay: recreate initial state and replay actions
    let r = generateInitialState(1, seed, seed);
    for (const a of actions) {
      r = gameReducer(r, a as Action);
    }

    // Compare core parts of state
    expect(r.player.position).toEqual(finalState.player.position);
    expect(r.player.hp).toEqual(finalState.player.hp);
    expect(r.enemies.length).toEqual(finalState.enemies.length);
  });
});
