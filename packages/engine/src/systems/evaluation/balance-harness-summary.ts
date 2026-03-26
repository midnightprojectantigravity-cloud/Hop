import type {
    ArchetypeLoadoutId,
    BatchSummary,
    BotPolicy,
    CombatProfileSignalSummary,
    PacingSignalSummary,
    RunResult,
    SkillTelemetry,
    TriangleSignalSummary,
    TrinityContributionSummary,
} from './harness-types';
import { computeDynamicSkillGrades, type SkillTelemetryTotals } from './skill-grading';
import type { StrategicIntent } from '../ai/strategic-policy';
import {
    average,
    averageHistogramPerEntry,
    mergeHistogram,
} from './harness-core';

const mergeSkillTelemetry = (target: SkillTelemetryTotals, source: Record<string, SkillTelemetry>) => {
    for (const [skillId, stats] of Object.entries(source)) {
        if (!target[skillId]) {
            target[skillId] = { ...stats, lavaSinks: stats.lavaSinks || 0 };
            continue;
        }
        const dst = target[skillId];
        dst.lavaSinks = dst.lavaSinks || 0;
        dst.casts += stats.casts;
        dst.enemyDamage += stats.enemyDamage;
        dst.killShots += stats.killShots;
        dst.healingReceived += stats.healingReceived;
        dst.hazardDamage += stats.hazardDamage;
        dst.stairsProgress += stats.stairsProgress;
        dst.shrineProgress += stats.shrineProgress;
        dst.floorProgress += stats.floorProgress;
        dst.lavaSinks += stats.lavaSinks || 0;
    }
};

const zeroTriangleSignal = (): TriangleSignalSummary => ({
    samples: 0,
    avgHitPressure: 0,
    avgMitigationPressure: 0,
    avgCritPressure: 0,
    avgResistancePressure: 0
});

const zeroTrinityContribution = (): TrinityContributionSummary => ({
    samples: 0, bodyContribution: 0, mindContribution: 0, instinctContribution: 0
});

const zeroCombatProfileSignal = (): CombatProfileSignalSummary => ({
    samples: 0, avgOutgoingMultiplier: 0, avgIncomingMultiplier: 0, avgTotalMultiplier: 0
});

const zeroPacingSignal = (): PacingSignalSummary => ({
    samples: 0,
    avgSparkRatio: 0,
    avgManaRatio: 0,
    avgReservePressure: 0,
    avgFatiguePressure: 0,
    avgRecoveryPressure: 0,
    restSelections: 0,
    endTurnSelections: 0,
    continuedActionSelections: 0
});

export const summarizeBatch = (
    results: RunResult[],
    policy: BotPolicy,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD'
): BatchSummary => {
    const wins = results.filter(r => r.result === 'won');
    const losses = results.filter(r => r.result === 'lost');
    const timeouts = results.filter(r => r.result === 'timeout');
    const actionTypeTotals: Record<string, number> = {};
    const skillUsageTotals: Record<string, number> = {};
    const strategicIntentTotals: Record<StrategicIntent, number> = {
        offense: 0,
        defense: 0,
        positioning: 0,
        control: 0
    };
    const skillTelemetryTotals: SkillTelemetryTotals = {};
    const autoAttackTriggerTotals: Record<string, number> = {};
    const triangleSignalTotals = zeroTriangleSignal();
    const trinityContributionTotals = zeroTrinityContribution();
    const combatProfileSignalTotals = zeroCombatProfileSignal();
    const pacingSignalTotals = zeroPacingSignal();

    for (const run of results) {
        mergeHistogram(actionTypeTotals, run.playerActionCounts || {});
        mergeHistogram(skillUsageTotals, run.playerSkillUsage || {});
        strategicIntentTotals.offense += run.strategicIntentCounts?.offense || 0;
        strategicIntentTotals.defense += run.strategicIntentCounts?.defense || 0;
        strategicIntentTotals.positioning += run.strategicIntentCounts?.positioning || 0;
        strategicIntentTotals.control += run.strategicIntentCounts?.control || 0;
        mergeSkillTelemetry(skillTelemetryTotals, run.playerSkillTelemetry || {});
        mergeHistogram(autoAttackTriggerTotals, run.autoAttackTriggersByActionType || {});
        triangleSignalTotals.samples += run.triangleSignal?.samples || 0;
        triangleSignalTotals.avgHitPressure += run.triangleSignal?.avgHitPressure || 0;
        triangleSignalTotals.avgMitigationPressure += run.triangleSignal?.avgMitigationPressure || 0;
        triangleSignalTotals.avgCritPressure += run.triangleSignal?.avgCritPressure || 0;
        triangleSignalTotals.avgResistancePressure += run.triangleSignal?.avgResistancePressure || 0;
        trinityContributionTotals.samples += run.trinityContribution?.samples || 0;
        trinityContributionTotals.bodyContribution += run.trinityContribution?.bodyContribution || 0;
        trinityContributionTotals.mindContribution += run.trinityContribution?.mindContribution || 0;
        trinityContributionTotals.instinctContribution += run.trinityContribution?.instinctContribution || 0;
        combatProfileSignalTotals.samples += run.combatProfileSignal?.samples || 0;
        combatProfileSignalTotals.avgOutgoingMultiplier += run.combatProfileSignal?.avgOutgoingMultiplier || 0;
        combatProfileSignalTotals.avgIncomingMultiplier += run.combatProfileSignal?.avgIncomingMultiplier || 0;
        combatProfileSignalTotals.avgTotalMultiplier += run.combatProfileSignal?.avgTotalMultiplier || 0;
        pacingSignalTotals.samples += run.pacingSignal?.samples || 0;
        pacingSignalTotals.avgSparkRatio += run.pacingSignal?.avgSparkRatio || 0;
        pacingSignalTotals.avgManaRatio += run.pacingSignal?.avgManaRatio || 0;
        pacingSignalTotals.avgReservePressure += run.pacingSignal?.avgReservePressure || 0;
        pacingSignalTotals.avgFatiguePressure += run.pacingSignal?.avgFatiguePressure || 0;
        pacingSignalTotals.avgRecoveryPressure += run.pacingSignal?.avgRecoveryPressure || 0;
        pacingSignalTotals.restSelections += run.pacingSignal?.restSelections || 0;
        pacingSignalTotals.endTurnSelections += run.pacingSignal?.endTurnSelections || 0;
        pacingSignalTotals.continuedActionSelections += run.pacingSignal?.continuedActionSelections || 0;
    }

    const divisor = results.length || 1;
    const avgSkillUsagePerRun = averageHistogramPerEntry(skillUsageTotals, results.length);
    const avgStrategicIntentPerRun: Record<StrategicIntent, number> = {
        offense: strategicIntentTotals.offense / divisor,
        defense: strategicIntentTotals.defense / divisor,
        positioning: strategicIntentTotals.positioning / divisor,
        control: strategicIntentTotals.control / divisor
    };
    const triangleSignal: TriangleSignalSummary = {
        samples: triangleSignalTotals.samples,
        avgHitPressure: triangleSignalTotals.avgHitPressure / divisor,
        avgMitigationPressure: triangleSignalTotals.avgMitigationPressure / divisor,
        avgCritPressure: triangleSignalTotals.avgCritPressure / divisor,
        avgResistancePressure: triangleSignalTotals.avgResistancePressure / divisor
    };
    const trinityContribution: TrinityContributionSummary = {
        samples: trinityContributionTotals.samples,
        bodyContribution: trinityContributionTotals.bodyContribution / divisor,
        mindContribution: trinityContributionTotals.mindContribution / divisor,
        instinctContribution: trinityContributionTotals.instinctContribution / divisor
    };
    const combatProfileSignal: CombatProfileSignalSummary = {
        samples: combatProfileSignalTotals.samples,
        avgOutgoingMultiplier: combatProfileSignalTotals.avgOutgoingMultiplier / divisor,
        avgIncomingMultiplier: combatProfileSignalTotals.avgIncomingMultiplier / divisor,
        avgTotalMultiplier: combatProfileSignalTotals.avgTotalMultiplier / divisor
    };
    const pacingSignal: PacingSignalSummary = {
        samples: pacingSignalTotals.samples,
        avgSparkRatio: pacingSignalTotals.avgSparkRatio / divisor,
        avgManaRatio: pacingSignalTotals.avgManaRatio / divisor,
        avgReservePressure: pacingSignalTotals.avgReservePressure / divisor,
        avgFatiguePressure: pacingSignalTotals.avgFatiguePressure / divisor,
        avgRecoveryPressure: pacingSignalTotals.avgRecoveryPressure / divisor,
        restSelections: pacingSignalTotals.restSelections,
        endTurnSelections: pacingSignalTotals.endTurnSelections,
        continuedActionSelections: pacingSignalTotals.continuedActionSelections
    };

    const summary: BatchSummary = {
        policy,
        policyProfileId: results[0]?.policyProfileId || 'sp-v1-default',
        loadoutId,
        games: results.length,
        winRate: results.length ? wins.length / results.length : 0,
        timeoutRate: results.length ? timeouts.length / results.length : 0,
        avgTurnsToWin: average(wins.map(r => r.turnsSpent)),
        avgTurnsToLoss: average(losses.map(r => r.turnsSpent)),
        avgFloor: average(results.map(r => r.floor || 0)),
        avgHazardBreaches: average(results.map(r => r.hazardBreaches)),
        hazardDeaths: losses.filter(r => r.hazardBreaches > 0).length,
        avgFloorPerTurn: average(results.map(r => (r.floor || 0) / Math.max(1, r.turnsSpent || 0))),
        reachedFloor3Rate: results.length ? results.filter(r => (r.floor || 0) >= 3).length / results.length : 0,
        reachedFloor5Rate: results.length ? results.filter(r => (r.floor || 0) >= 5).length / results.length : 0,
        avgFinalPlayerHpRatio: average(results.map(r => r.finalPlayerHpRatio || 0)),
        avgFinalPlayerHpRatioWhenTimeout: average(timeouts.map(r => r.finalPlayerHpRatio || 0)),
        avgFinalSpark: average(results.map(r => r.finalSpark || 0)),
        avgFinalMana: average(results.map(r => r.finalMana || 0)),
        avgFinalSparkRatio: average(results.map(r => r.finalSparkRatio || 0)),
        avgFinalExhaustion: average(results.map(r => r.finalExhaustion || 0)),
        avgPeakExhaustion: average(results.map(r => r.peakExhaustion || 0)),
        avgRestTurns: average(results.map(r => r.restTurns || 0)),
        avgRedlineActions: average(results.map(r => r.redlineActions || 0)),
        avgSparkBurnDamage: average(results.map(r => r.sparkBurnDamage || 0)),
        avgActionsPerPlayerTurn: average(results.map(r => r.avgActionsPerPlayerTurn || 0)),
        avgDirectorRedlineBand: average(results.map(r => r.directorRedlineBand || 0)),
        avgDirectorResourceStressBand: average(results.map(r => r.directorResourceStressBand || 0)),
        timeoutWithSafeHpRate: results.length
            ? results.filter(r => r.result === 'timeout' && (r.finalPlayerHpRatio || 0) >= 0.5).length / results.length
            : 0,
        actionTypeTotals,
        skillUsageTotals,
        avgSkillUsagePerRun,
        strategicIntentTotals,
        avgStrategicIntentPerRun,
        avgPlayerSkillCastsPerRun: average(results.map(r => r.totalPlayerSkillCasts || 0)),
        skillTelemetryTotals,
        autoAttackTriggerTotals,
        triangleSignal,
        trinityContribution,
        combatProfileSignal,
        pacingSignal,
        dynamicSkillGrades: {}
    };

    summary.dynamicSkillGrades = computeDynamicSkillGrades(summary);
    return summary;
};
