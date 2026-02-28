import { describe, expect, it } from 'vitest';
import { chooseIndexFromSeeded, chooseIndexFromStateRng } from '../systems/ai/core/tiebreak';
import type { GameState } from '../types';

describe('ai tiebreak determinism', () => {
    it('seeded tie-break returns stable index for same seed/counter', () => {
        const a = chooseIndexFromSeeded(5, { seed: 'ai-tie', counter: 12 });
        const b = chooseIndexFromSeeded(5, { seed: 'ai-tie', counter: 12 });
        const c = chooseIndexFromSeeded(5, { seed: 'ai-tie', counter: 13 });

        expect(a.index).toBe(b.index);
        expect(a.rngConsumption).toBe(1);
        expect(c.index).not.toBeUndefined();
    });

    it('state-rng tie-break advances rngCounter exactly once', () => {
        const state = { rngSeed: 'tie-state', rngCounter: 4 } as GameState;
        const result = chooseIndexFromStateRng(7, { state });

        expect(result.nextState?.rngCounter).toBe(5);
        expect(result.rngConsumption).toBe(1);
        expect(result.index).toBeGreaterThanOrEqual(0);
        expect(result.index).toBeLessThan(7);
    });
});

