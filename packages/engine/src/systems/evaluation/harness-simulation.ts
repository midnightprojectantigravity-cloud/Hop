import { fingerprintFromState } from '../../logic';
import { computeScore } from '../score';
import { summarizePlayerCombatSignals } from '../ai/player/harness-telemetry';
import { runHarnessPlayerLoop } from '../ai/player/harness-runner';
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
    policyProfileId = 'sp-v1-default'
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
        policyProfileId
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
        strategicIntentCounts: telemetry.strategicIntentCounts,
        totalPlayerSkillCasts: telemetry.totalPlayerSkillCasts,
        playerSkillTelemetry: telemetry.playerSkillTelemetry,
        autoAttackTriggersByActionType: telemetry.autoAttackTriggersByActionType,
        triangleSignal,
        trinityContribution,
        combatProfileSignal,
        pacingSignal: telemetry.pacingSignal.samples > 0
            ? {
                samples: telemetry.pacingSignal.samples,
                avgSparkRatio: telemetry.pacingSignal.avgSparkRatio / telemetry.pacingSignal.samples,
                avgManaRatio: telemetry.pacingSignal.avgManaRatio / telemetry.pacingSignal.samples,
                avgReservePressure: telemetry.pacingSignal.avgReservePressure / telemetry.pacingSignal.samples,
                avgFatiguePressure: telemetry.pacingSignal.avgFatiguePressure / telemetry.pacingSignal.samples,
                avgRecoveryPressure: telemetry.pacingSignal.avgRecoveryPressure / telemetry.pacingSignal.samples,
                restSelections: telemetry.pacingSignal.restSelections,
                endTurnSelections: telemetry.pacingSignal.endTurnSelections,
                continuedActionSelections: telemetry.pacingSignal.continuedActionSelections
            }
            : {
                samples: 0,
                avgSparkRatio: 0,
                avgManaRatio: 0,
                avgReservePressure: 0,
                avgFatiguePressure: 0,
                avgRecoveryPressure: 0,
                restSelections: 0,
                endTurnSelections: 0,
                continuedActionSelections: 0
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
    policyProfileId = 'sp-v1-default'
): RunResult => {
    return simulateHarnessRunDetailed(seed, policy, maxTurns, loadoutId, policyProfileId).run;
};
