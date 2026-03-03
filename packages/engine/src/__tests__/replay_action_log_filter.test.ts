import { describe, expect, it } from 'vitest';
import { gameReducer, generateInitialState } from '../logic';

describe('replay action-log filtering', () => {
    it('excludes lifecycle actions from actionLog', () => {
        const hub = gameReducer(generateInitialState(1, 'replay-filter-seed'), { type: 'EXIT_TO_HUB' });
        const started = gameReducer(hub, {
            type: 'START_RUN',
            payload: { loadoutId: 'VANGUARD', mode: 'normal' }
        });

        expect(started.actionLog).toEqual([]);

        const reset = gameReducer(started, { type: 'RESET', payload: { seed: 'reset-seed' } });
        expect(reset.actionLog).toEqual([]);
    });

    it('keeps in-run replayable actions in actionLog', () => {
        const state = generateInitialState(1, 'replay-filter-seed-2');
        const waited = gameReducer(state, { type: 'WAIT' });
        expect(waited.actionLog || []).toHaveLength(1);
        expect((waited.actionLog || [])[0]?.type).toBe('WAIT');
    });
});
