import { describe, expect, it } from 'vitest';
import { validateReplayActions } from '../systems/replay-validation';

describe('replay action validation', () => {
    it('accepts valid replay actions without dropping entries', () => {
        const actions = [
            { type: 'WAIT' },
            { type: 'ADVANCE_TURN' },
            { type: 'MOVE', payload: { q: 1, r: 1, s: -2 } }
        ];

        const result = validateReplayActions(actions);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.actions).toHaveLength(actions.length);
    });

    it('rejects invalid action types explicitly', () => {
        const actions = [
            { type: 'WAIT' },
            { type: 'RESET' }, // not replayable in action logs
            { type: 'MOVE', payload: { q: 2, r: 2, s: -4 } }
        ];
        const result = validateReplayActions(actions);
        expect(result.valid).toBe(false);
        expect(result.actions).toHaveLength(2);
        expect(result.errors.some(e => e.includes('"RESET"'))).toBe(true);
    });

    it('rejects non-array payloads', () => {
        const result = validateReplayActions({ type: 'WAIT' });
        expect(result.valid).toBe(false);
        expect(result.actions).toHaveLength(0);
        expect(result.errors[0]).toContain('must be an array');
    });
});

