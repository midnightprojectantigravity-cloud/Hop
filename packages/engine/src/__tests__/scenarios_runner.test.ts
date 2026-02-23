import { describe, test, expect } from 'vitest';
import { SCENARIO_COLLECTIONS } from '../scenarios';
import { ScenarioEngine } from '../skillTests';
import { generateInitialState } from '../logic';
import { buildInitiativeQueue, isPlayerTurn } from '../systems/initiative';
import { SpatialSystem } from '../systems/SpatialSystem';
import { StrategyRegistry } from '../systems/strategy-registry';

const SCENARIO_GRID_WIDTH = 9;
const SCENARIO_GRID_HEIGHT = 11;

describe('Skill Scenarios Integration', () => {
    SCENARIO_COLLECTIONS.forEach(collection => {
        if (!collection.scenarios || collection.scenarios.length === 0) return;

        describe(`${collection.name} (${collection.id})`, () => {
            collection.scenarios.forEach(scenario => {
                test(scenario.title, () => {
                    // WORLD-CLASS LOGIC: Test Isolation
                    // StrategyRegistry is static; must be reset to clear intents from previous tests
                    StrategyRegistry.reset();

                    const initialState = generateInitialState(1, 'test-seed');
                    initialState.gridWidth = SCENARIO_GRID_WIDTH;
                    initialState.gridHeight = SCENARIO_GRID_HEIGHT;

                    // Reset game board for test isolation
                    initialState.enemies = [];
                    initialState.companions = [];
                    initialState.shrinePosition = undefined;
                    initialState.stairsPosition = { q: 99, r: 99, s: -198 };
                    initialState.gameStatus = 'playing';

                    /**
                     * FIXED: Unified Tile Service
                     * 'lavaPositions' and 'wallPositions' no longer exist on GameState.
                     * Clearing the tiles map removes all environmental obstacles.
                     */
                    if (initialState.tiles) {
                        initialState.tiles.clear();
                    }

                    const engine = new ScenarioEngine(initialState);

                    // Setup
                    scenario.setup(engine);

                    // Re-calculate occupancy mask after setup adds walls/units
                    engine.state.occupancyMask = SpatialSystem.refreshOccupancyMask(engine.state);

                    // Force initiative queue rebuild
                    engine.state.initiativeQueue = buildInitiativeQueue(engine.state);

                    // Advance initiative until it is the player's turn
                    let safety = 0;
                    while (safety < 100) {
                        if (isPlayerTurn(engine.state)) {
                            break;
                        }
                        engine.state = engine.dispatchSync({ type: 'ADVANCE_TURN' });
                        safety++;
                    }

                    // Run
                    scenario.run(engine);

                    // Verify
                    const passed = scenario.verify(engine.state, engine.logs, engine.events);

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
