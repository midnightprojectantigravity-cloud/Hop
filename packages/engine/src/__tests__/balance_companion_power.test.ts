import { describe, expect, it } from 'vitest';
import { computeAllCompanionPowerProfiles, computeCompanionPowerProfile } from '../systems/evaluation/balance-companion-power';

describe('balance companion power', () => {
    it('scores falcon as more metabolically capable than skeleton without treating it as a full enemy anchor', () => {
        const falcon = computeCompanionPowerProfile('falcon');
        const skeleton = computeCompanionPowerProfile('skeleton');

        expect(falcon.intrinsicPowerScore).toBeGreaterThan(0);
        expect(skeleton.intrinsicPowerScore).toBeGreaterThan(0);
        expect(falcon.actionEconomyScore).toBeGreaterThan(skeleton.actionEconomyScore);
        expect(falcon.evaluationExcludedFromEnemyBudget).toBe(true);
        expect(skeleton.evaluationExcludedFromEnemyBudget).toBe(true);
    });

    it('builds the full companion profile list', () => {
        const profiles = computeAllCompanionPowerProfiles();
        expect(profiles.map(profile => profile.subtype).sort()).toEqual(['falcon', 'skeleton']);
    });
});
