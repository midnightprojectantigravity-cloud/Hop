import { runSeededHeadToHeadBatch, runSeededSimulationBatch } from './harness-core';

export interface HarnessBatchOptions {
    seeds: string[];
}

export interface HarnessRunRecord<TResult> {
    seed: string;
    result: TResult;
}

export interface HarnessSummaryEnvelope<TRun, TSummary> {
    runs: TRun[];
    summary: TSummary;
}

const normalizeSeeds = (seeds: string[]): string[] =>
    seeds.map(seed => String(seed)).filter(seed => seed.length > 0);

export const runHarnessSimulationBatch = <TRun>(
    options: HarnessBatchOptions,
    simulateSeed: (seed: string) => TRun
): TRun[] => runSeededSimulationBatch(normalizeSeeds(options.seeds), simulateSeed);

export const runHarnessHeadToHeadBatch = <TLeft, TRight, TCombined>(
    options: HarnessBatchOptions,
    simulateLeft: (seed: string) => TLeft,
    simulateRight: (seed: string) => TRight,
    combine: (seed: string, left: TLeft, right: TRight) => TCombined
): TCombined[] =>
    runSeededHeadToHeadBatch(normalizeSeeds(options.seeds), simulateLeft, simulateRight, combine);

