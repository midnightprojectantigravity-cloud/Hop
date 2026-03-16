import { describe, expect, it } from 'vitest';
import { computeAllPlayerUnitPowerProfiles, computeUnitPowerProfile } from '../systems/evaluation/balance-unit-power';
import { computeSkillPowerProfileMap } from '../systems/evaluation/balance-skill-power';

describe('balance unit power', () => {
    it('scores a heavier higher-hp shell above a lighter weaker shell', () => {
        const skillProfiles = computeSkillPowerProfileMap();
        const heavy = computeUnitPowerProfile({
            unitId: 'heavy',
            unitKind: 'enemy',
            skillIds: ['BASIC_ATTACK'],
            trinity: { body: 6, mind: 0, instinct: 1 },
            hp: 10,
            maxHp: 10,
            speed: 1,
            weightClass: 'Heavy',
            baseDamage: 2,
            baseRange: 1,
            actionCooldown: 2
        }, skillProfiles);
        const light = computeUnitPowerProfile({
            unitId: 'light',
            unitKind: 'enemy',
            skillIds: ['BASIC_ATTACK'],
            trinity: { body: 1, mind: 0, instinct: 1 },
            hp: 3,
            maxHp: 3,
            speed: 1,
            weightClass: 'Light',
            baseDamage: 1,
            baseRange: 1,
            actionCooldown: 2
        }, skillProfiles);

        expect(heavy.intrinsicPowerScore).toBeGreaterThan(light.intrinsicPowerScore);
    });

    it('builds one player-unit profile per default loadout', () => {
        const profiles = computeAllPlayerUnitPowerProfiles();
        expect(profiles).toHaveLength(6);
    });
});
