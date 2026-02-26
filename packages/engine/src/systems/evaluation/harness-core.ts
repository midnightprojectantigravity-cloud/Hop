import { randomFromSeed } from '../rng';

export const chooseFromSeeded = <T>(items: T[], seed: string, counter: number): T => {
    const idx = Math.floor(randomFromSeed(seed, counter) * items.length) % items.length;
    return items[idx];
};

export const mapSeedBatch = <T>(seeds: string[], simulate: (seed: string) => T): T[] =>
    seeds.map(seed => simulate(seed));

export const runSeededSimulationBatch = <T>(
    seeds: string[],
    simulateSeed: (seed: string) => T
): T[] => mapSeedBatch(seeds, simulateSeed);

export const runSeededHeadToHeadBatch = <TLeft, TRight, TCombined>(
    seeds: string[],
    simulateLeft: (seed: string) => TLeft,
    simulateRight: (seed: string) => TRight,
    combine: (seed: string, left: TLeft, right: TRight) => TCombined
): TCombined[] =>
    mapSeedBatch(seeds, seed => {
        const left = simulateLeft(seed);
        const right = simulateRight(seed);
        return combine(seed, left, right);
    });

export const average = (values: number[]): number =>
    values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) : 0;

export const incrementHistogram = (hist: Record<string, number>, key: string): void => {
    hist[key] = (hist[key] || 0) + 1;
};

export const mergeHistogram = (target: Record<string, number>, source: Record<string, number>): void => {
    for (const [key, value] of Object.entries(source)) {
        target[key] = (target[key] || 0) + value;
    }
};

export const averageHistogramPerEntry = (
    totals: Record<string, number>,
    sampleCount: number
): Record<string, number> => {
    const out: Record<string, number> = {};
    const divisor = sampleCount || 1;
    for (const [key, total] of Object.entries(totals)) {
        out[key] = total / divisor;
    }
    return out;
};

export const summarizeCategoricalOutcomes = <T extends string>(
    values: readonly T[],
    categories: readonly T[]
): {
    total: number;
    counts: Record<T, number>;
    rates: Record<T, number>;
} => {
    const counts = {} as Record<T, number>;
    for (const category of categories) {
        counts[category] = 0;
    }
    for (const value of values) {
        counts[value] = (counts[value] || 0) + 1;
    }

    const total = values.length;
    const rates = {} as Record<T, number>;
    for (const category of categories) {
        rates[category] = total ? counts[category] / total : 0;
    }

    return { total, counts, rates };
};
