import { describe, it, expect } from 'vitest';
import { createMockState, placeTile, p } from './test_utils';
import { gameReducer } from '../logic';

describe('DASH Momentum Validation', () => {
    it('DASH should travel exactly to target in normal conditions', () => {
        const state = createMockState();
        const startPos = p(4, 4);
        state.player.position = startPos;

        // Target 2 tiles away: p(6, 4)
        const targetPos = p(6, 4);

        // Ensure path is clear
        placeTile(state, p(4, 4), ['WALKABLE']);
        placeTile(state, p(5, 4), ['WALKABLE']);
        placeTile(state, p(6, 4), ['WALKABLE']);

        const action = { type: 'USE_SKILL' as const, payload: { skillId: 'DASH', target: targetPos } };
        const newState = gameReducer(state, action);

        expect(newState.player.position.q).toBe(6);
    });

    it('DASH should travel further when passing through SLIPPERY tiles', () => {
        const state = createMockState();
        const startPos = p(4, 4);
        state.player.position = startPos;

        // Target (6, 4). 
        // Logic: Path is [(4,4), (5,4), (6,4)]
        // (5,4) is SLIPPERY -> Momentum preserved.

        // Ensure path is clear except for the ice
        placeTile(state, p(4, 4), ['WALKABLE']);
        placeTile(state, p(5, 4), ['WALKABLE', 'SLIPPERY']);
        placeTile(state, p(6, 4), ['WALKABLE']);
        placeTile(state, p(7, 4), ['WALKABLE']);

        const action = { type: 'USE_SKILL' as const, payload: { skillId: 'DASH', target: p(6, 4) } };
        const newState = gameReducer(state, action);

        // Expectation: Sliding preserved momentum through the target
        // (Currently this will likely fail or just return 6 until we fix the engine)
        expect(newState.player.position.q).toBeGreaterThan(6);
    });
});
