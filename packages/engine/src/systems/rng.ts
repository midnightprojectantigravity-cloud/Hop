import type { GameState } from '../types';

// 1. Unified Hash Function (xfnv1a)
const hashStrToUint = (str: string): number => {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
};

// 2. Deterministic PRNG (Mulberry32)
const mulberry32 = (a: number) => {
    return function () {
        let t = (a += 0x6D2B79F5) >>> 0;
        t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * Creates a deterministic RNG instance.
 * FIXED: No longer uses Math.random()
 */
export const createRng = (seed: string | number) => {
    const seedNum = typeof seed === 'number' ? (seed >>> 0) : hashStrToUint(String(seed));
    const rnd = mulberry32(seedNum || 1);

    return {
        next: () => rnd(),
        id: (len = 9) => {
            const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let out = '';
            for (let i = 0; i < len; i++) {
                const idx = Math.floor(rnd() * alphabet.length) % alphabet.length;
                out += alphabet[idx];
            }
            return out;
        }
    };
};

/**
 * FIXED: Added randomFromSeed
 * Use this for stateless random checks.
 */
export const randomFromSeed = (seed: string | number, counter: number): number => {
    const s = `${seed}:${counter}`;
    return createRng(s).next();
};

/**
 * Consumes the next random value from the state's entropy pool.
 */
export const consumeRandom = (state: GameState): { value: number; nextState: GameState } => {
    const seed = state.rngSeed || 'default';
    const counter = state.rngCounter || 0;

    const value = randomFromSeed(seed, counter);

    return {
        value,
        nextState: {
            ...state,
            rngCounter: counter + 1
        }
    };
};

/**
 * Generate a deterministic id string using state's RNG counter and increment it.
 * This satisfies the test's expectation for { id, nextState }
 */
export const nextIdFromState = (
    state: GameState,
    len = 9
): { id: string; nextState: GameState } => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    let cur = state;

    for (let i = 0; i < len; i++) {
        const { value, nextState } = consumeRandom(cur);
        cur = nextState;
        const idx = Math.floor(value * alphabet.length) % alphabet.length;
        s += alphabet[idx];
    }

    return { id: s, nextState: cur };
};