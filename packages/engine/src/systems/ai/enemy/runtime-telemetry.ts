import { SkillRegistry } from '../../../skillRegistry';
import type { EnemyAiRunTelemetry, GameState } from '../../../types';
import type { GenericUnitAiCandidateFacts, GenericUnitAiSelectionSummary } from '../generic-unit-ai';

export const createEmptyEnemyAiRunTelemetry = (): EnemyAiRunTelemetry => ({
    actionCounts: {},
    skillUsage: {},
    offensiveSkillCasts: 0,
    damageToPlayer: 0,
    visiblePlayerTurns: 0,
    idleWithVisiblePlayer: 0,
    attackOpportunityTurns: 0,
    attackConversionTurns: 0,
    threatOpportunityTurns: 0,
    threatConversionTurns: 0,
    backtrackMoves: 0,
    loopMoves: 0,
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
    waitForBandPreservationSelections: 0
});

export const cloneEnemyAiRunTelemetry = (value?: Partial<EnemyAiRunTelemetry>): EnemyAiRunTelemetry => ({
    actionCounts: { ...(value?.actionCounts || {}) },
    skillUsage: { ...(value?.skillUsage || {}) },
    offensiveSkillCasts: Number(value?.offensiveSkillCasts || 0),
    damageToPlayer: Number(value?.damageToPlayer || 0),
    visiblePlayerTurns: Number(value?.visiblePlayerTurns || 0),
    idleWithVisiblePlayer: Number(value?.idleWithVisiblePlayer || 0),
    attackOpportunityTurns: Number(value?.attackOpportunityTurns || 0),
    attackConversionTurns: Number(value?.attackConversionTurns || 0),
    threatOpportunityTurns: Number(value?.threatOpportunityTurns || 0),
    threatConversionTurns: Number(value?.threatConversionTurns || 0),
    backtrackMoves: Number(value?.backtrackMoves || 0),
    loopMoves: Number(value?.loopMoves || 0),
    preservedRestedTurns: Number(value?.preservedRestedTurns || 0),
    restedBatterySpendSelections: Number(value?.restedBatterySpendSelections || 0),
    restedReentryTurns: Number(value?.restedReentryTurns || 0),
    trueRestRestedBonusArmedTurns: Number(value?.trueRestRestedBonusArmedTurns || 0),
    voluntaryExhaustionAttempts: Number(value?.voluntaryExhaustionAttempts || 0),
    voluntaryExhaustionAllowed: Number(value?.voluntaryExhaustionAllowed || 0),
    voluntaryExhaustionBlocked: Number(value?.voluntaryExhaustionBlocked || 0),
    turnsEndedRested: Number(value?.turnsEndedRested || 0),
    turnsEndedStableOrBetter: Number(value?.turnsEndedStableOrBetter || 0),
    turnsEndedCriticalOrExhausted: Number(value?.turnsEndedCriticalOrExhausted || 0),
    secondActionAttempts: Number(value?.secondActionAttempts || 0),
    secondActionAllowed: Number(value?.secondActionAllowed || 0),
    thirdActionAttempts: Number(value?.thirdActionAttempts || 0),
    thirdActionAllowed: Number(value?.thirdActionAllowed || 0),
    waitForBandPreservationSelections: Number(value?.waitForBandPreservationSelections || 0)
});

export const incrementEnemyAiHistogram = (hist: Record<string, number>, key: string): Record<string, number> => ({
    ...hist,
    [key]: Number(hist[key] || 0) + 1
});

export const isOffensiveEnemySkill = (skillId?: string): boolean => {
    if (!skillId || skillId === 'WAIT_SKILL' || skillId === 'BASIC_MOVE') return false;
    const profile = SkillRegistry.get(skillId)?.intentProfile;
    if (!profile) return false;
    return profile.intentTags.some(tag => tag === 'damage' || tag === 'control' || tag === 'hazard');
};

export interface RecordEnemyAiTurnTelemetryParams {
    telemetry?: Partial<EnemyAiRunTelemetry>;
    playerId: string;
    actionType: string;
    skillId?: string;
    selectedFacts?: GenericUnitAiCandidateFacts;
    selectionSummary?: GenericUnitAiSelectionSummary;
    playerHpBefore: number;
    playerHpAfter: number;
}

export const recordEnemyAiTurnTelemetry = ({
    telemetry,
    playerId,
    actionType,
    skillId,
    selectedFacts,
    selectionSummary,
    playerHpBefore,
    playerHpAfter
}: RecordEnemyAiTurnTelemetryParams): EnemyAiRunTelemetry => {
    const next = cloneEnemyAiRunTelemetry(telemetry);

    next.actionCounts = incrementEnemyAiHistogram(next.actionCounts, actionType);
    if (skillId && skillId !== 'WAIT_SKILL') {
        next.skillUsage = incrementEnemyAiHistogram(next.skillUsage, skillId);
    }
    if (isOffensiveEnemySkill(skillId)) {
        next.offensiveSkillCasts += 1;
    }

    const playerVisible = !!selectionSummary?.visibleOpponentIds.includes(playerId);
    if (playerVisible) {
        next.visiblePlayerTurns += 1;
    }
    if (playerVisible && actionType === 'WAIT' && selectionSummary?.engagementMode !== 'recover') {
        next.idleWithVisiblePlayer += 1;
    }
    if (selectionSummary?.attackOpportunityAvailable) {
        next.attackOpportunityTurns += 1;
    }
    if (selectedFacts?.canDamageNow) {
        next.attackConversionTurns += 1;
    }
    if (selectionSummary?.threatOpportunityAvailable) {
        next.threatOpportunityTurns += 1;
    }
    if (!selectedFacts?.canDamageNow && selectedFacts?.createsThreatNextDecision) {
        next.threatConversionTurns += 1;
    }
    if (selectedFacts?.backtracks) {
        next.backtrackMoves += 1;
    }
    if (
        selectedFacts
        && !selectedFacts.canDamageNow
        && !selectedFacts.createsThreatNextDecision
        && !selectedFacts.improvesObjective
        && !selectedFacts.reducesExposureMaterially
    ) {
        next.loopMoves += 1;
    }

    next.voluntaryExhaustionAttempts += Number(selectionSummary?.voluntaryExhaustionAttemptCount || 0);
    next.voluntaryExhaustionAllowed += Number(selectionSummary?.voluntaryExhaustionAllowedCount || 0);
    next.voluntaryExhaustionBlocked += Number(selectionSummary?.voluntaryExhaustionBlockedCount || 0);
    if (selectionSummary?.selectedActionOrdinal === 2) {
        next.secondActionAttempts += 1;
        if (actionType !== 'WAIT') next.secondActionAllowed += 1;
    }
    if ((selectionSummary?.selectedActionOrdinal || 0) >= 3) {
        next.thirdActionAttempts += 1;
        if (actionType !== 'WAIT') next.thirdActionAllowed += 1;
    }
    switch (selectionSummary?.selectedRestedDecision) {
        case 'preserve':
            next.preservedRestedTurns += 1;
            break;
        case 'spend_battery':
            next.restedBatterySpendSelections += 1;
            break;
        case 'reenter':
            next.restedReentryTurns += 1;
            break;
        case 'true_rest':
            next.trueRestRestedBonusArmedTurns += 1;
            break;
        default:
            break;
    }
    if (selectionSummary?.selectedWaitForBandPreservation) {
        next.waitForBandPreservationSelections += 1;
    }
    const turnEndBand = selectionSummary?.selectedSparkBandIfEndedNow;
    if (turnEndBand === 'rested_hold' || turnEndBand === 'rested_edge') {
        next.turnsEndedRested += 1;
        next.turnsEndedStableOrBetter += 1;
    } else if (turnEndBand === 'stable') {
        next.turnsEndedStableOrBetter += 1;
    } else if (turnEndBand === 'critical' || turnEndBand === 'exhausted') {
        next.turnsEndedCriticalOrExhausted += 1;
    }

    next.damageToPlayer += Math.max(0, Number(playerHpBefore || 0) - Number(playerHpAfter || 0));
    return next;
};

export const deriveEnemyCombatTelemetryFromState = (state: GameState): Partial<EnemyAiRunTelemetry> => {
    const derivedSkillUsage: Record<string, number> = {};
    let offensiveSkillCasts = 0;
    let damageToPlayer = 0;
    let attackOpportunityTurns = 0;
    let attackConversionTurns = 0;

    for (const event of state.combatScoreEvents || []) {
        if (!event || event.targetId !== state.player.id || event.attackerId === state.player.id) continue;
        const skillId = String(event.skillId || 'UNKNOWN_SKILL');
        derivedSkillUsage[skillId] = Number(derivedSkillUsage[skillId] || 0) + 1;
        attackOpportunityTurns += 1;
        const finalPower = Math.max(0, Number(event.finalPower || 0));
        if (finalPower > 0) {
            damageToPlayer += finalPower;
            attackConversionTurns += 1;
        }
        if (isOffensiveEnemySkill(skillId)) {
            offensiveSkillCasts += 1;
        }
    }

    return {
        skillUsage: derivedSkillUsage,
        offensiveSkillCasts,
        damageToPlayer,
        attackOpportunityTurns,
        attackConversionTurns
    };
};
