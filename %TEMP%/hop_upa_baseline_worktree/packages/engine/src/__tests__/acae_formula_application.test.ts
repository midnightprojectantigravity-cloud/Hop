import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { getAilmentDefinition } from '../data/ailments';
import { computeAilmentApplication, computeAilmentTriggerValue } from '../systems/ailments/application';
import { getAilmentBaseResistancePct, getAilmentSpecificResistancePct } from '../systems/ailments/hardening';

describe('ACAE formula application', () => {
    it('computes deterministic trigger and deposit with seeded RNG', () => {
        const stateA = generateInitialState(1, 'acae-formula-seed');
        const stateB = generateInitialState(1, 'acae-formula-seed');
        stateA.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };
        stateB.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };

        const source = stateA.player;
        const target = stateA.enemies[0];
        const burn = getAilmentDefinition('burn');
        expect(burn).toBeDefined();
        if (!burn) return;

        const input = {
            ailment: burn,
            source,
            target,
            skillMultiplier: 12,
            baseDeposit: burn.core.baseDeposit
        };

        const baseRes = getAilmentBaseResistancePct(target, 'burn');
        const specRes = getAilmentSpecificResistancePct(target, 'burn');
        const trigger = computeAilmentTriggerValue(input, baseRes, specRes);
        expect(trigger).toBeGreaterThanOrEqual(0);
        expect(trigger).toBeLessThanOrEqual(100);

        const r1 = computeAilmentApplication(stateA, input, baseRes, specRes);
        const r2 = computeAilmentApplication(stateB, input, baseRes, specRes);
        expect(r1.result).toEqual(r2.result);
        expect(r1.nextState.rngCounter).toBe((stateA.rngCounter || 0) + 1);
    });
});

