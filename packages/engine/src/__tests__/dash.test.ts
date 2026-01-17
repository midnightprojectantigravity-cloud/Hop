/**
 * TDD: KINETIC DASH SKILL TESTS
 * Focus: Integration of DASH skill with Kinetic Pulse physics
 *
 * Run independently: npx vitest run src/__tests__/dash.test.ts
 */

import { describe, it, expect } from 'vitest';
import { DASH } from '../skills/dash';
import type { GameState, Actor, Point } from '../types';
import { createHex } from '../hex';

// Helper to create a minimal actor for testing
function createTestActor(overrides: Partial<Actor> = {}): Actor {
    return {
        id: 'player',
        type: 'player' as const,
        position: createHex(4, 5),
        hp: 3,
        maxHp: 3,
        speed: 1,
        factionId: 'player',
        statusEffects: [],
        temporaryArmor: 0,
        activeSkills: [],
        ...overrides
    } as Actor;
}

// Helper to create a minimal game state for testing
function createTestState(overrides: Partial<GameState> = {}): GameState {
    return {
        turnNumber: 1,
        player: createTestActor(),
        enemies: [],
        wallPositions: [],
        lavaPositions: [],
        gridWidth: 9,
        gridHeight: 11,
        stairsPosition: createHex(4, 10),
        gameStatus: 'playing',
        message: [],
        hasSpear: false,
        hasShield: false,
        floor: 1,
        upgrades: [],
        commandLog: [],
        undoStack: [],
        occupancyMask: [],
        kills: 0,
        environmentalKills: 0,
        visualEvents: [],
        turnsSpent: 0,
        ...overrides
    } as GameState;
}

describe('DASH Skill', () => {
    describe('Simple Dash (No Collision)', () => {
        it('Dashes to empty tile', () => {
            const state = createTestState();
            const player = state.player;
            const target = createHex(6, 5); // 2 tiles East

            const result = DASH.execute(state, player, target);

            expect(result.effects).toHaveLength(2); // Displacement + Juice
            expect(result.effects[0]).toMatchObject({
                type: 'Displacement',
                target: 'self',
                destination: target
            });
            expect(result.messages).toContain('Dashed!');
        });

        it('Rejects non-axial targets', () => {
            const state = createTestState();
            const player = state.player;
            const target = createHex(5, 6); // Diagonal, not axial

            const result = DASH.execute(state, player, target);

            expect(result.effects).toHaveLength(0);
            expect(result.messages).toContain('Axial only! Dash must be in a straight line.');
        });

        it('Rejects out of range targets', () => {
            const state = createTestState();
            const player = state.player;
            const target = createHex(9, 5); // 5 tiles East, out of range

            const result = DASH.execute(state, player, target);

            expect(result.effects).toHaveLength(0);
            expect(result.messages).toContain('Out of range!');
        });

        it('Rejects path blocked by wall', () => {
            const state = createTestState({
                wallPositions: [createHex(5, 5)] // Wall between player and target
            });
            const player = state.player;
            const target = createHex(6, 5);

            const result = DASH.execute(state, player, target);

            expect(result.effects).toHaveLength(0);
            expect(result.messages).toContain('Path blocked by wall!');
        });
    });

    describe('Shield Shunt (Kinetic Collision)', () => {
        it('Requires shield to shunt enemies', () => {
            const enemy = createTestActor({
                id: 'enemy1',
                type: 'enemy',
                position: createHex(5, 5),
                factionId: 'enemy'
            });
            const state = createTestState({
                hasShield: false,
                enemies: [enemy]
            });
            const player = state.player;

            const result = DASH.execute(state, player, createHex(5, 5));

            expect(result.effects).toHaveLength(0);
            expect(result.messages).toContain('Target occupied! Need shield to shunt enemies.');
        });

        it('Shunts enemy with shield equipped', () => {
            const enemy = createTestActor({
                id: 'enemy1',
                type: 'enemy',
                position: createHex(5, 5), // 1 tile East of player at (4,5)
                factionId: 'enemy'
            });
            const state = createTestState({
                hasShield: true,
                enemies: [enemy]
            });
            const player = state.player;

            const result = DASH.execute(state, player, createHex(5, 5));

            // Should have displacement effects
            expect(result.effects.length).toBeGreaterThan(0);
            expect(result.messages.some(m => m.includes('Shield Shunt'))).toBe(true);
        });

        it('Pushes enemy into lava for instant kill', () => {
            const enemy = createTestActor({
                id: 'enemy1',
                type: 'enemy',
                position: createHex(5, 5),
                factionId: 'enemy'
            });
            const state = createTestState({
                hasShield: true,
                enemies: [enemy],
                lavaPositions: [createHex(6, 5), createHex(7, 5)] // Lava ahead
            });
            const player = state.player;

            const result = DASH.execute(state, player, createHex(5, 5));

            // Should have damage effect for lava kill
            const damageEffect = result.effects.find(e => e.type === 'Damage');
            expect(damageEffect).toBeDefined();
            expect(result.messages.some(m => m.includes('lava'))).toBe(true);
        });
    });

    describe('Valid Targets', () => {
        it('Returns axial positions within range', () => {
            const state = createTestState();
            const origin = createHex(4, 5);

            const targets = DASH.getValidTargets!(state, origin);

            // Should have targets in 6 directions, up to 4 tiles each
            expect(targets.length).toBeGreaterThan(0);

            // All targets should be on axial lines from origin
            for (const t of targets) {
                const dq = t.q - origin.q;
                const dr = t.r - origin.r;
                // For axial movement, one component is 0 or they have same magnitude
                const isAxial = dq === 0 || dr === 0 || dq === -dr;
                expect(isAxial).toBe(true);
            }
        });

        it('Excludes targets blocked by walls', () => {
            const state = createTestState({
                wallPositions: [createHex(5, 5)] // Wall East of player
            });
            const origin = createHex(4, 5);

            const targets = DASH.getValidTargets!(state, origin);

            // Should not include any positions East of the wall
            const eastTargets = targets.filter(t => t.q > 5 && t.r === 5);
            expect(eastTargets.length).toBe(0);
        });
    });
});
