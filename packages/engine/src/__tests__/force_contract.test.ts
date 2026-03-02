import { describe, expect, it } from 'vitest';
import {
    FORCE_CONTRACT_V1,
    computeCanonicalForce,
    normalizeMomentumBudget,
    toCanonicalDistance
} from '../systems/combat/force-contract';

describe('force contract', () => {
    it('computes canonical force using mass, velocity, and momentum modifier', () => {
        const force = computeCanonicalForce(1.5, 2, 0.75);
        expect(force).toBeCloseTo((1.5 * 2) + 0.75, 8);
    });

    it('converts force to clamped travel distance deterministically', () => {
        const distance = toCanonicalDistance(4.9, 3, {
            ...FORCE_CONTRACT_V1,
            distanceDivisor: 1
        });
        expect(distance).toBe(3);
    });

    it('normalizes kinetic momentum budgets to non-negative integers', () => {
        expect(normalizeMomentumBudget(4.8)).toBe(4);
        expect(normalizeMomentumBudget(-2)).toBe(0);
        expect(normalizeMomentumBudget(Number.NaN)).toBe(0);
    });
});
