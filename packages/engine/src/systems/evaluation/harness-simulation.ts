import { fingerprintFromState } from '../../logic';
import type { GameState, GridSize, MapShape } from '../../types';
import { computeScore } from '../score';
import { summarizePlayerCombatSignals } from '../ai/player/harness-telemetry';
import { runHarnessPlayerLoop } from '../ai/player/harness-runner';
import {
    cloneEnemyAiRunTelemetry,
    createEmptyEnemyAiRunTelemetry,
    deriveEnemyCombatTelemetryFromState
} from '../ai/enemy/runtime-telemetry';
import type {
    ArchetypeLoadoutId,
    BotPolicy,
    RunResult,
    SimulatedRunDetailed
} from './harness-types';

export const simulateHarnessRunDetailed = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    startFloor = 1,
    mapSize?: GridSize,
    mapShape?: MapShape,
    initialState?: GameState
): SimulatedRunDetailed => {
    const {
        state,
        telemetry,
        peakPlayerExhaustion,
        policyProfileVersion,
        terminalOverride
    } = runHarnessPlayerLoop({
        seed,
        policy,
        maxTurns,
        loadoutId,
        policyProfileId,
        startFloor,
        mapSize,
        mapShape,
        initialState
    });

    const result: RunResult['result'] = terminalOverride || (state.gameStatus === 'won'
        ? 'won'
        : (state.gameStatus === 'lost' ? 'lost' : 'timeout'));

    const {
        triangleSignal,
        trinityContribution,
        combatProfileSignal
    } = summarizePlayerCombatSignals(state, state.player.id);
    const totalPlayerActions = Object.entries(telemetry.playerActionCounts || {}).reduce(
        (sum, [actionType, count]) => sum + (actionType === 'WAIT' ? 0 : count),
        0
    );
    const observedPlayerTurns = Math.max(0, state.turnsSpent || 0)
        + ((Number(state.player.ires?.actionCountThisTurn || 0) > 0 && totalPlayerActions > 0) ? 1 : 0);
    const avgActionsPerPlayerTurn = observedPlayerTurns > 0
        ? totalPlayerActions / observedPlayerTurns
        : 0;
    const finalSpark = Number(state.player.ires?.spark || 0);
    const finalMana = Number(state.player.ires?.mana || 0);
    const finalSparkState = state.player.ires?.currentState || 'base';
    const finalSparkRatio = Number(state.player.ires?.spark || 0) / Math.max(1, Number(state.player.ires?.maxSpark || 1));
    const finalExhaustion = Number(state.player.ires?.exhaustion || 0);
    const runTelemetry = state.runTelemetry || {
        restTurns: 0,
        redlineActions: 0,
        sparkBurnHpLost: 0
    };
    const enemyAiTelemetry = cloneEnemyAiRunTelemetry(state.enemyAiTelemetry || createEmptyEnemyAiRunTelemetry());
    const derivedEnemyCombatTelemetry = deriveEnemyCombatTelemetryFromState(state);
    if (Object.keys(enemyAiTelemetry.skillUsage).length === 0 && Object.keys(derivedEnemyCombatTelemetry.skillUsage || {}).length > 0) {
        enemyAiTelemetry.skillUsage = { ...(derivedEnemyCombatTelemetry.skillUsage || {}) };
    }
    if (Object.keys(enemyAiTelemetry.actionCounts).length === 0 && Number(derivedEnemyCombatTelemetry.offensiveSkillCasts || 0) > 0) {
        enemyAiTelemetry.actionCounts = {
            USE_SKILL: Number(derivedEnemyCombatTelemetry.offensiveSkillCasts || 0)
        };
    }
    enemyAiTelemetry.offensiveSkillCasts = Math.max(
        enemyAiTelemetry.offensiveSkillCasts,
        Number(derivedEnemyCombatTelemetry.offensiveSkillCasts || 0)
    );
    enemyAiTelemetry.damageToPlayer = Math.max(
        enemyAiTelemetry.damageToPlayer,
        Number(derivedEnemyCombatTelemetry.damageToPlayer || 0)
    );
    enemyAiTelemetry.attackOpportunityTurns = Math.max(
        enemyAiTelemetry.attackOpportunityTurns,
        Number(derivedEnemyCombatTelemetry.attackOpportunityTurns || 0)
    );
    enemyAiTelemetry.attackConversionTurns = Math.max(
        enemyAiTelemetry.attackConversionTurns,
        Number(derivedEnemyCombatTelemetry.attackConversionTurns || 0)
    );
    const directorState = state.generationState?.directorState;

    const run: RunResult = {
        seed,
        policy,
        policyProfileId: policyProfileVersion,
        loadoutId,
        result,
        turnsSpent: state.turnsSpent || 0,
        floor: state.floor,
        kills: state.kills || 0,
        hazardBreaches: state.hazardBreaches || 0,
        score: computeScore(state),
        finalPlayerHp: state.player.hp || 0,
        finalPlayerMaxHp: Math.max(1, state.player.maxHp || 1),
        finalPlayerHpRatio: (state.player.hp || 0) / Math.max(1, state.player.maxHp || 1),
        finalSpark,
        finalMana,
        finalSparkState,
        finalSparkRatio,
        finalExhaustion,
        peakExhaustion: peakPlayerExhaustion,
        restTurns: Number(runTelemetry.restTurns || 0),
        redlineActions: Number(runTelemetry.redlineActions || 0),
        sparkBurnDamage: Number(runTelemetry.sparkBurnHpLost || 0),
        avgActionsPerPlayerTurn,
        directorRedlineBand: Number(directorState?.redlineBand || 0),
        directorResourceStressBand: Number(directorState?.resourceStressBand || 0),
        playerActionCounts: telemetry.playerActionCounts,
        playerSkillUsage: telemetry.playerSkillUsage,
        goalCounts: telemetry.goalCounts,
        totalPlayerSkillCasts: telemetry.totalPlayerSkillCasts,
        playerSkillTelemetry: telemetry.playerSkillTelemetry,
        autoAttackTriggersByActionType: telemetry.autoAttackTriggersByActionType,
        triangleSignal,
        trinityContribution,
        combatProfileSignal,
        enemyAiTelemetry,
        pacingSignal: telemetry.pacingSignal.samples > 0
            ? {
                samples: telemetry.pacingSignal.samples,
                avgSparkRatio: telemetry.pacingSignal.avgSparkRatio / telemetry.pacingSignal.samples,
                avgManaRatio: telemetry.pacingSignal.avgManaRatio / telemetry.pacingSignal.samples,
                avgReservePressure: telemetry.pacingSignal.avgReservePressure / telemetry.pacingSignal.samples,
                avgFatiguePressure: telemetry.pacingSignal.avgFatiguePressure / telemetry.pacingSignal.samples,
                avgRecoveryPressure: telemetry.pacingSignal.avgRecoveryPressure / telemetry.pacingSignal.samples,
                avgTurnEndSparkRatio: telemetry.pacingSignal.avgTurnEndSparkRatio / Math.max(1, telemetry.pacingSignal.restSelections + telemetry.pacingSignal.endTurnSelections),
                visibleHostileSelections: telemetry.pacingSignal.visibleHostileSelections,
                idleWithVisibleHostile: telemetry.pacingSignal.idleWithVisibleHostile,
                attackOpportunityCount: telemetry.pacingSignal.attackOpportunityCount,
                attackConversionCount: telemetry.pacingSignal.attackConversionCount,
                threatenNextTurnOpportunityCount: telemetry.pacingSignal.threatenNextTurnOpportunityCount,
                threatenNextTurnConversionCount: telemetry.pacingSignal.threatenNextTurnConversionCount,
                backtrackMoveCount: telemetry.pacingSignal.backtrackMoveCount,
                loopMoveCount: telemetry.pacingSignal.loopMoveCount,
                lowValueMobilitySelections: telemetry.pacingSignal.lowValueMobilitySelections,
                restSelections: telemetry.pacingSignal.restSelections,
                endTurnSelections: telemetry.pacingSignal.endTurnSelections,
                continuedActionSelections: telemetry.pacingSignal.continuedActionSelections,
                preservedRestedTurns: telemetry.pacingSignal.preservedRestedTurns,
                restedBatterySpendSelections: telemetry.pacingSignal.restedBatterySpendSelections,
                restedReentryTurns: telemetry.pacingSignal.restedReentryTurns,
                trueRestRestedBonusArmedTurns: telemetry.pacingSignal.trueRestRestedBonusArmedTurns,
                voluntaryExhaustionAttempts: telemetry.pacingSignal.voluntaryExhaustionAttempts,
                voluntaryExhaustionAllowed: telemetry.pacingSignal.voluntaryExhaustionAllowed,
                voluntaryExhaustionBlocked: telemetry.pacingSignal.voluntaryExhaustionBlocked,
                turnsEndedRested: telemetry.pacingSignal.turnsEndedRested,
                turnsEndedStableOrBetter: telemetry.pacingSignal.turnsEndedStableOrBetter,
                turnsEndedCriticalOrExhausted: telemetry.pacingSignal.turnsEndedCriticalOrExhausted,
                secondActionAttempts: telemetry.pacingSignal.secondActionAttempts,
                secondActionAllowed: telemetry.pacingSignal.secondActionAllowed,
                thirdActionAttempts: telemetry.pacingSignal.thirdActionAttempts,
                thirdActionAllowed: telemetry.pacingSignal.thirdActionAllowed,
                waitForBandPreservationSelections: telemetry.pacingSignal.waitForBandPreservationSelections,
                firstContactTurn: telemetry.pacingSignal.firstContactTurn,
                firstDamageTurn: telemetry.pacingSignal.firstDamageTurn
            }
            : {
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
            }
    };

    return {
        run,
        diagnostics: {
            actionLog: [...(state.actionLog || [])],
            stateFingerprint: fingerprintFromState(state)
        }
    };
};

export const simulateHarnessRun = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    startFloor = 1,
    mapSize?: GridSize,
    mapShape?: MapShape,
    initialState?: GameState
): RunResult => {
    return simulateHarnessRunDetailed(seed, policy, maxTurns, loadoutId, policyProfileId, startFloor, mapSize, mapShape, initialState).run;
};
