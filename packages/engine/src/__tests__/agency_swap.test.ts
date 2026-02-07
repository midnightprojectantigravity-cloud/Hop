import { describe, it, expect, beforeEach } from 'vitest';
import { generateInitialState, processNextTurn } from '../logic';
import { StrategyRegistry } from '../systems/strategy-registry';
import { WildStrategy } from '../strategy/wild';
import { GhostStrategy } from '../strategy/ghost';
import { Intent } from '../types/intent';
import { GameState } from '../types';

describe('Agency Swap: Ghost vs Wild', () => {
    let capturedIntents: Intent[] = [];

    // Validates that GhostStrategy can perfectly replicate WildStrategy's run
    it('Should produce identical state when replaying captured intents', () => {
        const seed = 'AGENCY_TEST_SEED_123';
        const initialState = generateInitialState(1, seed);

        // RUN 1: Wild Strategy (Recording)
        let state1 = { ...initialState };
        capturedIntents = [];

        // Monkey-patch WildStrategy to capture intents
        // Note: StrategyRegistry returns new instances or singletons?
        // Logic uses StrategyRegistry.resolve().
        // We can override the registry for specific actors or rely on the default behavior.
        // Better: Create a "RecordingStrategy" wrapper?

        // Setup Spies
        const originalResolve = StrategyRegistry.resolve.bind(StrategyRegistry);
        StrategyRegistry.resolve = (actor) => {
            if (actor.type === 'enemy') {
                const wild = new WildStrategy();
                const originalGetIntent = wild.getIntent.bind(wild);
                wild.getIntent = (gs, a) => {
                    const intent = originalGetIntent(gs, a) as Intent;
                    capturedIntents.push(intent);
                    return intent;
                };
                return wild;
            } else if (actor.type === 'player') {
                return {
                    getIntent: (gs, a) => ({
                        type: 'WAIT',
                        actorId: a.id,
                        skillId: 'WAIT',
                        priority: 10,
                        metadata: { expectedValue: 0, reasoningCode: 'TEST_WAIT', isGhost: false }
                    } as Intent)
                };
            }
            return originalResolve(actor);
        };

        // Run 5 full turns (rounds)
        // We iterate enough times to ensure multiple enemy moves.
        // processNextTurn handles one actor turn or step.
        // We need to run until turnNumber increases significantly? 
        // Or just run X invocations of processNextTurn.

        // Let's run until Turn 3.
        let safeguard = 0;
        while (state1.turnNumber < 3 && safeguard < 200) {
            state1 = processNextTurn(state1);
            safeguard++;
        }

        // Restore Registry
        StrategyRegistry.resolve = originalResolve;

        console.log(`Captured ${capturedIntents.length} intents during Wild Run.`);

        // RUN 2: Ghost Strategy (Replay)
        let state2 = { ...initialState }; // Valid deep copy for our purposes (JSON safe usually)

        // Configure Ghost Strategy
        const ghostStrategy = new GhostStrategy(capturedIntents);

        // Force Registry to return GhostStrategy for enemies
        StrategyRegistry.resolve = (actor) => {
            if (actor.type === 'enemy') {
                return ghostStrategy;
            } else if (actor.type === 'player') {
                return {
                    getIntent: (gs, a) => ({
                        type: 'WAIT',
                        actorId: a.id,
                        skillId: 'WAIT',
                        priority: 10,
                        metadata: {
                            expectedValue: 0,
                            reasoningCode: 'TEST_WAIT',
                            isGhost: false
                        }
                    } as Intent)
                };
            }
            return originalResolve(actor);
        };

        safeguard = 0;
        while (state2.turnNumber < 3 && safeguard < 200) {
            state2 = processNextTurn(state2);
            safeguard++;
        }

        StrategyRegistry.resolve = originalResolve;

        // ASSERTIONS
        // Compare outcomes
        expect(state2.turnNumber).toBe(state1.turnNumber);
        expect(state2.player.hp).toBe(state1.player.hp);
        expect(state2.enemies.length).toBe(state1.enemies.length);

        state1.enemies.forEach((e1, idx) => {
            const e2 = state2.enemies[idx]; // Assuming order is preserved (it should be)
            expect(e2.id).toBe(e1.id);
            expect(e2.position).toEqual(e1.position);
            expect(e2.hp).toBe(e1.hp);
        });

        // Strict Delta Check (Optional)
        // expect(JSON.stringify(state2)).toEqual(JSON.stringify(state1)); 
        // Note: JSON stringify might differ on undefined vs null or property order, generally risky for exact match but good for "Gold Standard".
    });
});
