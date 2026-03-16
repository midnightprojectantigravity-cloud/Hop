import { describe, expect, it } from 'vitest';
import { computeAllEnemyPowerProfiles } from '../systems/evaluation/balance-enemy-power';
import { computeAllLoadoutPowerProfiles } from '../systems/evaluation/balance-loadout-power';
import { computeEnemyParityProfiles, computeLoadoutParityProfiles } from '../systems/evaluation/balance-parity';

describe('balance parity', () => {
    it('builds loadout parity rows against the roster median', () => {
        const profiles = computeLoadoutParityProfiles(computeAllLoadoutPowerProfiles());
        expect(profiles).toHaveLength(6);
        expect(profiles.some(profile => profile.parityBand !== 'balanced')).toBe(true);
    });

    it('builds enemy parity rows against the roster median', () => {
        const profiles = computeEnemyParityProfiles(computeAllEnemyPowerProfiles());
        expect(profiles.length).toBeGreaterThan(0);
        expect(profiles.some(profile => profile.parityBand !== 'balanced')).toBe(true);
    });
});
