import type {
    ArchetypeLoadoutId,
    BatchSummary,
    BotPolicy,
    CombatProfileSignalSummary,
    EnemyAiBatchSummary,
    PacingSignalSummary,
    RunResult,
    SkillTelemetry,
    TriangleSignalSummary,
    TrinityContributionSummary,
} from './harness-types';
import { computeDynamicSkillGrades, type SkillTelemetryTotals } from './skill-grading';
import type { GenericAiGoal } from '../ai/generic-goal';
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
    avgTurnEndSparkRatio: 0,
    visibleHostileSelections: 0,
    idleWithVisibleHostile: 0,
    attackOpportunityCount: 0,
    attackConversionCount: 0,
    threatenNextTurnOpportunityCount: 0,
    threatenNextTurnConversionCount: 0,
    backtrackMoveCount: 0,
    loopMoveCount: 0,
    lowValueMobilitySelections: 0,
    restSelections: 0,
    endTurnSelections: 0,
    continuedActionSelections: 0,
    preservedRestedTurns: 0,
    restedBatterySpendSelections: 0,
    restedReentryTurns: 0,
    trueRestRestedBonusArmedTurns: 0,
    voluntaryExhaustionAttempts: 0,
    voluntaryExhaustionAllowed: 0,
    voluntaryExhaustionBlocked: 0,
    turnsEndedRested: 0,
    turnsEndedStableOrBetter: 0,
    turnsEndedCriticalOrExhausted: 0,
    secondActionAttempts: 0,
    secondActionAllowed: 0,
    thirdActionAttempts: 0,
    thirdActionAllowed: 0,
    waitForBandPreservationSelections: 0,
    firstContactTurn: 0,
    firstDamageTurn: 0
});

const zeroEnemyAiBatchSummary = (): EnemyAiBatchSummary => ({
    actionCounts: {},
    skillUsage: {},
    avgEnemyDamageToPlayerPerRun: 0,
    avgEnemyOffensiveSkillCastsPerRun: 0,
    enemyDamagePerOffensiveCast: 0,
    enemyAttackOpportunityConversionRate: 0,
    enemyThreatOpportunityConversionRate: 0,
    avgEnemyIdleWithVisiblePlayer: 0,
    avgEnemyBacktrackMoves: 0,
    avgEnemyLoopMoves: 0,
    avgEnemyPreservedRestedTurns: 0,
    avgEnemyRestedBatterySpendSelections: 0,
    avgEnemyRestedReentryTurns: 0,
    avgEnemyTrueRestRestedBonusArmedTurns: 0,
    avgEnemyVoluntaryExhaustionAttempts: 0,
    avgEnemyVoluntaryExhaustionAllowed: 0,
    avgEnemyVoluntaryExhaustionBlocked: 0,
    avgEnemyTurnsEndedRested: 0,
    avgEnemyTurnsEndedStableOrBetter: 0,
    avgEnemyTurnsEndedCriticalOrExhausted: 0,
    avgEnemySecondActionAttempts: 0,
    avgEnemySecondActionAllowed: 0,
    avgEnemyThirdActionAttempts: 0,
    avgEnemyThirdActionAllowed: 0,
    avgEnemyWaitForBandPreservationSelections: 0
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
    const goalTotals: Record<GenericAiGoal, number> = {
        engage: 0,
        explore: 0,
        recover: 0
    };
    const skillTelemetryTotals: SkillTelemetryTotals = {};
    const autoAttackTriggerTotals: Record<string, number> = {};
    const triangleSignalTotals = zeroTriangleSignal();
    const trinityContributionTotals = zeroTrinityContribution();
    const combatProfileSignalTotals = zeroCombatProfileSignal();
    const pacingSignalTotals = zeroPacingSignal();
    const enemyAiActionTotals: Record<string, number> = {};
    const enemyAiSkillTotals: Record<string, number> = {};
    let enemyDamageToPlayerTotal = 0;
    let enemyOffensiveSkillCastsTotal = 0;
    let enemyIdleWithVisiblePlayerTotal = 0;
    let enemyAttackOpportunityTurnsTotal = 0;
    let enemyAttackConversionTurnsTotal = 0;
    let enemyThreatOpportunityTurnsTotal = 0;
    let enemyThreatConversionTurnsTotal = 0;
    let enemyBacktrackMovesTotal = 0;
    let enemyLoopMovesTotal = 0;
    let enemyPreservedRestedTurnsTotal = 0;
    let enemyRestedBatterySpendSelectionsTotal = 0;
    let enemyRestedReentryTurnsTotal = 0;
    let enemyTrueRestRestedBonusArmedTurnsTotal = 0;
    let enemyVoluntaryExhaustionAttemptsTotal = 0;
    let enemyVoluntaryExhaustionAllowedTotal = 0;
    let enemyVoluntaryExhaustionBlockedTotal = 0;
    let enemyTurnsEndedRestedTotal = 0;
    let enemyTurnsEndedStableOrBetterTotal = 0;
    let enemyTurnsEndedCriticalOrExhaustedTotal = 0;
    let enemySecondActionAttemptsTotal = 0;
    let enemySecondActionAllowedTotal = 0;
    let enemyThirdActionAttemptsTotal = 0;
    let enemyThirdActionAllowedTotal = 0;
    let enemyWaitForBandPreservationSelectionsTotal = 0;

    for (const run of results) {
        mergeHistogram(actionTypeTotals, run.playerActionCounts || {});
        mergeHistogram(skillUsageTotals, run.playerSkillUsage || {});
        goalTotals.engage += run.goalCounts?.engage || 0;
        goalTotals.explore += run.goalCounts?.explore || 0;
        goalTotals.recover += run.goalCounts?.recover || 0;
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
        pacingSignalTotals.avgTurnEndSparkRatio += run.pacingSignal?.avgTurnEndSparkRatio || 0;
        pacingSignalTotals.visibleHostileSelections += run.pacingSignal?.visibleHostileSelections || 0;
        pacingSignalTotals.idleWithVisibleHostile += run.pacingSignal?.idleWithVisibleHostile || 0;
        pacingSignalTotals.attackOpportunityCount += run.pacingSignal?.attackOpportunityCount || 0;
        pacingSignalTotals.attackConversionCount += run.pacingSignal?.attackConversionCount || 0;
        pacingSignalTotals.threatenNextTurnOpportunityCount += run.pacingSignal?.threatenNextTurnOpportunityCount || 0;
        pacingSignalTotals.threatenNextTurnConversionCount += run.pacingSignal?.threatenNextTurnConversionCount || 0;
        pacingSignalTotals.backtrackMoveCount += run.pacingSignal?.backtrackMoveCount || 0;
        pacingSignalTotals.loopMoveCount += run.pacingSignal?.loopMoveCount || 0;
        pacingSignalTotals.lowValueMobilitySelections += run.pacingSignal?.lowValueMobilitySelections || 0;
        pacingSignalTotals.restSelections += run.pacingSignal?.restSelections || 0;
        pacingSignalTotals.endTurnSelections += run.pacingSignal?.endTurnSelections || 0;
        pacingSignalTotals.continuedActionSelections += run.pacingSignal?.continuedActionSelections || 0;
        pacingSignalTotals.preservedRestedTurns += run.pacingSignal?.preservedRestedTurns || 0;
        pacingSignalTotals.restedBatterySpendSelections += run.pacingSignal?.restedBatterySpendSelections || 0;
        pacingSignalTotals.restedReentryTurns += run.pacingSignal?.restedReentryTurns || 0;
        pacingSignalTotals.trueRestRestedBonusArmedTurns += run.pacingSignal?.trueRestRestedBonusArmedTurns || 0;
        pacingSignalTotals.voluntaryExhaustionAttempts += run.pacingSignal?.voluntaryExhaustionAttempts || 0;
        pacingSignalTotals.voluntaryExhaustionAllowed += run.pacingSignal?.voluntaryExhaustionAllowed || 0;
        pacingSignalTotals.voluntaryExhaustionBlocked += run.pacingSignal?.voluntaryExhaustionBlocked || 0;
        pacingSignalTotals.turnsEndedRested += run.pacingSignal?.turnsEndedRested || 0;
        pacingSignalTotals.turnsEndedStableOrBetter += run.pacingSignal?.turnsEndedStableOrBetter || 0;
        pacingSignalTotals.turnsEndedCriticalOrExhausted += run.pacingSignal?.turnsEndedCriticalOrExhausted || 0;
        pacingSignalTotals.secondActionAttempts += run.pacingSignal?.secondActionAttempts || 0;
        pacingSignalTotals.secondActionAllowed += run.pacingSignal?.secondActionAllowed || 0;
        pacingSignalTotals.thirdActionAttempts += run.pacingSignal?.thirdActionAttempts || 0;
        pacingSignalTotals.thirdActionAllowed += run.pacingSignal?.thirdActionAllowed || 0;
        pacingSignalTotals.waitForBandPreservationSelections += run.pacingSignal?.waitForBandPreservationSelections || 0;
        pacingSignalTotals.firstContactTurn += run.pacingSignal?.firstContactTurn || 0;
        pacingSignalTotals.firstDamageTurn += run.pacingSignal?.firstDamageTurn || 0;

        mergeHistogram(enemyAiActionTotals, run.enemyAiTelemetry?.actionCounts || {});
        mergeHistogram(enemyAiSkillTotals, run.enemyAiTelemetry?.skillUsage || {});
        enemyDamageToPlayerTotal += run.enemyAiTelemetry?.damageToPlayer || 0;
        enemyOffensiveSkillCastsTotal += run.enemyAiTelemetry?.offensiveSkillCasts || 0;
        enemyIdleWithVisiblePlayerTotal += run.enemyAiTelemetry?.idleWithVisiblePlayer || 0;
        enemyAttackOpportunityTurnsTotal += run.enemyAiTelemetry?.attackOpportunityTurns || 0;
        enemyAttackConversionTurnsTotal += run.enemyAiTelemetry?.attackConversionTurns || 0;
        enemyThreatOpportunityTurnsTotal += run.enemyAiTelemetry?.threatOpportunityTurns || 0;
        enemyThreatConversionTurnsTotal += run.enemyAiTelemetry?.threatConversionTurns || 0;
        enemyBacktrackMovesTotal += run.enemyAiTelemetry?.backtrackMoves || 0;
        enemyLoopMovesTotal += run.enemyAiTelemetry?.loopMoves || 0;
        enemyPreservedRestedTurnsTotal += run.enemyAiTelemetry?.preservedRestedTurns || 0;
        enemyRestedBatterySpendSelectionsTotal += run.enemyAiTelemetry?.restedBatterySpendSelections || 0;
        enemyRestedReentryTurnsTotal += run.enemyAiTelemetry?.restedReentryTurns || 0;
        enemyTrueRestRestedBonusArmedTurnsTotal += run.enemyAiTelemetry?.trueRestRestedBonusArmedTurns || 0;
        enemyVoluntaryExhaustionAttemptsTotal += run.enemyAiTelemetry?.voluntaryExhaustionAttempts || 0;
        enemyVoluntaryExhaustionAllowedTotal += run.enemyAiTelemetry?.voluntaryExhaustionAllowed || 0;
        enemyVoluntaryExhaustionBlockedTotal += run.enemyAiTelemetry?.voluntaryExhaustionBlocked || 0;
        enemyTurnsEndedRestedTotal += run.enemyAiTelemetry?.turnsEndedRested || 0;
        enemyTurnsEndedStableOrBetterTotal += run.enemyAiTelemetry?.turnsEndedStableOrBetter || 0;
        enemyTurnsEndedCriticalOrExhaustedTotal += run.enemyAiTelemetry?.turnsEndedCriticalOrExhausted || 0;
        enemySecondActionAttemptsTotal += run.enemyAiTelemetry?.secondActionAttempts || 0;
        enemySecondActionAllowedTotal += run.enemyAiTelemetry?.secondActionAllowed || 0;
        enemyThirdActionAttemptsTotal += run.enemyAiTelemetry?.thirdActionAttempts || 0;
        enemyThirdActionAllowedTotal += run.enemyAiTelemetry?.thirdActionAllowed || 0;
        enemyWaitForBandPreservationSelectionsTotal += run.enemyAiTelemetry?.waitForBandPreservationSelections || 0;
    }

    const divisor = results.length || 1;
    const avgSkillUsagePerRun = averageHistogramPerEntry(skillUsageTotals, results.length);
    const avgGoalPerRun: Record<GenericAiGoal, number> = {
        engage: goalTotals.engage / divisor,
        explore: goalTotals.explore / divisor,
        recover: goalTotals.recover / divisor
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
        avgTurnEndSparkRatio: pacingSignalTotals.avgTurnEndSparkRatio / divisor,
        visibleHostileSelections: pacingSignalTotals.visibleHostileSelections,
        idleWithVisibleHostile: pacingSignalTotals.idleWithVisibleHostile,
        attackOpportunityCount: pacingSignalTotals.attackOpportunityCount,
        attackConversionCount: pacingSignalTotals.attackConversionCount,
        threatenNextTurnOpportunityCount: pacingSignalTotals.threatenNextTurnOpportunityCount,
        threatenNextTurnConversionCount: pacingSignalTotals.threatenNextTurnConversionCount,
        backtrackMoveCount: pacingSignalTotals.backtrackMoveCount,
        loopMoveCount: pacingSignalTotals.loopMoveCount,
        lowValueMobilitySelections: pacingSignalTotals.lowValueMobilitySelections,
        restSelections: pacingSignalTotals.restSelections,
        endTurnSelections: pacingSignalTotals.endTurnSelections,
        continuedActionSelections: pacingSignalTotals.continuedActionSelections,
        preservedRestedTurns: pacingSignalTotals.preservedRestedTurns,
        restedBatterySpendSelections: pacingSignalTotals.restedBatterySpendSelections,
        restedReentryTurns: pacingSignalTotals.restedReentryTurns,
        trueRestRestedBonusArmedTurns: pacingSignalTotals.trueRestRestedBonusArmedTurns,
        voluntaryExhaustionAttempts: pacingSignalTotals.voluntaryExhaustionAttempts,
        voluntaryExhaustionAllowed: pacingSignalTotals.voluntaryExhaustionAllowed,
        voluntaryExhaustionBlocked: pacingSignalTotals.voluntaryExhaustionBlocked,
        turnsEndedRested: pacingSignalTotals.turnsEndedRested,
        turnsEndedStableOrBetter: pacingSignalTotals.turnsEndedStableOrBetter,
        turnsEndedCriticalOrExhausted: pacingSignalTotals.turnsEndedCriticalOrExhausted,
        secondActionAttempts: pacingSignalTotals.secondActionAttempts,
        secondActionAllowed: pacingSignalTotals.secondActionAllowed,
        thirdActionAttempts: pacingSignalTotals.thirdActionAttempts,
        thirdActionAllowed: pacingSignalTotals.thirdActionAllowed,
        waitForBandPreservationSelections: pacingSignalTotals.waitForBandPreservationSelections,
        firstContactTurn: pacingSignalTotals.firstContactTurn,
        firstDamageTurn: pacingSignalTotals.firstDamageTurn
    };
    const enemyAiTelemetry: EnemyAiBatchSummary = {
        ...zeroEnemyAiBatchSummary(),
        actionCounts: enemyAiActionTotals,
        skillUsage: enemyAiSkillTotals,
        avgEnemyDamageToPlayerPerRun: enemyDamageToPlayerTotal / divisor,
        avgEnemyOffensiveSkillCastsPerRun: enemyOffensiveSkillCastsTotal / divisor,
        enemyDamagePerOffensiveCast: enemyDamageToPlayerTotal / Math.max(1, enemyOffensiveSkillCastsTotal),
        enemyAttackOpportunityConversionRate: enemyAttackConversionTurnsTotal / Math.max(1, enemyAttackOpportunityTurnsTotal),
        enemyThreatOpportunityConversionRate: enemyThreatConversionTurnsTotal / Math.max(1, enemyThreatOpportunityTurnsTotal),
        avgEnemyIdleWithVisiblePlayer: enemyIdleWithVisiblePlayerTotal / divisor,
        avgEnemyBacktrackMoves: enemyBacktrackMovesTotal / divisor,
        avgEnemyLoopMoves: enemyLoopMovesTotal / divisor,
        avgEnemyPreservedRestedTurns: enemyPreservedRestedTurnsTotal / divisor,
        avgEnemyRestedBatterySpendSelections: enemyRestedBatterySpendSelectionsTotal / divisor,
        avgEnemyRestedReentryTurns: enemyRestedReentryTurnsTotal / divisor,
        avgEnemyTrueRestRestedBonusArmedTurns: enemyTrueRestRestedBonusArmedTurnsTotal / divisor,
        avgEnemyVoluntaryExhaustionAttempts: enemyVoluntaryExhaustionAttemptsTotal / divisor,
        avgEnemyVoluntaryExhaustionAllowed: enemyVoluntaryExhaustionAllowedTotal / divisor,
        avgEnemyVoluntaryExhaustionBlocked: enemyVoluntaryExhaustionBlockedTotal / divisor,
        avgEnemyTurnsEndedRested: enemyTurnsEndedRestedTotal / divisor,
        avgEnemyTurnsEndedStableOrBetter: enemyTurnsEndedStableOrBetterTotal / divisor,
        avgEnemyTurnsEndedCriticalOrExhausted: enemyTurnsEndedCriticalOrExhaustedTotal / divisor,
        avgEnemySecondActionAttempts: enemySecondActionAttemptsTotal / divisor,
        avgEnemySecondActionAllowed: enemySecondActionAllowedTotal / divisor,
        avgEnemyThirdActionAttempts: enemyThirdActionAttemptsTotal / divisor,
        avgEnemyThirdActionAllowed: enemyThirdActionAllowedTotal / divisor,
        avgEnemyWaitForBandPreservationSelections: enemyWaitForBandPreservationSelectionsTotal / divisor
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
        goalTotals,
        avgGoalPerRun,
        avgPlayerSkillCastsPerRun: average(results.map(r => r.totalPlayerSkillCasts || 0)),
        attackConversionRate: pacingSignalTotals.attackConversionCount / Math.max(1, pacingSignalTotals.attackOpportunityCount),
        threatenNextTurnConversionRate: pacingSignalTotals.threatenNextTurnConversionCount / Math.max(1, pacingSignalTotals.threatenNextTurnOpportunityCount),
        avgIdleWithVisibleHostile: pacingSignalTotals.idleWithVisibleHostile / divisor,
        avgBacktrackMoves: pacingSignalTotals.backtrackMoveCount / divisor,
        avgLoopMoves: pacingSignalTotals.loopMoveCount / divisor,
        avgLowValueMobilitySelections: pacingSignalTotals.lowValueMobilitySelections / divisor,
        avgFirstContactTurn: average(results.map(r => r.pacingSignal?.firstContactTurn || 0).filter(value => value > 0)),
        avgFirstDamageTurn: average(results.map(r => r.pacingSignal?.firstDamageTurn || 0).filter(value => value > 0)),
        skillTelemetryTotals,
        autoAttackTriggerTotals,
        triangleSignal,
        trinityContribution,
        combatProfileSignal,
        pacingSignal,
        enemyAiTelemetry,
        dynamicSkillGrades: {}
    };

    summary.dynamicSkillGrades = computeDynamicSkillGrades(summary);
    return summary;
};
