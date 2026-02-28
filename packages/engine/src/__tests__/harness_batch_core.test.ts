import { describe, expect, it } from 'vitest';
import { runSeededHeadToHeadBatch, runSeededSimulationBatch } from '../systems/evaluation/harness-core';
import { runHarnessHeadToHeadBatch, runHarnessSimulationBatch } from '../systems/evaluation/harness-batch';

describe('harness batch core wrappers', () => {
    it('matches legacy seeded simulation batch behavior', () => {
        const seeds = ['seed-a', 'seed-b', 'seed-c'];
        const simulate = (seed: string) => ({ seed, value: `${seed}:run` });

        const legacy = runSeededSimulationBatch(seeds, simulate);
        const unified = runHarnessSimulationBatch({ seeds }, simulate);

        expect(unified).toEqual(legacy);
    });

    it('matches legacy seeded head-to-head batch behavior', () => {
        const seeds = ['h2h-a', 'h2h-b'];
        const left = (seed: string) => `${seed}:L`;
        const right = (seed: string) => `${seed}:R`;
        const combine = (seed: string, l: string, r: string) => `${seed}|${l}|${r}`;

        const legacy = runSeededHeadToHeadBatch(seeds, left, right, combine);
        const unified = runHarnessHeadToHeadBatch({ seeds }, left, right, combine);

        expect(unified).toEqual(legacy);
    });
});

