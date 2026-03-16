import { describe, expect, it } from 'vitest';
import type {
    BalanceBudgetViolation,
    BalanceStackBaselineArtifact,
    BalanceViolationAllowlistEntry
} from '../systems/evaluation/balance-schema';
import { buildBalanceStackGateReport } from '../../scripts/runBalanceStackGate';

const makeArtifact = (violations: BalanceBudgetViolation[]): BalanceStackBaselineArtifact => ({
    generatedAt: '2026-03-15T00:00:00.000Z',
    params: {
        runSeed: 'balance-stack',
        maxFloor: 6,
        trinityProfileId: 'live'
    },
    skillProfiles: [],
    loadoutProfiles: [],
    unitProfiles: [],
    enemyProfiles: [],
    floorProfiles: [],
    encounterProfiles: [],
    loadoutParityProfiles: [],
    enemyParityProfiles: [],
    budgetViolations: violations,
    allowlistedViolations: [],
    unallowlistedViolations: violations,
    violationSummary: {
        warnings: violations.filter(violation => violation.severity === 'warning').length,
        errors: violations.filter(violation => violation.severity === 'error').length,
        allowlistedWarnings: 0,
        allowlistedErrors: 0
    },
    summary: {
        skillCount: 0,
        loadoutCount: 0,
        unitCount: 0,
        enemyCount: 0,
        floorCount: 0,
        encounterCount: 0,
        hottestSkillId: null,
        strongestLoadoutId: null,
        strongestEnemySubtype: null,
        hardestFloor: null,
        hardestEncounterFloor: null,
        mostOverParityLoadoutId: null,
        mostOverParityEnemySubtype: null,
        loadoutMedianIntrinsicPower: 0,
        enemyMedianIntrinsicPower: 0,
        budgetViolationCount: violations.length,
        errorBudgetViolationCount: violations.filter(violation => violation.severity === 'error').length,
        allowlistedBudgetViolationCount: 0,
        unallowlistedBudgetViolationCount: violations.length
    }
});

const violation: BalanceBudgetViolation = {
    category: 'loadout_parity',
    severity: 'error',
    subjectId: 'SKIRMISHER',
    metric: 'relativeDeltaPct',
    expectedMax: 0.25,
    actual: 0.9,
    delta: 0.9,
    message: 'skirmisher drift'
};

const allowlistEntry: BalanceViolationAllowlistEntry = {
    id: 'skirmisher-parity',
    category: 'loadout_parity',
    subjectId: 'SKIRMISHER',
    metric: 'relativeDeltaPct',
    reason: 'temporary accepted outlier',
    expiresOn: '2026-06-30'
};

describe('balance stack gate', () => {
    it('passes unchanged allowlisted errors relative to baseline', () => {
        const baseline = makeArtifact([violation]);
        const candidate = makeArtifact([violation]);
        const report = buildBalanceStackGateReport(baseline, candidate, [allowlistEntry], '2026-03-15');

        expect(report.passed).toBe(true);
        expect(report.unallowlistedErrorViolations).toEqual([]);
        expect(report.newErrorViolations).toEqual([]);
    });

    it('fails expired allowlist entries', () => {
        const baseline = makeArtifact([violation]);
        const candidate = makeArtifact([violation]);
        const report = buildBalanceStackGateReport(baseline, candidate, [{ ...allowlistEntry, expiresOn: '2026-03-01' }], '2026-03-15');

        expect(report.passed).toBe(false);
        expect(report.expiredAllowlistEntries).toHaveLength(1);
    });

    it('fails new error-class violations relative to baseline', () => {
        const baseline = makeArtifact([]);
        const candidate = makeArtifact([violation]);
        const report = buildBalanceStackGateReport(baseline, candidate, [allowlistEntry], '2026-03-15');

        expect(report.passed).toBe(false);
        expect(report.newErrorViolations).toHaveLength(1);
    });
});
