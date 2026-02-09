import { describe, expect, it } from 'vitest';
import { resolveTrinityLevers, computeSparkCostFromTrinity } from '../systems/trinity-resolver';

describe('trinity-resolver', () => {
    it('computes deterministic lever bundle from trinity stats', () => {
        const trinity = { body: 20, mind: 30, instinct: 8 };
        const levers = resolveTrinityLevers(trinity);

        expect(levers.bodyDamageMultiplier).toBe(2);
        expect(levers.bodyMitigation).toBe(0.2);
        expect(levers.mindStatusDurationBonus).toBe(2);
        expect(levers.mindMagicMultiplier).toBe(2.5);
        expect(levers.instinctInitiativeBonus).toBe(16);
        expect(levers.instinctCriticalMultiplier).toBe(1.16);
        expect(levers.instinctSparkDiscountMultiplier).toBe(0.92);
    });

    it('clamps extreme values and preserves non-negative outputs', () => {
        const levers = resolveTrinityLevers({ body: 120, mind: -10, instinct: 999 });
        expect(levers.bodyMitigation).toBe(0.5);
        expect(levers.mindStatusDurationBonus).toBe(0);
        expect(levers.instinctCriticalMultiplier).toBe(1.2);
        expect(levers.instinctSparkDiscountMultiplier).toBe(0);
    });

    it('computes spark cost from fibonacci base and instinct discount', () => {
        expect(computeSparkCostFromTrinity(5, { body: 0, mind: 0, instinct: 4 })).toBe(4.8);
    });
});
