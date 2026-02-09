import { describe, expect, it } from 'vitest';
import { calculateCombat } from '../systems/combat-calculator';

describe('triangle emergence (formula-driven)', () => {
    it('Body pressure outperforms Instinct-heavy target in physical exchanges', () => {
        const bodyIntoInstinct = calculateCombat({
            attackerId: 'a-body',
            targetId: 'd-instinct',
            skillId: 'TEST_PHYS',
            basePower: 10,
            trinity: { body: 10, instinct: 2, mind: 1 },
            targetTrinity: { body: 2, instinct: 10, mind: 1 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.25 }],
            statusMultipliers: []
        });

        const instinctIntoBody = calculateCombat({
            attackerId: 'a-instinct',
            targetId: 'd-body',
            skillId: 'TEST_PHYS',
            basePower: 10,
            trinity: { body: 2, instinct: 10, mind: 1 },
            targetTrinity: { body: 10, instinct: 2, mind: 1 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'instinct', coefficient: 0.25 }],
            statusMultipliers: []
        });

        expect(bodyIntoInstinct.finalPower).toBeGreaterThan(instinctIntoBody.finalPower);
    });

    it('Instinct pressure outperforms Mind-heavy target in physical engagement', () => {
        const instinctIntoMind = calculateCombat({
            attackerId: 'a-instinct',
            targetId: 'd-mind',
            skillId: 'TEST_PHYS',
            basePower: 8,
            trinity: { body: 4, instinct: 12, mind: 1 },
            targetTrinity: { body: 1, instinct: 1, mind: 12 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'instinct', coefficient: 0.2 }],
            statusMultipliers: []
        });

        const mindIntoInstinct = calculateCombat({
            attackerId: 'a-mind',
            targetId: 'd-instinct',
            skillId: 'TEST_MAG',
            basePower: 8,
            trinity: { body: 1, instinct: 2, mind: 10 },
            targetTrinity: { body: 4, instinct: 12, mind: 1 },
            damageClass: 'magical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'mind', coefficient: 0.2 }],
            statusMultipliers: []
        });

        expect(instinctIntoMind.finalPower).toBeGreaterThan(mindIntoInstinct.finalPower);
    });

    it('Mind pressure outperforms Body-heavy target in magical exchanges', () => {
        const mindIntoBody = calculateCombat({
            attackerId: 'a-mind',
            targetId: 'd-body',
            skillId: 'TEST_MAG',
            basePower: 10,
            trinity: { body: 1, instinct: 2, mind: 12 },
            targetTrinity: { body: 8, instinct: 2, mind: 1 },
            damageClass: 'magical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'mind', coefficient: 0.25 }],
            statusMultipliers: []
        });

        const bodyIntoMind = calculateCombat({
            attackerId: 'a-body',
            targetId: 'd-mind',
            skillId: 'TEST_PHYS',
            basePower: 10,
            trinity: { body: 8, instinct: 2, mind: 1 },
            targetTrinity: { body: 1, instinct: 2, mind: 12 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.25 }],
            statusMultipliers: []
        });

        expect(mindIntoBody.finalPower).toBeGreaterThan(bodyIntoMind.finalPower);
    });

    it('mixed-stat mirror matchup is near-neutral and emits pressure telemetry', () => {
        const left = calculateCombat({
            attackerId: 'left',
            targetId: 'right',
            skillId: 'TEST_MIX',
            basePower: 9,
            trinity: { body: 5, instinct: 5, mind: 5 },
            targetTrinity: { body: 5, instinct: 5, mind: 5 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.2 }, { attribute: 'instinct', coefficient: 0.1 }],
            statusMultipliers: []
        });
        const right = calculateCombat({
            attackerId: 'right',
            targetId: 'left',
            skillId: 'TEST_MIX',
            basePower: 9,
            trinity: { body: 5, instinct: 5, mind: 5 },
            targetTrinity: { body: 5, instinct: 5, mind: 5 },
            damageClass: 'physical',
            interactionModel: 'triangle',
            scaling: [{ attribute: 'body', coefficient: 0.2 }, { attribute: 'instinct', coefficient: 0.1 }],
            statusMultipliers: []
        });

        expect(Math.abs(left.finalPower - right.finalPower)).toBeLessThanOrEqual(1);
        expect(typeof left.scoreEvent.hitPressure).toBe('number');
        expect(typeof left.scoreEvent.mitigationPressure).toBe('number');
        expect(typeof left.scoreEvent.critPressure).toBe('number');
        expect(typeof left.scoreEvent.resistancePressure).toBe('number');
    });
});
