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
        policyProfileVersion
    } = runHarnessPlayerLoop({
        seed,
        policy,
        maxTurns,
        loadoutId,
        policyProfileId
    });

    const result: RunResult['result'] = state.gameStatus === 'won'
        ? 'won'
        : (state.gameStatus === 'lost' ? 'lost' : 'timeout');

    const {
        triangleSignal,
        trinityContribution,
        combatProfileSignal
    } = summarizePlayerCombatSignals(state, state.player.id);

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
