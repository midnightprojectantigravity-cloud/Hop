import { describe, expect, it } from 'vitest';
import { computeSkillPowerProfile } from '../systems/evaluation/balance-skill-power';

describe('balance skill power', () => {
    it('scores FIREBALL as broader coverage than BASIC_ATTACK', () => {
        const fireball = computeSkillPowerProfile('FIREBALL');
        const basicAttack = computeSkillPowerProfile('BASIC_ATTACK');

        expect(fireball.areaCoverageScore).toBeGreaterThan(basicAttack.areaCoverageScore);
        expect(fireball.intrinsicPowerScore).toBeGreaterThan(0);
    });

    it('scores BASIC_MOVE as mobility-forward', () => {
        const move = computeSkillPowerProfile('BASIC_MOVE');

        expect(move.mobilityScore).toBeGreaterThan(0);
        expect(move.directDamageScore).toBe(0);
    });

    it('treats passive capability skills as always-on utility instead of turn-taxed actions', () => {
        const burrow = computeSkillPowerProfile('BURROW');
        const standardVision = computeSkillPowerProfile('STANDARD_VISION');
        const blindFighting = computeSkillPowerProfile('BLIND_FIGHTING');

        expect(burrow.economyTaxScore).toBe(0);
        expect(burrow.mobilityScore).toBeGreaterThan(0);
        expect(burrow.intrinsicPowerScore).toBeGreaterThan(0);

        expect(standardVision.economyTaxScore).toBe(0);
        expect(standardVision.controlScore).toBeGreaterThan(0);
        expect(standardVision.intrinsicPowerScore).toBeGreaterThan(0);

        expect(blindFighting.economyTaxScore).toBe(0);
        expect(blindFighting.defenseScore).toBeGreaterThan(0);
        expect(blindFighting.controlScore).toBeGreaterThan(0);
    });
});
