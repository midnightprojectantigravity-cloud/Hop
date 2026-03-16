import { describe, expect, it } from 'vitest';
import {
    BALANCE_BUDGET_THRESHOLDS,
    resolveEnemyTypeBudgetModifier
} from '../systems/evaluation/balance-budget-config';

describe('balance budget config', () => {
    it('locks the configured parity thresholds', () => {
        expect(BALANCE_BUDGET_THRESHOLDS.loadoutParity.targetPct).toBe(0.15);
        expect(BALANCE_BUDGET_THRESHOLDS.loadoutParity.errorPct).toBe(0.25);
        expect(BALANCE_BUDGET_THRESHOLDS.enemyParity.targetPct).toBe(0.15);
        expect(BALANCE_BUDGET_THRESHOLDS.enemyParity.errorPct).toBe(0.25);
        expect(BALANCE_BUDGET_THRESHOLDS.bossParityExempt).toBe(true);
    });

    it('keeps role budgets deterministic', () => {
        expect(BALANCE_BUDGET_THRESHOLDS.enemyFloorBudgets.onboarding.base).toBe(10);
        expect(BALANCE_BUDGET_THRESHOLDS.encounterBudgets.boss.fixed).toBe(90);
        expect(resolveEnemyTypeBudgetModifier('ranged', BALANCE_BUDGET_THRESHOLDS.enemyFloorBudgets.recovery)).toBe(1);
    });
});
