import { describe, expect, it } from 'vitest';
import {
    calculateCombat,
    extractTrinityStats,
    computeStatusDuration,
    computeInitiativeBonus,
    computeCriticalMultiplier,
    computeSparkCost,
    GrandCalculator
} from '../systems/combat/combat-calculator';
import { resolveCombatTuning } from '../data/combat-tuning-ledger';
import type { Actor } from '../types';

describe('combat-calculator', () => {
    it('layers the shared combat variables with the skill tuning row', () => {
        const tuning = resolveCombatTuning('BASIC_ATTACK');

        expect(tuning.trinityLevers.bodyDamageMultiplierPerPoint).toBe(0.5);
        expect(tuning.trinityLevers.basePowerMultiplier).toBe(1);

        const result = calculateCombat({
            attackerId: 'player',
            targetId: 'enemy_1',
            skillId: 'BASIC_ATTACK',
            basePower: 0,
            trinity: { body: 100, mind: 0, instinct: 0 },
            targetTrinity: { body: 0, mind: 0, instinct: 0 },
            damageClass: 'physical',
            attackProfile: 'melee',
            trackingSignature: 'melee',
            scaling: [{ attribute: 'body', coefficient: 1 }],
            statusMultipliers: [],
            engagementContext: { distance: 1 },
            theoreticalMaxPower: 50
        });

        expect(result.attackProjection).toBe(50);
        expect(result.bodyScaledPower).toBe(50);
        expect(result.basePhysicalDamage).toBe(50);
        expect(result.scoreEvent.baseDamagePressure).toBe(50);
        expect(result.scoreEvent.attackProjection).toBe(50);
    });

    it('never returns negative final power', () => {
        const result = calculateCombat({
            attackerId: 'player',
            targetId: 'enemy_1',
            skillId: 'TEST',
            basePower: 0,
            trinity: { body: 0, mind: 0, instinct: 0 },
            scaling: [],
            statusMultipliers: [{ id: 'SHIELD', multiplier: -5 }]
        });

        expect(result.finalPower).toBe(0);
    });

    it('extracts trinity stats from actor stats component', () => {
        const actor: Actor = {
            id: 'player',
            type: 'player',
            position: { q: 0, r: 0, s: 0 },
            hp: 5,
            maxHp: 5,
            speed: 1,
            factionId: 'player',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [],
            components: new Map([
                ['stats', { type: 'stats', strength: 4, defense: 2, evasion: 1 }]
            ])
        };

        expect(extractTrinityStats(actor)).toEqual({ body: 4, mind: 2, instinct: 1 });
    });

    it('applies mind and instinct lever helpers deterministically', () => {
        const trinity = { body: 0, mind: 7, instinct: 4 };
        expect(computeStatusDuration(1, trinity)).toBe(1);
        expect(computeInitiativeBonus(trinity)).toBe(8);
        expect(computeCriticalMultiplier(trinity)).toBe(1.06);
        expect(computeSparkCost(5, trinity)).toBe(4.8);
        expect(GrandCalculator.resolveSparkCost(5, trinity)).toBe(4.8);
    });

    it('uses the same layered path for archer and fireball skills', () => {
        const archer = calculateCombat({
            attackerId: 'archer',
            targetId: 'enemy_1',
            skillId: 'ARCHER_SHOT',
            basePower: 0,
            trinity: { body: 0, mind: 0, instinct: 100 },
            targetTrinity: { body: 0, mind: 0, instinct: 0 },
            damageClass: 'physical',
            attackProfile: 'projectile',
            trackingSignature: 'projectile',
            engagementContext: { distance: 4 },
            scaling: [{ attribute: 'instinct', coefficient: 1 }],
            statusMultipliers: [],
            theoreticalMaxPower: 20
        });

        const fireball = calculateCombat({
            attackerId: 'mage',
            targetId: 'enemy_1',
            skillId: 'FIREBALL',
            basePower: 0,
            trinity: { body: 0, mind: 100, instinct: 0 },
            targetTrinity: { body: 0, mind: 0, instinct: 0 },
            damageClass: 'magical',
            attackProfile: 'spell',
            trackingSignature: 'magic',
            engagementContext: { distance: 4 },
            scaling: [{ attribute: 'mind', coefficient: 1 }],
            statusMultipliers: [],
            theoreticalMaxPower: 20
        });

        expect(resolveCombatTuning('ARCHER_SHOT').trinityLevers.instinctDamageMultiplierPerPoint).toBe(0.5);
        expect(resolveCombatTuning('FIREBALL').trinityLevers.mindDamageMultiplierPerPoint).toBe(0.5);
        expect(archer.attackProjection).toBe(50);
        expect(archer.bodyScaledPower).toBe(50);
        expect(fireball.attackProjection).toBe(50);
        expect(fireball.baseMagicalDamage).toBe(50);
    });
});
