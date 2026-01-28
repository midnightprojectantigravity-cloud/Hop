
import { describe, test, expect } from 'vitest';
import { SCENARIO_COLLECTIONS } from '../scenarios';
import { ScenarioEngine } from '../skillTests';
import { generateInitialState } from '../logic';
import { buildInitiativeQueue } from '../systems/initiative';

describe('Skill Scenarios Integration', () => {
    SCENARIO_COLLECTIONS.forEach(collection => {
        if (!collection.scenarios || collection.scenarios.length === 0) return;

        describe(`${collection.name} (${collection.id})`, () => {
            collection.scenarios.forEach(scenario => {
                test(scenario.title, () => {
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
                    // Unified Tile Service: Clear the pre-generated dungeon map to ensure test isolation
                    if (initialState.tiles) initialState.tiles.clear();

                    const engine = new ScenarioEngine(initialState);

                    // Setup
                    scenario.setup(engine);

                    // Force initiative queue rebuild to ensure consistency after setup modifications
                    engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

                    // Advance initiative until it is the player's turn
                    // (buildInitiativeQueue starts at index -1, so we must advance at least once)
                    let safety = 0;
                    while (safety < 100) {
                        const q = engine.state.initiativeQueue;
                        if (q && q.currentIndex >= 0 && q.entries[q.currentIndex].actorId === 'player') {
                            break;
                        }
                        engine.dispatch({ type: 'ADVANCE_TURN' });
                        safety++;
                    }

                    // Run
                    scenario.run(engine);

                    // Verify
                    const passed = scenario.verify(engine.state, engine.logs);

                    if (!passed) {
                        console.error(`Scenario Failed: ${scenario.title}`);
                        console.error('Logs:', engine.logs);
                    }

                    expect(passed).toBe(true);
                });
            });
        });
    });
});
