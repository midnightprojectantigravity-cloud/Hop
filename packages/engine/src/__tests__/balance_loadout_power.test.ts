import { describe, expect, it } from 'vitest';
import { computeAllLoadoutPowerProfiles, computeLoadoutPowerProfile } from '../systems/evaluation/balance-loadout-power';
import { computeSkillPowerProfileMap } from '../systems/evaluation/balance-skill-power';

describe('balance loadout power', () => {
    it('gives FIREMAGE more offense and control pressure than VANGUARD', () => {
        const skillProfilesById = computeSkillPowerProfileMap();
        const firemage = computeLoadoutPowerProfile('FIREMAGE', skillProfilesById);
        const vanguard = computeLoadoutPowerProfile('VANGUARD', skillProfilesById);

        expect(firemage.offenseScore).toBeGreaterThan(vanguard.offenseScore);
        expect(firemage.controlScore).toBeGreaterThan(vanguard.controlScore);
        expect(firemage.hazardHandlingScore).toBeGreaterThan(vanguard.hazardHandlingScore);
    });

    it('builds deterministic profiles for the default roster', () => {
        const profiles = computeAllLoadoutPowerProfiles();

        expect(profiles).toHaveLength(6);
        expect(profiles.every(profile => Number.isFinite(profile.intrinsicPowerScore))).toBe(true);
    });

    it('applies a conversion penalty to setup-heavy loadouts without a basic attack', () => {
        const skillProfilesById = computeSkillPowerProfileMap();
        const skirmisher = computeLoadoutPowerProfile('SKIRMISHER', skillProfilesById);
        const firemage = computeLoadoutPowerProfile('FIREMAGE', skillProfilesById);

        expect(skirmisher.rationale.some(entry => entry.includes('conversion penalty'))).toBe(true);
        expect(firemage.rationale.some(entry => entry.includes('conversion penalty'))).toBe(false);
        expect(firemage.rationale.some(entry => entry.includes('specialization penalty'))).toBe(true);
    });

    it('lets passive mobility and sensing packages contribute to loadout pressure without fake action tax', () => {
        const skillProfilesById = computeSkillPowerProfileMap();
        const vanguard = computeLoadoutPowerProfile('VANGUARD', skillProfilesById);
        const hunter = computeLoadoutPowerProfile('HUNTER', skillProfilesById);

        expect(vanguard.mobilityScore).toBeGreaterThan(0);
        expect(vanguard.controlScore).toBeGreaterThan(0);
        expect(vanguard.mobilityScore).toBeGreaterThan(hunter.mobilityScore);
        expect(vanguard.controlScore).toBeGreaterThan(hunter.controlScore / 2);
    });
});
