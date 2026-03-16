import type { CurrentFloorSummary } from '../../generation/schema';
import type { IresPrimaryResource, SkillIntentTag, WeightClass } from '../../types';

export type BalanceBudgetBand = 'trivial' | 'low' | 'medium' | 'high' | 'spike';

export interface SkillPowerProfile {
    skillId: string;
    slot: string;
    intentTags: SkillIntentTag[];
    primaryResource: IresPrimaryResource;
    primaryCost: number;
    directDamageScore: number;
    areaCoverageScore: number;
    mobilityScore: number;
    controlScore: number;
    defenseScore: number;
    economyTaxScore: number;
    setupDependencyScore: number;
    hazardSynergyScore: number;
    intrinsicPowerScore: number;
    powerBand: BalanceBudgetBand;
    rationale: string[];
}

export interface LoadoutPowerProfile {
    loadoutId: string;
    skillIds: string[];
    trinity: { body: number; mind: number; instinct: number };
    chassisScore: number;
    offenseScore: number;
    controlScore: number;
    mobilityScore: number;
    defenseScore: number;
    economyDisciplineScore: number;
    recoveryDemandScore: number;
    hazardHandlingScore: number;
    intrinsicPowerScore: number;
    powerBand: BalanceBudgetBand;
    rationale: string[];
}

export interface UnitPowerProfile {
    unitId: string;
    unitKind: 'player_loadout' | 'enemy' | 'companion';
    skillIds: string[];
    trinity: { body: number; mind: number; instinct: number };
    hp: number;
    maxHp: number;
    speed: number;
    weightClass?: WeightClass;
    chassisDurabilityScore: number;
    actionEconomyScore: number;
    offenseScore: number;
    controlScore: number;
    mobilityScore: number;
    sustainScore: number;
    intrinsicPowerScore: number;
    powerBand: BalanceBudgetBand;
    rationale: string[];
}

export interface EnemyPowerProfile extends UnitPowerProfile {
    unitKind: 'enemy';
    subtype: string;
    enemyType: 'melee' | 'ranged' | 'boss';
    budgetCost: number;
    threatProjectionScore: number;
    spikePressureScore: number;
    zoneDenialScore: number;
    reliabilityScore: number;
}

export interface FloorDifficultyProfile {
    floor: number;
    role: CurrentFloorSummary['role'];
    theme: string;
    routeCount: number;
    junctionCount: number;
    maxStraightRun: number;
    obstacleClusterCount: number;
    trapClusterCount: number;
    routeComplexityScore: number;
    pathFrictionScore: number;
    hazardPressureScore: number;
    recoveryAccessScore: number;
    navigationDifficultyScore: number;
    intrinsicDifficultyScore: number;
    difficultyBand: BalanceBudgetBand;
    rationale: string[];
}

export interface EncounterDifficultyProfile {
    floor: number;
    role: CurrentFloorSummary['role'];
    theme: string;
    enemyCount: number;
    uniqueEnemySubtypeCount: number;
    enemySubtypeIds: string[];
    encounterEnemyPowerScore: number;
    spawnPressureScore: number;
    routePressureScore: number;
    objectiveTensionScore: number;
    intrinsicDifficultyScore: number;
    difficultyBand: BalanceBudgetBand;
    rationale: string[];
}

export type RosterParityBand =
    | 'outlier_under'
    | 'under'
    | 'balanced'
    | 'over'
    | 'outlier_over';

export interface EnemyRosterParityProfile {
    subtype: string;
    intrinsicPowerScore: number;
    deltaFromMedian: number;
    relativeDeltaPct: number;
    parityBand: RosterParityBand;
}

export interface LoadoutRosterParityProfile {
    loadoutId: string;
    intrinsicPowerScore: number;
    deltaFromMedian: number;
    relativeDeltaPct: number;
    parityBand: RosterParityBand;
}

export type BalanceBudgetViolationCategory =
    | 'enemy_floor_budget'
    | 'encounter_floor_budget'
    | 'loadout_parity'
    | 'enemy_parity';

export type BalanceBudgetViolationSeverity = 'warning' | 'error';

export interface BalanceBudgetViolation {
    category: BalanceBudgetViolationCategory;
    severity: BalanceBudgetViolationSeverity;
    subjectId: string;
    floor?: number;
    role?: CurrentFloorSummary['role'];
    metric: string;
    expectedMax?: number;
    actual: number;
    delta?: number;
    message: string;
}

export interface BalanceViolationAllowlistEntry {
    id: string;
    category: BalanceBudgetViolationCategory;
    subjectId: string;
    floor?: number;
    role?: CurrentFloorSummary['role'];
    metric: string;
    expiresOn?: string;
    reason: string;
}

export interface BalanceViolationSummary {
    warnings: number;
    errors: number;
    allowlistedWarnings: number;
    allowlistedErrors: number;
}

export type BalanceStackBaselineArtifact = BalanceStackReport;

export interface BalanceStackGateReport {
    generatedAt: string;
    baseline: {
        generatedAt: string;
        params: BalanceStackReport['params'];
        errorViolations: number;
        warningViolations: number;
    };
    candidate: {
        generatedAt: string;
        params: BalanceStackReport['params'];
        errorViolations: number;
        warningViolations: number;
        allowlistedErrors: number;
        unallowlistedErrors: number;
    };
    allowlist: {
        entries: number;
        expiredEntryIds: string[];
    };
    newErrorViolations: BalanceBudgetViolation[];
    unallowlistedErrorViolations: BalanceBudgetViolation[];
    expiredAllowlistEntries: BalanceViolationAllowlistEntry[];
    passed: boolean;
}

export interface BalanceStackReport {
    generatedAt: string;
    params: {
        runSeed: string;
        maxFloor: number;
        trinityProfileId: string;
    };
    skillProfiles: SkillPowerProfile[];
    loadoutProfiles: LoadoutPowerProfile[];
    unitProfiles: UnitPowerProfile[];
    enemyProfiles: EnemyPowerProfile[];
    floorProfiles: FloorDifficultyProfile[];
    encounterProfiles: EncounterDifficultyProfile[];
    loadoutParityProfiles: LoadoutRosterParityProfile[];
    enemyParityProfiles: EnemyRosterParityProfile[];
    budgetViolations: BalanceBudgetViolation[];
    allowlistedViolations: BalanceBudgetViolation[];
    unallowlistedViolations: BalanceBudgetViolation[];
    violationSummary: BalanceViolationSummary;
    summary: {
        skillCount: number;
        loadoutCount: number;
        unitCount: number;
        enemyCount: number;
        floorCount: number;
        encounterCount: number;
        hottestSkillId: string | null;
        strongestLoadoutId: string | null;
        strongestEnemySubtype: string | null;
        hardestFloor: number | null;
        hardestEncounterFloor: number | null;
        mostOverParityLoadoutId: string | null;
        mostOverParityEnemySubtype: string | null;
        loadoutMedianIntrinsicPower: number;
        enemyMedianIntrinsicPower: number;
        budgetViolationCount: number;
        errorBudgetViolationCount: number;
        allowlistedBudgetViolationCount: number;
        unallowlistedBudgetViolationCount: number;
    };
}
