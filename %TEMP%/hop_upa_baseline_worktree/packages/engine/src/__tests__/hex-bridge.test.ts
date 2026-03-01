
/**
 * TDD: HEX BRIDGE TESTS
 * Focus: 3D Hex to 1D projection, direction detection, boundary injection
*
* Run independently: npx vitest run src/__tests__/hex-bridge.test.ts
*/

import { describe, it, expect } from 'vitest';
import { KineticEntity } from '../systems/movement/kinetic-kernel';
import {
    prepareKineticSimulation,
    translate1DToHex,
    translateKineticResultToHex,
    getDirectionKey,
    HEX_DIRECTIONS
} from '../systems/movement/hex-bridge';
import type { GameState, Point, Actor } from '../types';
import { createHex } from '../hex';

// Helper to create a minimal actor for testing
function createTestActor(overrides: Partial<Actor> = {}): Actor {
    return {
        id: 'test-actor',
        type: 'player' as const,
        position: createHex(0, 0),
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
        player: createTestActor({ id: 'player', type: 'player' }),
        enemies: [],
        gridWidth: 9,
        gridHeight: 11,
        stairsPosition: createHex(4, 5),
        gameStatus: 'playing',
        message: [],
        tiles: new Map(),
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

describe('Hex Bridge', () => {
    describe('Direction Detection', () => {
        it('Correctly identifies East direction', () => {
            const start = createHex(0, 0);
            const target = createHex(3, 0); // 3 tiles East

            const dir = getDirectionKey(start, target);

            expect(dir).toBe('E');
        });

        it('Correctly identifies NE direction', () => {
            const start = createHex(0, 0);
            const target = createHex(2, -2); // 2 tiles NE

            const dir = getDirectionKey(start, target);

            expect(dir).toBe('NE');
        });

        it('Correctly identifies W direction', () => {
            const start = createHex(5, 5);
            const target = createHex(3, 5); // 2 tiles West

            const dir = getDirectionKey(start, target);

            expect(dir).toBe('W');
        });

        it('Throws for non-axial targets', () => {
            const start = createHex(0, 0);
            const target = createHex(1, 1); // Diagonal, not axial

            expect(() => getDirectionKey(start, target)).toThrow();
        });
    });

    describe('1D Projection', () => {
        it('Projects entities on East axis to correct 1D positions', () => {
            const state = createTestState({
                player: createTestActor({
                    id: 'player',
                    type: 'player',
                    position: createHex(2, 4)
                }),
                enemies: [
                    createTestActor({
                        id: 'enemy1',
                        type: 'enemy',
                        position: createHex(3, 4), // 1 tile East of player
                        factionId: 'enemy'
                    })
                ]
            });

            const result = prepareKineticSimulation(
                'player',
                createHex(5, 4), // Target East
                5,
                state
            );

            // Player should be at 1D pos 0, enemy at pos 1
            const playerEnt = result.state.entities.find((e: KineticEntity) => e.id === 'player');
            const enemyEnt = result.state.entities.find((e: KineticEntity) => e.id === 'enemy1');

            expect(playerEnt?.pos).toBe(0);
            expect(playerEnt?.type).toBe('S');
            expect(enemyEnt?.pos).toBe(1);
            expect(enemyEnt?.type).toBe('M');
        });

        it('Ignores entities not on the axial line', () => {
            const state = createTestState({
                player: createTestActor({
                    id: 'player',
                    type: 'player',
                    position: createHex(2, 4)
                }),
                enemies: [
                    createTestActor({
                        id: 'enemy_on_line',
                        type: 'enemy',
                        position: createHex(4, 4), // On East line
                        factionId: 'enemy'
                    }),
                    createTestActor({
                        id: 'enemy_off_line',
                        type: 'enemy',
                        position: createHex(3, 5), // NOT on East line
                        factionId: 'enemy'
                    })
                ]
            });

            const result = prepareKineticSimulation(
                'player',
                createHex(5, 4),
                5,
                state
            );

            const onLine = result.state.entities.find(e => e.id === 'enemy_on_line');
            const offLine = result.state.entities.find(e => e.id === 'enemy_off_line');

            expect(onLine).toBeDefined();
            expect(offLine).toBeUndefined();
        });
    });

    describe('Boundary Injection', () => {
        it('Injects MAP_EDGE at correct position', () => {
            const state = createTestState({
                player: createTestActor({
                    id: 'player',
                    type: 'player',
                    position: createHex(4, 5) // Center-ish
                })
            });

            const result = prepareKineticSimulation(
                'player',
                createHex(6, 5), // East
                10,
                state
            );

            const mapEdge = result.state.entities.find(e => e.id === 'MAP_EDGE');

            expect(mapEdge).toBeDefined();
            expect(mapEdge?.type).toBe('I');
            // The exact position depends on grid size and diamond geometry
            expect(mapEdge?.pos).toBeGreaterThan(0);
        });
    });

    describe('1D to Hex Translation', () => {
        it('Correctly translates 1D position back to hex', () => {
            const origin = createHex(2, 4);
            const direction = HEX_DIRECTIONS['E'];

            const result = translate1DToHex(origin, direction, 3);

            expect(result.q).toBe(5); // 2 + 1*3
            expect(result.r).toBe(4); // 4 + 0*3
            expect(result.s).toBe(-9); // -6 + (-1)*3
        });

        it('Batch translates kinetic result', () => {
            const origin = createHex(0, 0);
            const direction = HEX_DIRECTIONS['E'];
            const entities = [
                { id: 'player', type: 'S' as const, pos: 0 },
                { id: 'enemy1', type: 'M' as const, pos: 3 }
            ];

            const positions = translateKineticResultToHex(entities, origin, direction);

            // Player at origin (pos 0), using toBeCloseTo to avoid -0 issues
            const playerPos = positions.get('player')!;
            expect(playerPos.q).toBeCloseTo(0);
            expect(playerPos.r).toBeCloseTo(0);
            expect(playerPos.s).toBeCloseTo(0);

            // Enemy at pos 3 along East
            const enemyPos = positions.get('enemy1')!;
            expect(enemyPos.q).toBe(3);
            expect(enemyPos.r).toBeCloseTo(0);
            expect(enemyPos.s).toBe(-3);
        });
    });

    describe('Momentum Pass-Through', () => {
        it('Correctly assigns momentum to 1D state', () => {
            const state = createTestState();
            const testMomentum = 7;

            const result = prepareKineticSimulation(
                'player',
                createHex(3, 0),
                testMomentum,
                state
            );

            expect(result.state.momentum).toBe(7);
            expect(result.direction).toBe('E');
        });
    });
});
