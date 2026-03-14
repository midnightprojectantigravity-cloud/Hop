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
        combatProfileSignal
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
