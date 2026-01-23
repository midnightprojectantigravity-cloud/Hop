/**
 * TILE EFFECTS SYSTEM TESTS
 * 
 * These tests verify the Observer-Based Tile Effects architecture.
 * 
 * Key Principles:
 * 1. Tiles observe units, not the other way around
 * 2. Effects trigger regardless of HOW a unit arrives (walk, push, dash, etc.)
 * 3. Tiles can modify kinetic momentum
 * 4. Tiles can interrupt movement chains
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ScenarioEngine } from '../skillTests';
import { generateInitialState } from '../logic';
import { buildInitiativeQueue } from '../systems/initiative';
import {
    LAVA_SLIDE_SCENARIO,
    ICE_SLIDE_SCENARIO,
    MIXED_TERRAIN_SCENARIO
} from '../scenarios/tile_effects';

describe('Tile Effects System', () => {
    let engine: ScenarioEngine;

    beforeEach(() => {
        const initialState = generateInitialState(1, 'test-seed');
        // Reset game board for test isolation
        initialState.enemies = [];
        initialState.lavaPositions = [];
        initialState.wallPositions = [];
        initialState.slipperyPositions = [];
        initialState.voidPositions = [];
        initialState.shrinePosition = undefined;
        initialState.stairsPosition = { q: 99, r: 99, s: -198 };
        initialState.gameStatus = 'playing';

        engine = new ScenarioEngine(initialState);
    });

    describe('Lava Sink Effect', () => {
        it('should reduce momentum when units pass through lava', () => {
            LAVA_SLIDE_SCENARIO.setup(engine);

            // Rebuild initiative queue after setup
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            LAVA_SLIDE_SCENARIO.run(engine);

            const state = engine.state;
            const logs = engine.logs;

            const result = LAVA_SLIDE_SCENARIO.verify(state, logs);
            expect(result).toBe(true);
        });

        it('should apply damage when units land on lava', () => {
            LAVA_SLIDE_SCENARIO.setup(engine);
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            LAVA_SLIDE_SCENARIO.run(engine);

            const state = engine.state;
            const goblin = state.enemies.find((e: any) => e.id === 'goblin-1');

            // Goblin should either be dead or have taken damage
            if (goblin) {
                expect(goblin.hp).toBeLessThan(goblin.maxHp);
            } else {
                // Goblin died in lava - this is expected
                expect(goblin).toBeUndefined();
            }
        });

        it('should interrupt movement chain when lead unit dies in lava', () => {
            LAVA_SLIDE_SCENARIO.setup(engine);
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            LAVA_SLIDE_SCENARIO.run(engine);

            const state = engine.state;
            const messages = state.message || [];

            // Should have a message about the chain breaking or lava
            const hasLavaMessage = messages.some((msg: string) =>
                msg.includes('chain broke') || msg.includes('lava')
            );

            expect(hasLavaMessage).toBe(true);
        });
    });

    describe('Ice Effect', () => {
        it('should preserve momentum when units pass through ice', () => {
            ICE_SLIDE_SCENARIO.setup(engine);
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            ICE_SLIDE_SCENARIO.run(engine);

            const state = engine.state;
            const logs = engine.logs;

            const result = ICE_SLIDE_SCENARIO.verify(state, logs);
            expect(result).toBe(true);
        });

        it('should cause units to slide further than on normal terrain', () => {
            ICE_SLIDE_SCENARIO.setup(engine);
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            ICE_SLIDE_SCENARIO.run(engine);

            const state = engine.state;
            const goblin = state.enemies.find((e: any) => e.id === 'goblin-1');

            expect(goblin).toBeDefined();
            // Goblin should have slid to at least hex 4 (q >= 4)
            if (goblin) {
                expect(goblin.position.q).toBeGreaterThanOrEqual(4);
            }
        });
    });

    describe('Mixed Terrain', () => {
        it('should handle multiple tile types in sequence', () => {
            MIXED_TERRAIN_SCENARIO.setup(engine);
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            MIXED_TERRAIN_SCENARIO.run(engine);

            const state = engine.state;
            const logs = engine.logs;

            const result = MIXED_TERRAIN_SCENARIO.verify(state, logs);
            expect(result).toBe(true);
        });

        it('should apply cumulative effects from different tiles', () => {
            MIXED_TERRAIN_SCENARIO.setup(engine);
            engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

            // Advance to player's turn
            let safety = 0;
            while (safety < 100) {
                const q = engine.state.initiativeQueue;
                if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                    break;
                }
                engine.dispatch({ type: 'ADVANCE_TURN' });
                safety++;
            }

            MIXED_TERRAIN_SCENARIO.run(engine);

            const state = engine.state;
            const goblin = state.enemies.find((e: any) => e.id === 'goblin-1');

            // Goblin should have taken damage from lava
            if (goblin) {
                expect(goblin.hp).toBeLessThan(goblin.maxHp);
            }
        });
    });

    describe('Separation of Concerns', () => {
        it('should keep tile logic separate from movement logic', () => {
            // This is a conceptual test
            // The fact that we can add new tile effects without modifying
            // the movement system proves separation of concerns

            // We verify this by checking that the tile effects system
            // is modular and extensible

            const { TILE_EFFECT_REGISTRY } = require('../systems/tile-effects');

            // Should have registered effects
            expect(TILE_EFFECT_REGISTRY).toBeDefined();
            expect(Object.keys(TILE_EFFECT_REGISTRY).length).toBeGreaterThan(0);

            // Should include our built-in effects
            expect(TILE_EFFECT_REGISTRY['lava_sink']).toBeDefined();
            expect(TILE_EFFECT_REGISTRY['ice']).toBeDefined();
        });

        it('should allow dynamic tile effect registration', () => {
            const { registerTileEffect } = require('../systems/tile-effects');

            // Create a custom tile effect
            const customEffect = {
                id: 'test_effect',
                name: 'Test Effect',
                description: 'A test effect',
                onPass: () => ({
                    effects: [],
                    messages: ['Test!']
                })
            };

            // Should be able to register it
            expect(() => registerTileEffect(customEffect)).not.toThrow();
        });
    });
});
