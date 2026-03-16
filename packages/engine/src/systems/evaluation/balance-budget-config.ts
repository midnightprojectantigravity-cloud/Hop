import type { CurrentFloorSummary } from '../../generation/schema';
import type { EnemyPowerProfile } from './balance-schema';

export interface ParityThresholds {
    targetPct: number;
    errorPct: number;
}

export interface EnemyFloorBudgetRule {
    base?: number;
    perFloor?: number;
    rangedModifier: number;
    bossModifier: number;
    fixed?: number;
}

export interface EncounterBudgetRule {
    base?: number;
    perFloor?: number;
    fixed?: number;
}

export interface BalanceBudgetThresholds {
    loadoutParity: ParityThresholds;
    enemyParity: ParityThresholds;
    warningOverBudgetPct: number;
    errorOverBudgetPct: number;
    bossParityExempt: boolean;
    enemyFloorBudgets: Record<CurrentFloorSummary['role'], EnemyFloorBudgetRule>;
    encounterBudgets: Record<CurrentFloorSummary['role'], EncounterBudgetRule>;
}

export const BALANCE_BUDGET_THRESHOLDS: BalanceBudgetThresholds = {
    loadoutParity: {
        targetPct: 0.15,
        errorPct: 0.25
    },
    enemyParity: {
        targetPct: 0.15,
        errorPct: 0.25
    },
    warningOverBudgetPct: 0,
    errorOverBudgetPct: 0.1,
    bossParityExempt: true,
    enemyFloorBudgets: {
        onboarding: { base: 10, perFloor: 2, rangedModifier: 1, bossModifier: 6 },
        recovery: { base: 12, perFloor: 2.5, rangedModifier: 1, bossModifier: 6 },
        pressure_spike: { base: 15, perFloor: 2.2, rangedModifier: 1, bossModifier: 6 },
        elite: { base: 20, perFloor: 2.5, rangedModifier: 1, bossModifier: 6 },
        boss: { fixed: 80, rangedModifier: 1, bossModifier: 6 }
    },
    encounterBudgets: {
        onboarding: { base: 14, perFloor: 2 },
        recovery: { base: 20, perFloor: 4.5 },
        pressure_spike: { base: 32, perFloor: 5.6 },
        elite: { base: 28, perFloor: 5 },
        boss: { fixed: 90 }
    }
};

export const resolveEnemyTypeBudgetModifier = (
    enemyType: EnemyPowerProfile['enemyType'],
    rule: EnemyFloorBudgetRule
): number => enemyType === 'boss' ? rule.bossModifier : enemyType === 'ranged' ? rule.rangedModifier : 0;
