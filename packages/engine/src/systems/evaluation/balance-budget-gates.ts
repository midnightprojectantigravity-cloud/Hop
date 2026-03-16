import type {
    BalanceBudgetViolation,
    BalanceViolationAllowlistEntry,
    EnemyPowerProfile,
    EnemyRosterParityProfile,
    EncounterDifficultyProfile,
    LoadoutRosterParityProfile
} from './balance-schema';
import { BALANCE_BUDGET_THRESHOLDS, resolveEnemyTypeBudgetModifier } from './balance-budget-config';

const round2 = (value: number): number => Number(value.toFixed(2));

export const resolveEnemyFloorPowerBudget = (
    floor: number,
    role: EncounterDifficultyProfile['role'],
    enemyType: EnemyPowerProfile['enemyType']
): number => {
    const rule = BALANCE_BUDGET_THRESHOLDS.enemyFloorBudgets[role];
    if (typeof rule.fixed === 'number') return round2(rule.fixed);
    return round2(
        (rule.base || 0)
        + (floor * (rule.perFloor || 0))
        + resolveEnemyTypeBudgetModifier(enemyType, rule)
    );
};

export const resolveEncounterDifficultyBudget = (
    floor: number,
    role: EncounterDifficultyProfile['role']
): number => {
    const rule = BALANCE_BUDGET_THRESHOLDS.encounterBudgets[role];
    if (typeof rule.fixed === 'number') return round2(rule.fixed);
    return round2((rule.base || 0) + (floor * (rule.perFloor || 0)));
};

const pushParityViolation = (
    violations: BalanceBudgetViolation[],
    category: 'loadout_parity' | 'enemy_parity',
    subjectId: string,
    relativeDeltaPct: number
): void => {
    const thresholds = category === 'loadout_parity'
        ? BALANCE_BUDGET_THRESHOLDS.loadoutParity
        : BALANCE_BUDGET_THRESHOLDS.enemyParity;
    const magnitude = Math.abs(relativeDeltaPct);
    if (magnitude <= thresholds.targetPct) return;
    const severity = magnitude > thresholds.errorPct ? 'error' : 'warning';
    const direction = relativeDeltaPct > 0 ? 'over' : 'under';
    violations.push({
        category,
        severity,
        subjectId,
        metric: 'relativeDeltaPct',
        expectedMax: round2(severity === 'error' ? thresholds.errorPct : thresholds.targetPct),
        actual: round2(magnitude),
        delta: round2(relativeDeltaPct),
        message: `${subjectId} is ${direction} roster parity by ${round2(magnitude * 100)}%`
    });
};

const resolveBudgetSeverity = (actual: number, budget: number): BalanceBudgetViolation['severity'] =>
    actual > budget * (1 + BALANCE_BUDGET_THRESHOLDS.errorOverBudgetPct) ? 'error' : 'warning';

const normalizeDate = (value?: string): string | null => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString().slice(0, 10);
};

export const isAllowlistEntryExpired = (
    entry: BalanceViolationAllowlistEntry,
    asOfDate: string = new Date().toISOString().slice(0, 10)
): boolean => {
    const expiresOn = normalizeDate(entry.expiresOn);
    const current = normalizeDate(asOfDate);
    if (!expiresOn || !current) return false;
    return expiresOn < current;
};

export const matchesBalanceViolationAllowlistEntry = (
    violation: BalanceBudgetViolation,
    entry: BalanceViolationAllowlistEntry,
    asOfDate: string = new Date().toISOString().slice(0, 10)
): boolean => {
    if (isAllowlistEntryExpired(entry, asOfDate)) return false;
    return entry.category === violation.category
        && entry.subjectId === violation.subjectId
        && entry.metric === violation.metric
        && (entry.floor === undefined || entry.floor === violation.floor)
        && (entry.role === undefined || entry.role === violation.role);
};

export const classifyBalanceViolations = (
    violations: BalanceBudgetViolation[],
    allowlistEntries: BalanceViolationAllowlistEntry[] = [],
    asOfDate: string = new Date().toISOString().slice(0, 10)
): {
    allowlistedViolations: BalanceBudgetViolation[];
    unallowlistedViolations: BalanceBudgetViolation[];
} => {
    const allowlistedViolations: BalanceBudgetViolation[] = [];
    const unallowlistedViolations: BalanceBudgetViolation[] = [];

    for (const violation of violations) {
        const matched = allowlistEntries.some(entry => matchesBalanceViolationAllowlistEntry(violation, entry, asOfDate));
        if (matched) {
            allowlistedViolations.push(violation);
        } else {
            unallowlistedViolations.push(violation);
        }
    }

    return { allowlistedViolations, unallowlistedViolations };
};

export interface BalanceBudgetGateInput {
    enemyProfiles: EnemyPowerProfile[];
    encounterProfiles: EncounterDifficultyProfile[];
    loadoutParityProfiles: LoadoutRosterParityProfile[];
    enemyParityProfiles: EnemyRosterParityProfile[];
}

export const buildBalanceBudgetViolations = (
    input: BalanceBudgetGateInput
): BalanceBudgetViolation[] => {
    const enemyProfilesBySubtype = Object.fromEntries(
        input.enemyProfiles.map(profile => [profile.subtype, profile])
    ) as Record<string, EnemyPowerProfile>;
    const violations: BalanceBudgetViolation[] = [];

    for (const encounter of input.encounterProfiles) {
        const encounterBudget = resolveEncounterDifficultyBudget(encounter.floor, encounter.role);
        if (encounter.intrinsicDifficultyScore > encounterBudget) {
            violations.push({
                category: 'encounter_floor_budget',
                severity: resolveBudgetSeverity(encounter.intrinsicDifficultyScore, encounterBudget),
                subjectId: `floor_${encounter.floor}`,
                floor: encounter.floor,
                role: encounter.role,
                metric: 'intrinsicDifficultyScore',
                expectedMax: encounterBudget,
                actual: encounter.intrinsicDifficultyScore,
                delta: round2(encounter.intrinsicDifficultyScore - encounterBudget),
                message: `Encounter floor ${encounter.floor} exceeds ${encounter.role} difficulty budget`
            });
        }

        for (const subtype of new Set(encounter.enemySubtypeIds)) {
            const enemy = enemyProfilesBySubtype[subtype];
            if (!enemy) continue;
            const enemyBudget = resolveEnemyFloorPowerBudget(encounter.floor, encounter.role, enemy.enemyType);
            if (enemy.intrinsicPowerScore <= enemyBudget) continue;
            violations.push({
                category: 'enemy_floor_budget',
                severity: resolveBudgetSeverity(enemy.intrinsicPowerScore, enemyBudget),
                subjectId: subtype,
                floor: encounter.floor,
                role: encounter.role,
                metric: 'intrinsicPowerScore',
                expectedMax: enemyBudget,
                actual: enemy.intrinsicPowerScore,
                delta: round2(enemy.intrinsicPowerScore - enemyBudget),
                message: `${subtype} exceeds ${encounter.role} enemy budget on floor ${encounter.floor}`
            });
        }
    }

    for (const profile of input.loadoutParityProfiles) {
        pushParityViolation(
            violations,
            'loadout_parity',
            profile.loadoutId,
            profile.relativeDeltaPct
        );
    }

    for (const profile of input.enemyParityProfiles) {
        const enemy = enemyProfilesBySubtype[profile.subtype];
        if (enemy && BALANCE_BUDGET_THRESHOLDS.bossParityExempt && enemy.enemyType === 'boss') {
            continue;
        }
        pushParityViolation(
            violations,
            'enemy_parity',
            profile.subtype,
            profile.relativeDeltaPct
        );
    }

    return violations.sort((left, right) =>
        (left.severity === right.severity ? 0 : left.severity === 'error' ? -1 : 1)
        || (left.floor || 0) - (right.floor || 0)
        || left.category.localeCompare(right.category)
        || left.subjectId.localeCompare(right.subjectId)
    );
};
