import { describe, expect, it } from 'vitest';
import { calculateCombat } from '../systems/combat/combat-calculator';

describe('combat calculator trinity_ratio_v2', () => {
    it('applies glancing minimums to positive sub-1 hits', () => {
        const result = calculateCombat({
            attackerId: 'scout',
            targetId: 'tank',
            skillId: 'TEST_CHIP',
            basePower: 0,
            trinity: { body: 1, instinct: 1, mind: 1 },
            targetTrinity: { body: 10, instinct: 10, mind: 10 },
            statusMultipliers: [],
            damageClass: 'physical',
            combatRulesetVersion: 'trinity_ratio_v2',
            trackingSignature: 'melee',
            projectionCoefficients: {
                physicalAttack: { body: 0.2, instinct: 0, mind: 0 },
                physicalDefense: { body: 20, instinct: 0, mind: 0 }
            },
            hitQualityCoefficients: {
                melee: {
                    attackerInstinct: 1,
                    defenderInstinct: 1,
                    adjacency: 4
                }
            }
        });

        expect(result.hitQualityTier).toBe('glancing');
        expect(result.finalPower).toBe(1);
    });

    it('keeps long-range magic effective into low-instinct brutes', () => {
        const brute = calculateCombat({
            attackerId: 'mage',
            targetId: 'brute',
            skillId: 'TEST_MAGIC_BRUTE',
            basePower: 12,
            trinity: { body: 2, instinct: 10, mind: 20 },
            targetTrinity: { body: 25, instinct: 4, mind: 4 },
            statusMultipliers: [],
            damageClass: 'magical',
            combatRulesetVersion: 'trinity_ratio_v2',
            trackingSignature: 'magic',
            engagementContext: { distance: 5 }
        });

        expect(brute.hitQualityTier === 'normal' || brute.hitQualityTier === 'critical' || brute.hitQualityTier === 'multi_critical').toBe(true);
        expect(brute.finalPower).toBeGreaterThan(0);
    });

    it('lets high-instinct scouts heavily degrade long-range magic', () => {
        const scout = calculateCombat({
            attackerId: 'mage',
            targetId: 'scout',
            skillId: 'TEST_MAGIC_SCOUT',
            basePower: 12,
            trinity: { body: 2, instinct: 10, mind: 20 },
            targetTrinity: { body: 4, instinct: 60, mind: 6 },
            statusMultipliers: [],
            damageClass: 'magical',
            combatRulesetVersion: 'trinity_ratio_v2',
            trackingSignature: 'magic',
            engagementContext: { distance: 5 }
        });

        expect(scout.hitQualityTier === 'glancing' || scout.hitQualityTier === 'miss').toBe(true);
    });
});
