import { describe, expect, it } from 'vitest';
import { computeAllEnemyPowerProfiles, computeEnemyPowerProfile } from '../systems/evaluation/balance-enemy-power';

describe('balance enemy power', () => {
    it('scores sentinel above footman', () => {
        const sentinel = computeEnemyPowerProfile('sentinel');
        const footman = computeEnemyPowerProfile('footman');

        expect(sentinel.intrinsicPowerScore).toBeGreaterThan(footman.intrinsicPowerScore);
        expect(sentinel.threatProjectionScore).toBeGreaterThan(footman.threatProjectionScore);
        expect(sentinel.combatRole).toBe('boss_anchor');
    });

    it('builds the full enemy roster profile list', () => {
        const profiles = computeAllEnemyPowerProfiles();
        expect(profiles.length).toBeGreaterThan(0);
    });

    it('accounts for bomber spawned-hazard pressure in roster scoring', () => {
        const bomber = computeEnemyPowerProfile('bomber');
        const archer = computeEnemyPowerProfile('archer');

        expect(bomber.spawnedHazardPressureScore).toBeGreaterThan(0);
        expect(bomber.zoneDenialScore).toBeGreaterThan(archer.zoneDenialScore);
    });
});
