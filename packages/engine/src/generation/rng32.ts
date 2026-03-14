const hashStrToUint32 = (value: string): number => {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash >>> 0;
};

export interface Rng32 {
    nextUint32(): number;
    nextInt(maxExclusive: number): number;
}

export const createRng32 = (seed: string): Rng32 => {
    let state = hashStrToUint32(seed) || 1;

    const nextUint32 = (): number => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0;
        return (t ^ (t >>> 14)) >>> 0;
    };

    return {
        nextUint32,
        nextInt(maxExclusive: number): number {
            if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) return 0;
            return nextUint32() % maxExclusive;
        }
    };
};

export const shuffleStable = <T>(values: readonly T[], rng: Rng32): T[] => {
    const next = [...values];
    for (let i = next.length - 1; i > 0; i--) {
        const j = rng.nextInt(i + 1);
        const temp = next[i];
        next[i] = next[j];
        next[j] = temp;
    }
    return next;
};

export const pickByIndex = <T>(values: readonly T[], rng: Rng32): T | undefined => {
    if (values.length === 0) return undefined;
    return values[rng.nextInt(values.length)];
};
