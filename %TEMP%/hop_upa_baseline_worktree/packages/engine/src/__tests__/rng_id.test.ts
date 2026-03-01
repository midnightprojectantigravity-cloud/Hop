import { describe, it, expect } from 'vitest';
import type { GameState } from '../types';
import { nextIdFromState, stableIdFromSeed } from '../systems/rng';

describe('deterministic id helpers', () => {
    it('stableIdFromSeed is deterministic and salt-sensitive', () => {
        const seed = 'seed-1';
        const a = stableIdFromSeed(seed, 42, 8, 'cmd');
        const b = stableIdFromSeed(seed, 42, 8, 'cmd');
        const c = stableIdFromSeed(seed, 43, 8, 'cmd');
        const d = stableIdFromSeed(seed, 42, 8, 'delta');

        expect(a).toBe(b);
        expect(a).not.toBe(c);
        expect(a).not.toBe(d);
        expect(a.length).toBe(8);
    });

    it('nextIdFromState advances rngCounter deterministically', () => {
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
            occupancyMask: [0n],
            commandLog: [],
            undoStack: [],
            visualEvents: [],
            turnsSpent: 0
        } as GameState;

        const { id, nextState } = nextIdFromState(baseState, 6);
        const { id: id2 } = nextIdFromState({ ...baseState, rngCounter: 0 }, 6);

        expect(id).toBe(id2);
        expect(nextState.rngCounter).toBe(6);
    });
});
