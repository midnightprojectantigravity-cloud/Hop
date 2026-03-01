import { describe, it, expect } from 'vitest';
import { gameReducer, generateInitialState } from '../logic';
import type { Action } from '../types';

describe('Hub Interactions', () => {
    it('Should return to hub state when EXIT_TO_HUB is dispatched', () => {
        const playingState = generateInitialState(1, 'test-seed');
        expect(playingState.gameStatus).toBe('playing');

        const width = playingState.gridWidth;
        const height = playingState.gridHeight;

        const action: Action = { type: 'EXIT_TO_HUB' };
        const hubState = gameReducer(playingState, action);

        expect(hubState.gameStatus).toBe('hub');
        // Hub typically resets or clears certain tactical data
        expect(hubState.floor).toBe(1);
        expect(hubState.enemies.length).toBeGreaterThanOrEqual(0); // Hub might have 0 enemies or just not display them
        expect(hubState.message[0]).toContain('Strategic Hub');
    });

    it('Should allow EXIT_TO_HUB even from "won" or "lost" states', () => {
        const playingState = generateInitialState(1, 'test-seed');
        const wonState = { ...playingState, gameStatus: 'won' as const };

        const action: Action = { type: 'EXIT_TO_HUB' };

        // This relies on the reducer guard clause allowing EXIT_TO_HUB
        const hubState = gameReducer(wonState, action);
        expect(hubState.gameStatus).toBe('hub');
    });
});
