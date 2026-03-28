import { describe, expect, it } from 'vitest';
import { computeAllSkillPowerProfiles } from '../systems/evaluation/balance-skill-power';
import { buildIresSkillBandAuditReport } from '../systems/evaluation/ires-skill-band-audit';

describe('IRES skill band audit', () => {
    it('reports the expected mapped and fallback coverage', () => {
        const report = buildIresSkillBandAuditReport();

        expect(report.mappedSkillIds).toHaveLength(49);
        expect(report.expandedMappedSkillIds).toHaveLength(22);
        expect(report.mappedActiveRosterSkillIds).toHaveLength(27);
        expect(report.legacyFallbackSkillIds).toHaveLength(0);
        expect(report.acceptedRiskSkillIds).toEqual(['BASIC_MOVE', 'GRAPPLE_HOOK']);
        expect(report.rows).toHaveLength(50);
    });

    it('marks SENTINEL_BLAST as the highest-strain derived active-roster skill', () => {
        const report = buildIresSkillBandAuditReport();
        const derivedRows = report.rows.filter((row) => row.profileSource === 'band_derived');
        const highestStrain = [...derivedRows].sort((left, right) =>
            right.derivedProfile.baseStrain - left.derivedProfile.baseStrain
            || right.derivedProfile.primaryCost - left.derivedProfile.primaryCost
            || left.skillId.localeCompare(right.skillId)
        )[0];

        expect(highestStrain?.skillId).toBe('SENTINEL_BLAST');
        expect(highestStrain?.metabolicBandId).toBe('redline');
    });

    it('keeps balance skill power evaluation hydrated across all 50 skills after cutover', () => {
        const profiles = computeAllSkillPowerProfiles();

        expect(profiles).toHaveLength(50);
    });

    it('reports intrinsic power deltas for the newly expanded mappings', () => {
        const report = buildIresSkillBandAuditReport();
        const burrow = report.rows.find((row) => row.skillId === 'BURROW');
        const phaseStep = report.rows.find((row) => row.skillId === 'PHASE_STEP');
        const falconScout = report.rows.find((row) => row.skillId === 'FALCON_SCOUT');

        expect(burrow?.scope).toBe('loadout_capability');
        expect(burrow?.legacyIntrinsicPowerScore).toBeDefined();
        expect(burrow?.derivedIntrinsicPowerScore).toBeDefined();
        expect(phaseStep?.deltaIntrinsicPowerScore).not.toBe(0);
        expect(falconScout?.scope).toBe('companion_runtime');
        expect(falconScout?.countsAsMovement).toBe(true);
        expect(falconScout?.countsAsAction).toBe(false);
        expect(falconScout?.legacyIntrinsicPowerScore).toBeDefined();
        expect(falconScout?.derivedIntrinsicPowerScore).toBeDefined();
    });

    it('marks the remaining medium-risk locomotion migrations as intentionally accepted', () => {
        const report = buildIresSkillBandAuditReport();
        const acceptedRows = report.rows.filter((row) => row.acceptedRisk);

        expect(acceptedRows.map((row) => row.skillId)).toEqual(['BASIC_MOVE', 'GRAPPLE_HOOK']);
        expect(acceptedRows.every((row) => row.riskLevel === 'medium')).toBe(true);
        expect(acceptedRows.every((row) => row.notes.includes('Accepted medium-risk migration for this phase.'))).toBe(true);
    });
});
