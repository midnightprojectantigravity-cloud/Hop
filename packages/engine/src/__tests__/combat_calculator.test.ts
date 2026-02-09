import { describe, expect, it } from 'vitest';
import {
    calculateCombat,
    extractTrinityStats,
    computeStatusDuration,
    computeInitiativeBonus,
    computeCriticalMultiplier,
    computeSparkCost,
    GrandCalculator
} from '../systems/combat-calculator';
import type { Actor } from '../types';

describe('combat-calculator', () => {
    it('applies base, scaling, status, and risk stack deterministically', () => {
        const result = calculateCombat({
            attackerId: 'player',
            targetId: 'enemy_1',
            skillId: 'FIREBALL',
            basePower: 10,
            trinity: { body: 2, mind: 3, instinct: 1 },
            scaling: [
                { attribute: 'body', coefficient: 1 },
                { attribute: 'mind', coefficient: 0.5 }
            ],
            statusMultipliers: [
                { id: 'BURNING', multiplier: 1.2 },
                { id: 'WEAKENED', multiplier: 0.9 }
            ],
            inDangerPreviewHex: true,
            proximityDistance: 1,
            theoreticalMaxPower: 25
        });

        expect(result.bodyScaledPower).toBe(11);
        expect(result.finalPower).toBe(19);
        expect(result.statusMultiplier).toBe(1.08);
        expect(result.riskMultiplier).toBe(1.25);
        expect(result.criticalMultiplier).toBe(1.02);
        expect(result.scoreEvent.efficiency).toBe(0.76);
        expect(result.scoreEvent.riskBonusApplied).toBe(true);
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
        expect(computeCriticalMultiplier(trinity)).toBe(1.08);
        expect(computeSparkCost(5, trinity)).toBe(4.8);
        expect(GrandCalculator.resolveSparkCost(5, trinity)).toBe(4.8);
    });
});
