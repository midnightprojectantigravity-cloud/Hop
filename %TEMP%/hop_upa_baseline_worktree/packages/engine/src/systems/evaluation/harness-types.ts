import type { Action } from '../../types';
import type { StrategicIntent } from '../ai/strategic-policy';
import type { DynamicSkillMetric, SkillTelemetryTotals } from './skill-grading';

export type BotPolicy = 'random' | 'heuristic';
export type ArchetypeLoadoutId = keyof typeof import('../loadout').DEFAULT_LOADOUTS;

export interface SkillTelemetry {
    casts: number;
    enemyDamage: number;
    killShots: number;
    healingReceived: number;
    hazardDamage: number;
    stairsProgress: number;
    shrineProgress: number;
    floorProgress: number;
    lavaSinks: number;
}

export interface TriangleSignalSummary {
    samples: number;
    avgHitPressure: number;
    avgMitigationPressure: number;
    avgCritPressure: number;
    avgResistancePressure: number;
}

export interface TrinityContributionSummary {
    samples: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
}

export interface CombatProfileSignalSummary {
    samples: number;
    avgOutgoingMultiplier: number;
    avgIncomingMultiplier: number;
    avgTotalMultiplier: number;
}

export interface RunResult {
    seed: string;
    policy: BotPolicy;
    policyProfileId: string;
    loadoutId: ArchetypeLoadoutId;
    result: 'won' | 'lost' | 'timeout';
    turnsSpent: number;
    floor: number;
    kills: number;
    hazardBreaches: number;
    score: number;
    finalPlayerHp: number;
    finalPlayerMaxHp: number;
    finalPlayerHpRatio: number;
    playerActionCounts: Record<string, number>;
    playerSkillUsage: Record<string, number>;
    strategicIntentCounts: Record<StrategicIntent, number>;
    totalPlayerSkillCasts: number;
    playerSkillTelemetry: Record<string, SkillTelemetry>;
    autoAttackTriggersByActionType: Record<string, number>;
    triangleSignal: TriangleSignalSummary;
    trinityContribution: TrinityContributionSummary;
    combatProfileSignal: CombatProfileSignalSummary;
}

export interface RunDiagnostics {
    actionLog: Action[];
    stateFingerprint: string;
}

export interface SimulatedRunDetailed {
    run: RunResult;
    diagnostics: RunDiagnostics;
}

export interface BatchSummary {
    policy: BotPolicy;
    policyProfileId: string;
    loadoutId: ArchetypeLoadoutId;
    games: number;
    winRate: number;
    timeoutRate: number;
    avgTurnsToWin: number;
    avgTurnsToLoss: number;
    avgFloor: number;
    avgHazardBreaches: number;
    hazardDeaths: number;
    avgFloorPerTurn: number;
    reachedFloor3Rate: number;
    reachedFloor5Rate: number;
    avgFinalPlayerHpRatio: number;
    avgFinalPlayerHpRatioWhenTimeout: number;
    timeoutWithSafeHpRate: number;
    actionTypeTotals: Record<string, number>;
    skillUsageTotals: Record<string, number>;
    avgSkillUsagePerRun: Record<string, number>;
    strategicIntentTotals: Record<StrategicIntent, number>;
    avgStrategicIntentPerRun: Record<StrategicIntent, number>;
    avgPlayerSkillCastsPerRun: number;
    skillTelemetryTotals: SkillTelemetryTotals;
    autoAttackTriggerTotals: Record<string, number>;
    triangleSignal: TriangleSignalSummary;
    trinityContribution: TrinityContributionSummary;
    combatProfileSignal: CombatProfileSignalSummary;
    dynamicSkillGrades: Record<string, DynamicSkillMetric>;
}

export interface MatchupSide {
    policy: BotPolicy;
    loadoutId: ArchetypeLoadoutId;
}

export interface MatchupRun {
    seed: string;
    left: RunResult;
    right: RunResult;
    winner: 'left' | 'right' | 'tie';
}

export interface MatchupSummary {
    games: number;
    leftWins: number;
    rightWins: number;
    ties: number;
    leftWinRate: number;
    rightWinRate: number;
    tieRate: number;
}
