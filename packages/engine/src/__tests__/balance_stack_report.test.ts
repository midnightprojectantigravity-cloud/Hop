import { describe, expect, it } from 'vitest';
import { buildBalanceStackReport } from '../systems/evaluation/balance-stack';
import { DEFAULT_LOADOUTS } from '../systems/loadout';

describe('balance stack report', () => {
    it('builds a deterministic first-slice report', () => {
        const report = buildBalanceStackReport({
            runSeed: 'balance-stack-report-test',
            maxFloor: 2
        });

        expect(report.summary.skillCount).toBeGreaterThan(0);
        expect(report.summary.loadoutCount).toBe(Object.keys(DEFAULT_LOADOUTS).length);
        expect(report.summary.unitCount).toBe(Object.keys(DEFAULT_LOADOUTS).length);
        expect(report.summary.enemyCount).toBeGreaterThan(0);
        expect(report.summary.floorCount).toBe(2);
        expect(report.summary.encounterCount).toBe(2);
        expect(report.summary.hottestSkillId).not.toBeNull();
        expect(report.summary.strongestLoadoutId).not.toBeNull();
        expect(report.summary.strongestEnemySubtype).not.toBeNull();
        expect(report.floorProfiles[0]?.floor).toBe(1);
        expect(report.encounterProfiles[0]?.floor).toBe(1);
        expect(report.loadoutParityProfiles).toHaveLength(Object.keys(DEFAULT_LOADOUTS).length);
        expect(report.summary.budgetViolationCount).toBe(report.budgetViolations.length);
        expect(report.summary.allowlistedBudgetViolationCount).toBe(report.allowlistedViolations.length);
        expect(report.summary.unallowlistedBudgetViolationCount).toBe(report.unallowlistedViolations.length);
        expect(report.violationSummary.errors).toBe(report.budgetViolations.filter(violation => violation.severity === 'error').length);
    });
});
