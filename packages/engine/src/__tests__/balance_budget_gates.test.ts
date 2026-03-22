import { describe, expect, it } from 'vitest';
import type {
    EnemyPowerProfile,
    EnemyRosterParityProfile,
    EncounterDifficultyProfile,
    LoadoutRosterParityProfile
} from '../systems/evaluation/balance-schema';
import {
    buildBalanceBudgetViolations,
    classifyBalanceViolations,
    resolveEncounterDifficultyBudget,
    resolveEnemyFloorPowerBudget
} from '../systems/evaluation/balance-budget-gates';

const enemy = (overrides?: Partial<EnemyPowerProfile>): EnemyPowerProfile => ({
    unitId: 'sentinel',
    unitKind: 'enemy',
    subtype: 'sentinel',
    enemyType: 'boss',
    budgetCost: 25,
    skillIds: ['SENTINEL_BLAST'],
    trinity: { body: 4, mind: 2, instinct: 2 },
    hp: 30,
    maxHp: 30,
    speed: 1,
    weightClass: 'Heavy',
    chassisDurabilityScore: 20,
    actionEconomyScore: 5,
    offenseScore: 30,
    controlScore: 10,
    mobilityScore: 1,
    sustainScore: 5,
    threatProjectionScore: 20,
    spikePressureScore: 20,
    zoneDenialScore: 10,
    reliabilityScore: 4,
    intrinsicPowerScore: 62,
    powerBand: 'spike',
    rationale: [],
    ...overrides
});

const encounter = (overrides?: Partial<EncounterDifficultyProfile>): EncounterDifficultyProfile => ({
    floor: 1,
    role: 'onboarding',
    theme: 'inferno',
    enemyCount: 1,
    uniqueEnemySubtypeCount: 1,
    enemySubtypeIds: ['sentinel'],
    frontlineCount: 1,
    rangedCount: 1,
    hazardSetterCount: 0,
    flankerCount: 0,
    supportCount: 0,
    bossAnchorCount: 1,
    encounterEnemyPowerScore: 62,
    spawnPressureScore: 26,
    routePressureScore: 4,
    objectiveTensionScore: 3,
    intrinsicDifficultyScore: 18,
    difficultyBand: 'high',
    rationale: [],
    ...overrides
});

describe('balance budget gates', () => {
    it('flags an over-budget sentinel on an onboarding floor without boss parity drift', () => {
        const violations = buildBalanceBudgetViolations({
            enemyProfiles: [enemy()],
            encounterProfiles: [encounter(), encounter({ role: 'boss', floor: 6 })],
            loadoutParityProfiles: [],
            enemyParityProfiles: [{
                subtype: 'sentinel',
                intrinsicPowerScore: 62,
                deltaFromMedian: 40,
                relativeDeltaPct: 3.11,
                parityBand: 'outlier_over'
            }]
        });

        expect(resolveEnemyFloorPowerBudget(1, 'onboarding', 'boss')).toBeLessThan(62);
        expect(violations.some(violation =>
            violation.category === 'enemy_floor_budget'
            && violation.subjectId === 'sentinel'
            && violation.floor === 1
        )).toBe(true);
        expect(violations.some(violation => violation.category === 'enemy_parity' && violation.subjectId === 'sentinel')).toBe(false);
    });

    it('flags parity drift beyond the configured threshold', () => {
        const loadoutParity: LoadoutRosterParityProfile = {
            loadoutId: 'SKIRMISHER',
            intrinsicPowerScore: 27.5,
            deltaFromMedian: 10,
            relativeDeltaPct: 0.7,
            parityBand: 'outlier_over'
        };
        const enemyParity: EnemyRosterParityProfile = {
            subtype: 'footman',
            intrinsicPowerScore: 10,
            deltaFromMedian: -4,
            relativeDeltaPct: -0.27,
            parityBand: 'outlier_under'
        };

        const violations = buildBalanceBudgetViolations({
            enemyProfiles: [],
            encounterProfiles: [],
            loadoutParityProfiles: [loadoutParity],
            enemyParityProfiles: [enemyParity]
        });

        expect(violations.some(violation => violation.category === 'loadout_parity' && violation.subjectId === 'SKIRMISHER')).toBe(true);
        expect(violations.some(violation => violation.category === 'enemy_parity' && violation.subjectId === 'footman')).toBe(true);
    });

    it('exposes deterministic encounter budgets by floor role', () => {
        expect(resolveEncounterDifficultyBudget(1, 'onboarding')).toBeLessThan(resolveEncounterDifficultyBudget(4, 'pressure_spike'));
        expect(resolveEncounterDifficultyBudget(5, 'elite')).toBeLessThan(resolveEncounterDifficultyBudget(6, 'boss'));
    });

    it('classifies exact-match allowlist entries and ignores expired ones', () => {
        const violation = {
            category: 'loadout_parity',
            severity: 'error',
            subjectId: 'FIREMAGE',
            metric: 'relativeDeltaPct',
            actual: 0.7,
            expectedMax: 0.25,
            delta: 0.7,
            message: 'firemage drift'
        } as const;

        const matched = classifyBalanceViolations(
            [violation],
            [{
                id: 'firemage-parity',
                category: 'loadout_parity',
                subjectId: 'FIREMAGE',
                metric: 'relativeDeltaPct',
                reason: 'accepted temporary outlier',
                expiresOn: '2026-06-30'
            }],
            '2026-03-15'
        );
        const expired = classifyBalanceViolations(
            [violation],
            [{
                id: 'firemage-parity-expired',
                category: 'loadout_parity',
                subjectId: 'FIREMAGE',
                metric: 'relativeDeltaPct',
                reason: 'expired',
                expiresOn: '2026-03-01'
            }],
            '2026-03-15'
        );

        expect(matched.allowlistedViolations).toHaveLength(1);
        expect(expired.unallowlistedViolations).toHaveLength(1);
    });
});
