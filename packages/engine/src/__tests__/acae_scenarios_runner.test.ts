import { describe, test, expect } from 'vitest';
import { SCENARIO_COLLECTIONS } from '../scenarios';
import { primeScenarioPlayerTurn, ScenarioEngine } from '../skillTests';
import { generateInitialState } from '../logic';
import { SpatialSystem } from '../systems/spatial-system';
import { StrategyRegistry } from '../systems/ai/strategy-registry';
import { recomputeVisibilityFromScratch } from '../systems/visibility';

const SCENARIO_GRID_WIDTH = 9;
const SCENARIO_GRID_HEIGHT = 11;

describe('ACAE Scenario Integration', () => {
    const collection = SCENARIO_COLLECTIONS.find(item => item.id === 'acae');
    if (!collection) {
        test('acae collection exists', () => {
            expect(collection).toBeDefined();
        });
        return;
    }

    collection.scenarios.forEach(scenario => {
        test(scenario.title, () => {
            StrategyRegistry.reset();
            const initialState = generateInitialState(1, 'acae-scenario-seed');
            initialState.gridWidth = SCENARIO_GRID_WIDTH;
            initialState.gridHeight = SCENARIO_GRID_HEIGHT;
            initialState.enemies = [];
            initialState.companions = [];
            initialState.shrinePosition = undefined;
            initialState.stairsPosition = { q: 99, r: 99, s: -198 };
            initialState.gameStatus = 'playing';
            if (initialState.tiles) {
                initialState.tiles.clear();
            }

            const engine = new ScenarioEngine(initialState);
            scenario.setup(engine);
            engine.state.occupancyMask = SpatialSystem.refreshOccupancyMask(engine.state);
            engine.state = recomputeVisibilityFromScratch(engine.state);
            engine.state = primeScenarioPlayerTurn(engine.state);

            scenario.run(engine);
            const passed = scenario.verify(engine.state, engine.logs, engine.events);
            expect(passed).toBe(true);
        });
    });
});
