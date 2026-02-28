import { selectByOnePlySimulation } from '../ai/player/selector';
import { compareRuns } from './harness-matchup';
import { simulateHarnessRun, simulateHarnessRunDetailed } from './harness-simulation';
import type {
    ArchetypeLoadoutId,
    BotPolicy,
    MatchupRun,
    MatchupSide,
    RunResult,
    SimulatedRunDetailed
} from './harness-types';
import {
    runSeededHeadToHeadBatch,
    runSeededSimulationBatch,
} from './harness-core';
export { summarizeBatch } from './balance-harness-summary';
export { summarizeMatchup } from './harness-matchup';
export type {
    ArchetypeLoadoutId,
    BatchSummary,
    BotPolicy,
    CombatProfileSignalSummary,
    MatchupRun,
    MatchupSide,
    MatchupSummary,
    RunDiagnostics,
    RunResult,
    SimulatedRunDetailed,
    SkillTelemetry,
    TriangleSignalSummary,
    TrinityContributionSummary
} from './harness-types';

export { selectByOnePlySimulation };

export const simulateRun = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default'
): RunResult => {
    return simulateHarnessRun(seed, policy, maxTurns, loadoutId, policyProfileId);
};

export const simulateRunDetailed = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default'
): SimulatedRunDetailed => {
    return simulateHarnessRunDetailed(seed, policy, maxTurns, loadoutId, policyProfileId);
};

export const runBatch = (
    seeds: string[],
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default'
): RunResult[] => {
    return runSeededSimulationBatch(
        seeds,
        seed => simulateRun(seed, policy, maxTurns, loadoutId, policyProfileId)
    );
};

export const runHeadToHeadBatch = (
    seeds: string[],
    left: MatchupSide,
    right: MatchupSide,
    maxTurns = 80,
    leftPolicyProfileId = 'sp-v1-default',
    rightPolicyProfileId = 'sp-v1-default'
): MatchupRun[] => {
    return runSeededHeadToHeadBatch(
        seeds,
        seed => simulateRun(seed, left.policy, maxTurns, left.loadoutId, leftPolicyProfileId),
        seed => simulateRun(seed, right.policy, maxTurns, right.loadoutId, rightPolicyProfileId),
        (seed, leftRun, rightRun) => ({
            seed,
            left: leftRun,
            right: rightRun,
            winner: compareRuns(leftRun, rightRun)
        })
    );
};

