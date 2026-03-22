import { describe, expect, it } from 'vitest';
import {
    isReplayRecordableAction,
    validateReplayActions,
    validateReplayEnvelopeV3
} from '../systems/replay-validation';

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

    it('classifies replay recordable action types', () => {
        expect(isReplayRecordableAction({ type: 'WAIT' })).toBe(true);
        expect(isReplayRecordableAction({ type: 'START_RUN' })).toBe(false);
        expect(isReplayRecordableAction(null)).toBe(false);
    });
});

describe('replay envelope v3 validation', () => {
    it('accepts a valid replay envelope v3 payload', () => {
        const payload = {
            version: 3,
            run: {
                seed: 'seed-123',
                loadoutId: 'VANGUARD',
                startFloor: 1,
                mapSize: { width: 9, height: 11 },
                mapShape: 'diamond',
                mode: 'normal',
                combatVersion: 'trinity_ratio_v2'
            },
            actions: [
                { type: 'WAIT' },
                { type: 'ADVANCE_TURN' }
            ],
            meta: {
                recordedAt: '2026-03-03T09:00:00.000Z',
                source: 'client'
            }
        };

        const result = validateReplayEnvelopeV3(payload);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.envelope?.version).toBe(3);
        expect(result.envelope?.actions).toHaveLength(2);
        expect(result.envelope?.run.mapSize).toEqual({ width: 9, height: 11 });
        expect(result.envelope?.run.mapShape).toBe('diamond');
        expect(result.envelope?.run.combatVersion).toBe('trinity_ratio_v2');
    });

    it('rejects non-v3 replay payloads', () => {
        const payload = {
            seed: 'legacy-seed',
            actions: [{ type: 'WAIT' }]
        };

        const result = validateReplayEnvelopeV3(payload as any);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('version must be 3'))).toBe(true);
    });

    it('rejects envelopes with non-replayable actions', () => {
        const payload = {
            version: 3,
            run: { seed: 'seed-456' },
            actions: [{ type: 'START_RUN', payload: { loadoutId: 'VANGUARD' } }],
            meta: { recordedAt: '2026-03-03T09:00:00.000Z' }
        };

        const result = validateReplayEnvelopeV3(payload as any);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('not replayable'))).toBe(true);
    });

    it('rejects envelopes with invalid run.mapSize values', () => {
        const payload = {
            version: 3,
            run: {
                seed: 'seed-789',
                mapSize: { width: 0, height: 11 }
            },
            actions: [{ type: 'WAIT' }],
            meta: { recordedAt: '2026-03-03T09:00:00.000Z' }
        };

        const result = validateReplayEnvelopeV3(payload as any);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('run.mapSize.width'))).toBe(true);
    });

    it('rejects envelopes with invalid run.mapShape values', () => {
        const payload = {
            version: 3,
            run: {
                seed: 'seed-790',
                mapShape: 'triangle'
            },
            actions: [{ type: 'WAIT' }],
            meta: { recordedAt: '2026-03-03T09:00:00.000Z' }
        };

        const result = validateReplayEnvelopeV3(payload as any);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('run.mapShape'))).toBe(true);
    });
});
