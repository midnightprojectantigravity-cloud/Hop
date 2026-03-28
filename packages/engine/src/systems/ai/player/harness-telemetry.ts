import type { Action, GameState } from '../../../types';
import type { TransitionMetrics } from './features';
import type { StrategicIntent } from '../strategic-policy';
import { getAiResourceSignals } from '../resource-signals';
import { resolveWaitPreview } from '../../ires';
import type { GenericUnitAiCandidateFacts, GenericUnitAiSelectionSummary } from '../generic-unit-ai';

export interface PlayerSkillTelemetry {
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

export interface TriangleSignalSummaryLike {
    samples: number;
    avgHitPressure: number;
    avgMitigationPressure: number;
    avgCritPressure: number;
    avgResistancePressure: number;
}

export interface TrinityContributionSummaryLike {
    samples: number;
    bodyContribution: number;
    mindContribution: number;
    instinctContribution: number;
}

export interface CombatProfileSignalSummaryLike {
    samples: number;
    avgOutgoingMultiplier: number;
    avgIncomingMultiplier: number;
    avgTotalMultiplier: number;
}

export interface PlayerPacingSignalSummaryLike {
    samples: number;
    avgSparkRatio: number;
    avgManaRatio: number;
    avgReservePressure: number;
    avgFatiguePressure: number;
    avgRecoveryPressure: number;
    avgTurnEndSparkRatio: number;
    visibleHostileSelections: number;
    idleWithVisibleHostile: number;
    attackOpportunityCount: number;
    attackConversionCount: number;
    threatenNextTurnOpportunityCount: number;
    threatenNextTurnConversionCount: number;
    backtrackMoveCount: number;
    loopMoveCount: number;
    lowValueMobilitySelections: number;
    restSelections: number;
    endTurnSelections: number;
    continuedActionSelections: number;
    preservedRestedTurns: number;
    restedBatterySpendSelections: number;
    restedReentryTurns: number;
    trueRestRestedBonusArmedTurns: number;
    voluntaryExhaustionAttempts: number;
    voluntaryExhaustionAllowed: number;
    voluntaryExhaustionBlocked: number;
    turnsEndedRested: number;
    turnsEndedStableOrBetter: number;
    turnsEndedCriticalOrExhausted: number;
    secondActionAttempts: number;
    secondActionAllowed: number;
    thirdActionAttempts: number;
    thirdActionAllowed: number;
    waitForBandPreservationSelections: number;
    firstContactTurn: number;
    firstDamageTurn: number;
}

export interface PlayerCombatSignals {
    triangleSignal: TriangleSignalSummaryLike;
    trinityContribution: TrinityContributionSummaryLike;
    combatProfileSignal: CombatProfileSignalSummaryLike;
}

export interface PlayerTurnTelemetryAccumulator {
    playerActionCounts: Record<string, number>;
    playerSkillUsage: Record<string, number>;
    strategicIntentCounts: Record<StrategicIntent, number>;
    totalPlayerSkillCasts: number;
    playerSkillTelemetry: Record<string, PlayerSkillTelemetry>;
    autoAttackTriggersByActionType: Record<string, number>;
    pacingSignal: PlayerPacingSignalSummaryLike;
}

const incrementHistogram = (hist: Record<string, number>, key: string): void => {
    hist[key] = (hist[key] || 0) + 1;
};

const zeroSkillTelemetry = (): PlayerSkillTelemetry => ({
    casts: 0,
    enemyDamage: 0,
    killShots: 0,
    healingReceived: 0,
    hazardDamage: 0,
    stairsProgress: 0,
    shrineProgress: 0,
    floorProgress: 0,
    lavaSinks: 0
});

const zeroTriangleSignal = (): TriangleSignalSummaryLike => ({
    samples: 0,
    avgHitPressure: 0,
    avgMitigationPressure: 0,
    avgCritPressure: 0,
    avgResistancePressure: 0
});

const zeroTrinityContribution = (): TrinityContributionSummaryLike => ({
    samples: 0,
    bodyContribution: 0,
    mindContribution: 0,
    instinctContribution: 0
});

const zeroCombatProfileSignal = (): CombatProfileSignalSummaryLike => ({
    samples: 0,
    avgOutgoingMultiplier: 0,
    avgIncomingMultiplier: 0,
    avgTotalMultiplier: 0
});

const zeroPacingSignal = (): PlayerPacingSignalSummaryLike => ({
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

export const createPlayerTurnTelemetryAccumulator = (): PlayerTurnTelemetryAccumulator => ({
    playerActionCounts: {},
    playerSkillUsage: {},
    strategicIntentCounts: {
        offense: 0,
        defense: 0,
        positioning: 0,
        control: 0
    },
    totalPlayerSkillCasts: 0,
    playerSkillTelemetry: {},
    autoAttackTriggersByActionType: {},
    pacingSignal: zeroPacingSignal()
});

export const recordPlayerActionSelectionTelemetry = (
    accumulator: PlayerTurnTelemetryAccumulator,
    state: GameState,
    action: Action,
    strategicIntent: StrategicIntent,
    selectedFacts?: GenericUnitAiCandidateFacts,
    selectionSummary?: GenericUnitAiSelectionSummary
): void => {
    accumulator.strategicIntentCounts[strategicIntent] += 1;
    incrementHistogram(accumulator.playerActionCounts, action.type);
    const signals = getAiResourceSignals(state.player.ires, state.ruleset);
    const turnMarker = Math.max(1, Number(state.turnsSpent || 0) + 1);
    accumulator.pacingSignal.samples += 1;
    accumulator.pacingSignal.avgSparkRatio += signals.sparkRatio;
    accumulator.pacingSignal.avgManaRatio += signals.manaRatio;
    accumulator.pacingSignal.avgReservePressure += signals.reservePressure;
    accumulator.pacingSignal.avgFatiguePressure += signals.fatiguePressure;
    accumulator.pacingSignal.avgRecoveryPressure += signals.recoveryPressure;
    if ((selectionSummary?.visibleOpponentCount || 0) > 0) {
        accumulator.pacingSignal.visibleHostileSelections += 1;
        if (accumulator.pacingSignal.firstContactTurn === 0) {
            accumulator.pacingSignal.firstContactTurn = turnMarker;
        }
    }
    if (selectionSummary?.attackOpportunityAvailable) {
        accumulator.pacingSignal.attackOpportunityCount += 1;
    }
    if (selectionSummary?.threatOpportunityAvailable) {
        accumulator.pacingSignal.threatenNextTurnOpportunityCount += 1;
    }
    if (selectedFacts?.canDamageNow) {
        accumulator.pacingSignal.attackConversionCount += 1;
    }
    if (!selectedFacts?.canDamageNow && selectedFacts?.createsThreatNextDecision) {
        accumulator.pacingSignal.threatenNextTurnConversionCount += 1;
    }
    if (selectedFacts?.backtracks) {
        accumulator.pacingSignal.backtrackMoveCount += 1;
    }
    if (
        action.type !== 'WAIT'
        && !!selectedFacts
        && !selectedFacts.canDamageNow
        && !selectedFacts.createsThreatNextDecision
        && !selectedFacts.improvesObjective
        && !selectedFacts.reducesExposureMaterially
    ) {
        accumulator.pacingSignal.loopMoveCount += 1;
    }
    if (selectedFacts?.isLowValueMobility) {
        accumulator.pacingSignal.lowValueMobilitySelections += 1;
    }
    accumulator.pacingSignal.voluntaryExhaustionAttempts += Number(selectionSummary?.voluntaryExhaustionAttemptCount || 0);
    accumulator.pacingSignal.voluntaryExhaustionAllowed += Number(selectionSummary?.voluntaryExhaustionAllowedCount || 0);
    accumulator.pacingSignal.voluntaryExhaustionBlocked += Number(selectionSummary?.voluntaryExhaustionBlockedCount || 0);

    if (selectionSummary?.selectedActionOrdinal === 2) {
        accumulator.pacingSignal.secondActionAttempts += 1;
        if (action.type !== 'WAIT') {
            accumulator.pacingSignal.secondActionAllowed += 1;
        }
    }
    if ((selectionSummary?.selectedActionOrdinal || 0) >= 3) {
        accumulator.pacingSignal.thirdActionAttempts += 1;
        if (action.type !== 'WAIT') {
            accumulator.pacingSignal.thirdActionAllowed += 1;
        }
    }

    switch (selectionSummary?.selectedRestedDecision) {
        case 'preserve':
            accumulator.pacingSignal.preservedRestedTurns += 1;
            break;
        case 'spend_battery':
            accumulator.pacingSignal.restedBatterySpendSelections += 1;
            break;
        case 'reenter':
            accumulator.pacingSignal.restedReentryTurns += 1;
            break;
        case 'true_rest':
            accumulator.pacingSignal.trueRestRestedBonusArmedTurns += 1;
            break;
        default:
            break;
    }
    if (selectionSummary?.selectedWaitForBandPreservation) {
        accumulator.pacingSignal.waitForBandPreservationSelections += 1;
    }

    if (action.type === 'WAIT') {
        const isRestSelection = !!state.player.ires && !state.player.ires.actedThisTurn && !state.player.ires.movedThisTurn;
        const waitPreview = resolveWaitPreview(state.player, state.ruleset);
        const projectedTurnEndSpark = Number(waitPreview.turnProjection.spark.projected || state.player.ires?.spark || 0)
            / Math.max(1, Number(state.player.ires?.maxSpark || 1));
        const turnEndBand = selectionSummary?.selectedSparkBandIfEndedNow || signals.aiSparkBand;
        if ((selectionSummary?.visibleOpponentCount || 0) > 0 && selectionSummary?.engagementMode !== 'recover') {
            accumulator.pacingSignal.idleWithVisibleHostile += 1;
        }
        if (isRestSelection) {
            accumulator.pacingSignal.restSelections += 1;
        } else {
            accumulator.pacingSignal.endTurnSelections += 1;
        }
        accumulator.pacingSignal.avgTurnEndSparkRatio += projectedTurnEndSpark;
        if (turnEndBand === 'rested_hold' || turnEndBand === 'rested_edge') {
            accumulator.pacingSignal.turnsEndedRested += 1;
            accumulator.pacingSignal.turnsEndedStableOrBetter += 1;
        } else if (turnEndBand === 'stable') {
            accumulator.pacingSignal.turnsEndedStableOrBetter += 1;
        } else if (turnEndBand === 'critical' || turnEndBand === 'exhausted') {
            accumulator.pacingSignal.turnsEndedCriticalOrExhausted += 1;
        }
    } else {
        accumulator.pacingSignal.continuedActionSelections += 1;
    }

    if (action.type === 'USE_SKILL') {
        incrementHistogram(accumulator.playerSkillUsage, action.payload.skillId);
        accumulator.totalPlayerSkillCasts += 1;
    }
};

export const recordPlayerSkillTransitionTelemetry = (
    accumulator: PlayerTurnTelemetryAccumulator,
    prev: GameState,
    next: GameState,
    action: Action,
    metrics: TransitionMetrics,
    turnMarker: number
): void => {
    if (action.type !== 'USE_SKILL') return;
    const skillId = action.payload.skillId;
    const prevTimelineCount = (prev.timelineEvents || []).length;
    const newTimelineEvents = (next.timelineEvents || []).slice(prevTimelineCount) as any[];
    const lavaSinks = newTimelineEvents.filter(e =>
        e && e.type === 'LavaSink' && e.actorId === prev.player.id && e.payload?.target && e.payload.target !== prev.player.id
    ).length;

    if (!accumulator.playerSkillTelemetry[skillId]) {
        accumulator.playerSkillTelemetry[skillId] = zeroSkillTelemetry();
    }
    const t = accumulator.playerSkillTelemetry[skillId];
    t.casts += 1;
    t.enemyDamage += metrics.enemyDamage;
    t.killShots += metrics.killShot;
    t.healingReceived += metrics.healingReceived;
    t.hazardDamage += metrics.hazardDamage;
    t.stairsProgress += metrics.stairsProgress;
    t.shrineProgress += metrics.shrineProgress;
    t.floorProgress += metrics.floorProgress;
    t.lavaSinks += lavaSinks;
    if (metrics.enemyDamage > 0 && accumulator.pacingSignal.firstDamageTurn === 0) {
        accumulator.pacingSignal.firstDamageTurn = turnMarker;
    }
};

export const recordPlayerAutoAttackTransitionTelemetry = (
    accumulator: PlayerTurnTelemetryAccumulator,
    prev: GameState,
    next: GameState,
    action: Action,
    turnMarker: number
): void => {
    const prevCombatCount = (prev.combatScoreEvents || []).length;
    const newCombatEvents = ((next.combatScoreEvents || []).slice(prevCombatCount) as any[]);
    const autoAttackEvents = newCombatEvents.filter(e =>
        e && e.attackerId === prev.player.id && e.skillId === 'AUTO_ATTACK'
    );
    if (autoAttackEvents.length === 0) return;

    const triggerKey = action.type === 'USE_SKILL'
        ? `USE_SKILL:${action.payload.skillId}`
        : action.type;
    incrementHistogram(accumulator.autoAttackTriggersByActionType, triggerKey);
    incrementHistogram(accumulator.playerSkillUsage, 'AUTO_ATTACK');

    if (!accumulator.playerSkillTelemetry.AUTO_ATTACK) {
        accumulator.playerSkillTelemetry.AUTO_ATTACK = zeroSkillTelemetry();
    }
    const t = accumulator.playerSkillTelemetry.AUTO_ATTACK;
    t.casts += 1;
    t.enemyDamage += autoAttackEvents.reduce((sum, e) => sum + Number(e.finalPower || 0), 0);
    if (t.enemyDamage > 0 && accumulator.pacingSignal.firstDamageTurn === 0) {
        accumulator.pacingSignal.firstDamageTurn = turnMarker;
    }
};

export const summarizePlayerCombatSignals = (
    state: GameState,
    playerId: string
): PlayerCombatSignals => {
    const combatEvents = ((state.combatScoreEvents || []) as any[])
        .filter(e => e && e.attackerId === playerId);

    const triangleSignal = combatEvents.length > 0
        ? {
            samples: combatEvents.length,
            avgHitPressure: combatEvents.reduce((acc, e) => acc + (e.hitPressure || 0), 0) / combatEvents.length,
            avgMitigationPressure: combatEvents.reduce((acc, e) => acc + (e.mitigationPressure || 0), 0) / combatEvents.length,
            avgCritPressure: combatEvents.reduce((acc, e) => acc + (e.critPressure || 0), 0) / combatEvents.length,
            avgResistancePressure: combatEvents.reduce((acc, e) => acc + (e.resistancePressure || 0), 0) / combatEvents.length,
        }
        : zeroTriangleSignal();

    const trinityContribution = combatEvents.length > 0
        ? {
            samples: combatEvents.length,
            bodyContribution: combatEvents.reduce((acc, e) => acc + (e.bodyContribution || 0), 0) / combatEvents.length,
            mindContribution: combatEvents.reduce((acc, e) => acc + (e.mindContribution || 0), 0) / combatEvents.length,
            instinctContribution: combatEvents.reduce((acc, e) => acc + (e.instinctContribution || 0), 0) / combatEvents.length,
        }
        : zeroTrinityContribution();

    const combatProfileSignal = combatEvents.length > 0
        ? {
            samples: combatEvents.length,
            avgOutgoingMultiplier: combatEvents.reduce((acc, e) => acc + Number(e.traitOutgoingMultiplier || 1), 0) / combatEvents.length,
            avgIncomingMultiplier: combatEvents.reduce((acc, e) => acc + Number(e.traitIncomingMultiplier || 1), 0) / combatEvents.length,
            avgTotalMultiplier: combatEvents.reduce((acc, e) => acc + Number(e.traitTotalMultiplier || 1), 0) / combatEvents.length,
        }
        : zeroCombatProfileSignal();

    return {
        triangleSignal,
        trinityContribution,
        combatProfileSignal
    };
};
