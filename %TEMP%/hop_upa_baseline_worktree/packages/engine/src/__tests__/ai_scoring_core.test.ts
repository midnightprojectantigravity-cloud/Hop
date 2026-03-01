import { describe, expect, it } from 'vitest';
import { scoreFeatures } from '../systems/ai/core/scoring';

describe('ai scoring core', () => {
    it('computes deterministic weighted totals with explicit zero defaults', () => {
        const breakdown = scoreFeatures(
            { damage: 3, safety: -2, tempo: 1 },
            { damage: 2.5, safety: 4, objective: 7 }
        );

        expect(breakdown.total).toBeCloseTo((3 * 2.5) + (-2 * 4) + (1 * 0) + (0 * 7));
        expect(Object.keys(breakdown.features)).toEqual(['damage', 'objective', 'safety', 'tempo']);
        expect(breakdown.contributions.damage).toBeCloseTo(7.5);
        expect(breakdown.contributions.safety).toBeCloseTo(-8);
        expect(breakdown.contributions.objective).toBe(0);
        expect(breakdown.contributions.tempo).toBe(0);
    });
});

