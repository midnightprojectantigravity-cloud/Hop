import { selectByOnePlySimulation } from '../ai/player/selector';
import type { GridSize, MapShape } from '../../types';
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
    runHarnessHeadToHeadBatch,
    runHarnessSimulationBatch,
} from './harness-batch';
export { summarizeBatch } from './balance-harness-summary';
export { summarizeMatchup } from './harness-matchup';
export {
    buildFloor10ButcherDuelState,
    runFloor10ButcherDuelBatch,
    simulateFloor10ButcherDuel,
    simulateFloor10ButcherDuelDetailed
} from './floor10-butcher-duel';
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

export interface HarnessMapOptions {
    mapSize?: GridSize;
    mapShape?: MapShape;
}

export const simulateRun = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    startFloor = 1,
    options?: HarnessMapOptions
): RunResult => {
    return simulateHarnessRun(seed, policy, maxTurns, loadoutId, policyProfileId, startFloor, options?.mapSize, options?.mapShape);
};

export const simulateRunDetailed = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    startFloor = 1,
    options?: HarnessMapOptions
): SimulatedRunDetailed => {
    return simulateHarnessRunDetailed(seed, policy, maxTurns, loadoutId, policyProfileId, startFloor, options?.mapSize, options?.mapShape);
};

export const runBatch = (
    seeds: string[],
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    startFloor = 1,
    options?: HarnessMapOptions
): RunResult[] => {
    return runHarnessSimulationBatch(
        { seeds },
        seed => simulateRun(seed, policy, maxTurns, loadoutId, policyProfileId, startFloor, options)
    );
};

export const runHeadToHeadBatch = (
    seeds: string[],
    left: MatchupSide,
    right: MatchupSide,
    maxTurns = 80,
    leftPolicyProfileId = 'sp-v1-default',
    rightPolicyProfileId = 'sp-v1-default',
    startFloor = 1,
    options?: HarnessMapOptions
): MatchupRun[] => {
    return runHarnessHeadToHeadBatch(
        { seeds },
        seed => simulateRun(seed, left.policy, maxTurns, left.loadoutId, leftPolicyProfileId, startFloor, options),
        seed => simulateRun(seed, right.policy, maxTurns, right.loadoutId, rightPolicyProfileId, startFloor, options),
        (seed, leftRun, rightRun) => ({
            seed,
            left: leftRun,
            right: rightRun,
            winner: compareRuns(leftRun, rightRun)
        })
    );
};

