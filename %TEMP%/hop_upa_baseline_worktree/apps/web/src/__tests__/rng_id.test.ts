import { describe, it, expect } from 'vitest';
import { nextIdFromState } from '@hop/engine';
import type { GameState } from '@hop/engine';

describe('rng id generation from state', () => {
  it('generates deterministic ids and advances rngCounter', () => {
    /**
     * Set up the base state. 
     * Note: occupancyMask is defined as bigint[] in the engine to support 
     * large hex grids via chunking.
     */
    const baseState: GameState = {
      turnNumber: 1,
      player: {
        id: 'p',
        type: 'player',
        position: { q: 0, r: 0, s: 0 },
        hp: 1,
        maxHp: 1,
        statusEffects: [],
        temporaryArmor: 0,
        activeSkills: [],
        speed: 100,
        factionId: 'player'
      },
      enemies: [],
      gridWidth: 9,
      gridHeight: 11,
      gameStatus: 'playing',
      message: [],
      hasSpear: false,
      hasShield: false,
      stairsPosition: { q: 0, r: 0, s: 0 },
      tiles: new Map(),
      floor: 1,
      upgrades: [],
      rngSeed: 'seed-1',
      rngCounter: 0,
      actionLog: [],
      kills: 0,
      environmentalKills: 0,

      // FIX: Satisfies Type 'bigint[]' by wrapping in an array literal
      occupancyMask: [0n],

      commandLog: [],
      undoStack: [],
      visualEvents: [],
      turnsSpent: 0
    } as GameState;

    // 1. Check basic generation
    // nextIdFromState consumes 1 entropy point per character
    const { id, nextState } = nextIdFromState(baseState, 6);

    expect(typeof id).toBe('string');
    expect(id.length).toBe(6);

    // 2. Verify state progression (The "Heartbeat" of the RNG)
    // The counter should advance exactly by the length of the ID generated
    expect(nextState.rngCounter).toBe(6);
    expect(nextState.rngCounter).toBeGreaterThan(baseState.rngCounter!);

    // 3. Verify Determinism (Same input seed/counter = Same output id)
    const { id: id2 } = nextIdFromState({ ...baseState, rngCounter: 0 }, 6);
    expect(id2).toBe(id);

    // 4. Verify Sensitivity (Different seed = Different output)
    const altBase = { ...baseState, rngSeed: 'seed-2', rngCounter: 0 } as GameState;
    const { id: id3 } = nextIdFromState(altBase, 6);
    expect(id3).not.toBe(id);
  });
});
