export type RNG = { next: () => number; id: (len?: number) => string };

// Simple string -> uint32 hash (xfnv1a)
const hashStrToUint = (str: string) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

// Mulberry32 PRNG (small, fast, deterministic). Accepts uint32 seed.
const mulberry32 = (a: number) => {
  return function () {
    let t = (a += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createRng = (seed: string | number = Date.now()): RNG => {
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
 * Deterministic random float derived from a seed and an integer counter.
 * Useful when you want to avoid storing a live RNG instance in state.
 */
export const randomFromSeed = (seed: string | number, counter: number): number => {
  const s = `${seed}:${counter}`;
  return createRng(s).next();
};

// Helpers to consume deterministic random values from a GameState
import type { GameState } from './types';

/**
 * Consume a deterministic random float based on the state's seed + counter.
 * Returns { value, nextState } where nextState has rngCounter incremented.
 */
export const consumeRandom = (state: GameState): { value: number; nextState: GameState } => {
  // Prefer explicit run seeds; if none present, use a fixed '0' seed to keep behavior deterministic
  const seed = state.initialSeed ?? state.rngSeed ?? '0';
  const counter = state.rngCounter ?? 0;
  const value = randomFromSeed(seed, counter);
  const nextState: GameState = { ...state, rngCounter: counter + 1 };
  return { value, nextState };
};

/**
 * Generate a deterministic id string using state's RNG counter and increment it.
 */
export const nextIdFromState = (state: GameState, len = 9): { id: string; nextState: GameState } => {
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
