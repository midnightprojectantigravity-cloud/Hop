import { describe, test, expect } from 'vitest';
import { SCENARIO_COLLECTIONS } from '../scenarios';
import { primeScenarioPlayerTurn, ScenarioEngine } from '../skillTests';
import { generateInitialState } from '../logic';
import { SpatialSystem } from '../systems/spatial-system';
import { StrategyRegistry } from '../systems/ai/strategy-registry';
import { recomputeVisibilityFromScratch } from '../systems/visibility';
import { buildIntentPreview } from '../systems/telegraph-projection';

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
                    engine.state = recomputeVisibilityFromScratch(engine.state);
                    engine.state.intentPreview = buildIntentPreview(engine.state);
                    engine.state = primeScenarioPlayerTurn(engine.state);

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
