import { describe, expect, it } from 'vitest';
import { calculateCombat } from '../systems/combat-calculator';

describe('combat range layer', () => {
    it('rewards close engagement for melee-biased attackers', () => {
        const close = calculateCombat({
            attackerId: 'red_attacker',
            targetId: 'green_target',
            skillId: 'TEST_RANGE_CLOSE',
            basePower: 10,
            trinity: { body: 11, instinct: 6, mind: 2 },
            targetTrinity: { body: 5, instinct: 10, mind: 3 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.2 }],
            statusMultipliers: [],
            engagementRange: 1,
            optimalRangeMin: 1,
            optimalRangeMax: 1,
            targetOptimalRangeMin: 4,
            targetOptimalRangeMax: 6
        });

        const far = calculateCombat({
            attackerId: 'red_attacker',
            targetId: 'green_target',
            skillId: 'TEST_RANGE_FAR',
            basePower: 10,
            trinity: { body: 11, instinct: 6, mind: 2 },
            targetTrinity: { body: 5, instinct: 10, mind: 3 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.2 }],
            statusMultipliers: [],
            engagementRange: 5,
            optimalRangeMin: 1,
            optimalRangeMax: 1,
            targetOptimalRangeMin: 4,
            targetOptimalRangeMax: 6
        });

        expect(close.finalPower).toBeGreaterThan(far.finalPower);
        expect(close.scoreEvent.rangePressure).toBeGreaterThan(far.scoreEvent.rangePressure);
    });

    it('allows high instinct to reduce long-range hit decay', () => {
        const lowInstinct = calculateCombat({
            attackerId: 'low_instinct',
            targetId: 'target',
            skillId: 'TEST_LONG_RANGE',
            basePower: 10,
            trinity: { body: 7, instinct: 2, mind: 3 },
            targetTrinity: { body: 6, instinct: 7, mind: 4 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.25 }],
            statusMultipliers: [],
            engagementRange: 5,
            optimalRangeMin: 1,
            optimalRangeMax: 2,
            targetOptimalRangeMin: 2,
            targetOptimalRangeMax: 4
        });

        const highInstinct = calculateCombat({
            attackerId: 'high_instinct',
            targetId: 'target',
            skillId: 'TEST_LONG_RANGE',
            basePower: 10,
            trinity: { body: 7, instinct: 10, mind: 3 },
            targetTrinity: { body: 6, instinct: 7, mind: 4 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.25 }],
            statusMultipliers: [],
            engagementRange: 5,
            optimalRangeMin: 1,
            optimalRangeMax: 2,
            targetOptimalRangeMin: 2,
            targetOptimalRangeMax: 4
        });

        expect(highInstinct.finalPower).toBeGreaterThan(lowInstinct.finalPower);
        expect(highInstinct.scoreEvent.rangePressure).toBeGreaterThan(lowInstinct.scoreEvent.rangePressure);
    });

    it('preserves triangle outputs when range data is not provided', () => {
        const baseline = calculateCombat({
            attackerId: 'baseline',
            targetId: 'target',
            skillId: 'TEST_BASELINE',
            basePower: 9,
            trinity: { body: 6, instinct: 5, mind: 4 },
            targetTrinity: { body: 5, instinct: 6, mind: 5 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.2 }],
            statusMultipliers: []
        });

        const withRangeBandsButNoDistance = calculateCombat({
            attackerId: 'baseline',
            targetId: 'target',
            skillId: 'TEST_BASELINE',
            basePower: 9,
            trinity: { body: 6, instinct: 5, mind: 4 },
            targetTrinity: { body: 5, instinct: 6, mind: 5 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.2 }],
            statusMultipliers: [],
            optimalRangeMin: 1,
            optimalRangeMax: 1,
            targetOptimalRangeMin: 3,
            targetOptimalRangeMax: 5
        });

        expect(withRangeBandsButNoDistance.finalPower).toBe(baseline.finalPower);
        expect(withRangeBandsButNoDistance.rangeMultiplier).toBe(1);
        expect(withRangeBandsButNoDistance.scoreEvent.rangePressure).toBe(0);
    });
});

