import { describe, expect, it } from 'vitest';
import { calculateCombat } from '../systems/combat/combat-calculator';
import { deriveMaxHpFromTrinity, type TrinityStats } from '../systems/combat/trinity-resolver';

const hitsToKill = (damage: number, hp: number): number => {
    if (damage <= 0) return Number.POSITIVE_INFINITY;
    return Math.ceil(hp / damage);
};

const runCombat = (
    attacker: TrinityStats,
    defender: TrinityStats,
    options: {
        skillId: string;
        basePower: number;
        damageClass: 'physical' | 'magical';
        attackProfile: 'melee' | 'projectile' | 'spell';
        trackingSignature: 'melee' | 'projectile' | 'magic';
        distance?: number;
    }
) => calculateCombat({
    attackerId: `attacker-${options.skillId}`,
    targetId: `defender-${options.skillId}`,
    skillId: options.skillId,
    basePower: options.basePower,
    trinity: attacker,
    targetTrinity: defender,
    damageClass: options.damageClass,
    combatRulesetVersion: 'trinity_ratio_v2',
    attackProfile: options.attackProfile,
    trackingSignature: options.trackingSignature,
    engagementContext: options.distance === undefined ? undefined : { distance: options.distance },
    statusMultipliers: []
});

describe('trinity_ratio_v2 matchup triangle', () => {
    it('Mind remains accurate into low-Instinct brutes at spell range', () => {
        const mage = { body: 10, instinct: 10, mind: 60 };
        const brute = { body: 60, instinct: 10, mind: 10 };

        const mageIntoBrute = runCombat(mage, brute, {
            skillId: 'TEST_MAGE_BRUTE',
            basePower: 12,
            damageClass: 'magical',
            attackProfile: 'spell',
            trackingSignature: 'magic',
            distance: 5
        });
        const bruteIntoMage = runCombat(brute, mage, {
            skillId: 'TEST_BRUTE_MAGE',
            basePower: 10,
            damageClass: 'physical',
            attackProfile: 'melee',
            trackingSignature: 'melee',
            distance: 1
        });

        expect(mageIntoBrute.hitQualityTier === 'normal' || mageIntoBrute.hitQualityTier === 'critical' || mageIntoBrute.hitQualityTier === 'multi_critical').toBe(true);
        expect((mageIntoBrute.baseMagicalDamage || 0)).toBeGreaterThan(0);
        expect((mageIntoBrute.baseMagicalDamage || 0)).toBeGreaterThan((bruteIntoMage.basePhysicalDamage || 0) * 0.8);
    });

    it('Instinct defeats Mind at range by degrading spell quality and winning projectile trades', () => {
        const scout = { body: 10, instinct: 60, mind: 10 };
        const mage = { body: 10, instinct: 10, mind: 60 };

        const scoutIntoMage = runCombat(scout, mage, {
            skillId: 'TEST_SCOUT_MAGE',
            basePower: 10,
            damageClass: 'physical',
            attackProfile: 'projectile',
            trackingSignature: 'projectile',
            distance: 5
        });
        const mageIntoScout = runCombat(mage, scout, {
            skillId: 'TEST_MAGE_SCOUT',
            basePower: 12,
            damageClass: 'magical',
            attackProfile: 'spell',
            trackingSignature: 'magic',
            distance: 5
        });

        const scoutHp = deriveMaxHpFromTrinity(scout, 'trinity_ratio_v2');
        const mageHp = deriveMaxHpFromTrinity(mage, 'trinity_ratio_v2');

        expect(mageIntoScout.hitQualityTier === 'glancing' || mageIntoScout.hitQualityTier === 'miss').toBe(true);
        expect(hitsToKill(scoutIntoMage.finalPower, mageHp)).toBeLessThan(hitsToKill(mageIntoScout.finalPower, scoutHp));
    });

    it('Body defeats Instinct in melee attrition through bulk and physical pressure', () => {
        const brute = { body: 60, instinct: 10, mind: 10 };
        const scout = { body: 10, instinct: 60, mind: 10 };

        const bruteIntoScout = runCombat(brute, scout, {
            skillId: 'TEST_BRUTE_SCOUT',
            basePower: 10,
            damageClass: 'physical',
            attackProfile: 'melee',
            trackingSignature: 'melee',
            distance: 1
        });
        const scoutIntoBrute = runCombat(scout, brute, {
            skillId: 'TEST_SCOUT_BRUTE',
            basePower: 10,
            damageClass: 'physical',
            attackProfile: 'melee',
            trackingSignature: 'melee',
            distance: 1
        });

        const bruteHp = deriveMaxHpFromTrinity(brute, 'trinity_ratio_v2');
        const scoutHp = deriveMaxHpFromTrinity(scout, 'trinity_ratio_v2');

        expect(bruteHp).toBeGreaterThan(scoutHp);
        expect(hitsToKill(bruteIntoScout.finalPower, scoutHp)).toBeLessThan(hitsToKill(scoutIntoBrute.finalPower, bruteHp));
    });
});
