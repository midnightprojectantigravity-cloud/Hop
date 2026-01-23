import { describe, it, expect } from 'vitest';
import { processKineticPulse, type KineticPulseRequest } from '../systems/kinetic-kernel';
import { GameState, Point } from '../types';

// Mock GameState helper
function createMockState(overrides: Partial<GameState> = {}): GameState {
    const defaultState: GameState = {
        gridWidth: 10,
        gridHeight: 10,
        wallPositions: [],
        lavaPositions: [],
        player: { id: 'player', type: 'player', position: { q: 0, r: 0, s: 0 }, hp: 10, maxHp: 10, speed: 1, factionId: 'player', statusEffects: [], temporaryArmor: 0, activeSkills: [] },
        enemies: [],
        turnNumber: 0,
        gameStatus: 'playing',
        message: [],
        hasSpear: false,
        stairsPosition: { q: 9, r: 9, s: -18 },
        occupancyMask: [],
        hasShield: false,
        floor: 1,
        upgrades: [],
        commandLog: [],
        undoStack: [],
        kills: 0,
        environmentalKills: 0,
        visualEvents: [],
        turnsSpent: 0
    };
    return { ...defaultState, ...overrides };
}

describe('Kinetic Pulse V2 (Dumb Iterator)', () => {

    it('Mass Matters: 1 unit moves 4 tiles with 4 momentum', () => {
        const state = createMockState({
            enemies: [{ id: 'target', type: 'enemy', position: { q: 2, r: 5, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] } as any]
        });

        const request: KineticPulseRequest = {
            origin: { q: 2, r: 5, s: -7 },
            direction: { q: 1, r: -1, s: 0 }, // Move NE
            momentum: 4
        };

        const effects = processKineticPulse(state, request);

        // Should have 4 displacement effects for 'target'
        const displacements = effects.filter(e => e.type === 'Displacement' && (e as any).target === 'target');
        expect(displacements.length).toBe(4);
    });

    it('Mass Matters: Cluster of 4 moves 1 tile with 4 momentum', () => {
        const state = createMockState({
            enemies: [
                { id: 'E1', type: 'enemy', position: { q: 2, r: 5, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] },
                { id: 'E2', type: 'enemy', position: { q: 3, r: 4, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] },
                { id: 'E3', type: 'enemy', position: { q: 4, r: 3, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] },
                { id: 'E4', type: 'enemy', position: { q: 5, r: 2, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] }
            ] as any[]
        });

        const request: KineticPulseRequest = {
            origin: { q: 2, r: 5, s: -7 },
            direction: { q: 1, r: -1, s: 0 }, // NE
            momentum: 4
        };

        const effects = processKineticPulse(state, request);

        // Chain length = 4. Cost = 4. Momentum = 4.
        const e1Move = effects.filter(e => (e as any).target === 'E1' && e.type === 'Displacement');
        expect(e1Move.length).toBe(1);
        expect((e1Move[0] as any).destination).toEqual({ q: 3, r: 4, s: -7 });
    });

    it('Lava Sinks: Unit cannot skip over lava', () => {
        const state = createMockState({
            enemies: [{ id: 'victim', type: 'enemy', position: { q: 2, r: 5, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] } as any],
            lavaPositions: [{ q: 4, r: 3, s: -7 }]
        });

        const request: KineticPulseRequest = {
            origin: { q: 2, r: 5, s: -7 },
            direction: { q: 1, r: -1, s: 0 },
            momentum: 10
        };

        const effects = processKineticPulse(state, request);

        const victimMoves = effects.filter(e => (e as any).target === 'victim' && e.type === 'Displacement');
        expect(victimMoves.length).toBe(2);

        const sinkEffect = effects.find(e => e.type === 'LavaSink' && (e as any).target === 'victim');
        expect(sinkEffect).toBeDefined();
    });

    it('Impact: Hits wall and deals damage equal to remaining momentum', () => {
        const state = createMockState({
            enemies: [{ id: 'target', type: 'enemy', position: { q: 2, r: 5, s: -7 }, hp: 10, maxHp: 10, speed: 1, factionId: 'enemy', statusEffects: [], temporaryArmor: 0, activeSkills: [] } as any],
            wallPositions: [{ q: 4, r: 3, s: -7 }]
        });

        const request: KineticPulseRequest = {
            origin: { q: 2, r: 5, s: -7 },
            direction: { q: 1, r: -1, s: 0 },
            momentum: 10
        };

        const effects = processKineticPulse(state, request);

        const impactEffect = effects.find(e => e.type === 'Impact' && (e as any).target === 'target') as any;
        expect(impactEffect).toBeDefined();
        expect(impactEffect.damage).toBe(9);
    });
});
