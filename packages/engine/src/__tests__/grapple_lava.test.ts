import { describe, it, expect } from 'vitest';
import { COMPOSITIONAL_SKILLS } from '../skillRegistry';
import { generateInitialState, gameReducer } from '../logic';
import { ScenarioEngine } from '../skillTests';
import type { GameState } from '../types';

describe('Grapple -> Lava integration', () => {
    it('hook_lava_intercept scenario should succeed', () => {
        const skillDef = COMPOSITIONAL_SKILLS['GRAPPLE_HOOK']!;
        const scenario = skillDef.scenarios?.find(s => s.id === 'hook_lava_intercept');
        if (!scenario) throw new Error('Scenario not found');

        const initialState = generateInitialState(1, 'test-seed');
        initialState.enemies = [];
        initialState.lavaPositions = [];
        initialState.wallPositions = [];
        initialState.slipperyPositions = [];
        initialState.voidPositions = [];
        initialState.shrinePosition = undefined;
        initialState.shrineOptions = undefined;
        initialState.stairsPosition = { q: 99, r: 99, s: -198 } as any;
        initialState.gameStatus = 'playing';

        const engine = new ScenarioEngine(initialState);
        scenario.setup(engine as any);
        engine.state.initiativeQueue = undefined;
        scenario.run(engine as any);

        const ok = scenario.verify(engine.state, engine.logs);
        if (!ok) {
            console.log('Scenario logs:', engine.logs);
            console.log('Enemies:', engine.state.enemies.map(e => `${e.id}@${(e as any).position.q},${(e as any).position.r}`));
            console.log('Player:', (engine.state.player as any).position);
        }
        expect(ok).toBe(true);
    });
});
