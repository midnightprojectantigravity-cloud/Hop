import { describe, it, expect } from 'vitest';
import { nextIdFromState } from '@hop/engine';
import type { GameState } from '@hop/engine';

describe('rng id generation from state', () => {
  it('generates deterministic ids and advances rngCounter', () => {
    const baseState: GameState = {
      turnNumber: 1,
      player: { id: 'p', type: 'player', position: { q: 0, r: 0, s: 0 }, hp: 1, maxHp: 1, statusEffects: [], temporaryArmor: 0, activeSkills: [], speed: 100, factionId: 'player' },
      enemies: [],
      gridWidth: 9,
      gridHeight: 11,
      gameStatus: 'playing',
      message: [],
      hasSpear: false,
      hasShield: false,
      stairsPosition: { q: 0, r: 0, s: 0 },
      lavaPositions: [],
      wallPositions: [],
      tiles: new Map(),
      floor: 1,
      upgrades: [],
      rngSeed: 'seed-1',
      rngCounter: 0,
      actionLog: [],
      kills: 0,
      environmentalKills: 0,
      occupancyMask: [],
      commandLog: [],
      undoStack: [],
      visualEvents: [],
      turnsSpent: 0
    } as GameState;

    const { id, nextState } = nextIdFromState(baseState, 6);
    expect(typeof id).toBe('string');
    expect(id.length).toBe(6);
    expect(typeof nextState.rngCounter).toBe('number');
    // Compare as strings to avoid TS optional typing issues in test harness
    expect(String(nextState.rngCounter)).not.toBe(String(baseState.rngCounter));

    // Re-running from same initial state yields same id
    const { id: id2 } = nextIdFromState({ ...baseState, rngCounter: 0 }, 6);
    expect(id2).toBe(id);

    // Different seed yields different id likely
    const altBase = { ...baseState, rngSeed: 'seed-2', rngCounter: 0 } as GameState;
    const { id: id3 } = nextIdFromState(altBase, 6);
    expect(id3).not.toBe(id);
  });
});
