#!/usr/bin/env node
import crypto from 'crypto';

// Local deterministic RNG implementation (copied from engine/src/rng.ts)
const hashStrToUint = (str) => {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
};

const mulberry32 = (a) => {
  return function () {
    let t = (a += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const createRng = (seed = Date.now()) => {
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

const randomFromSeed = (seed, counter) => {
  const s = `${seed}:${counter}`;
  return createRng(s).next();
};

const consumeRandom = (state) => {
  const seed = state.initialSeed ?? state.rngSeed ?? '0';
  const counter = state.rngCounter ?? 0;
  const value = randomFromSeed(seed, counter);
  const nextState = { ...state, rngCounter: counter + 1 };
  return { value, nextState };
};

const nextIdFromState = (state, len = 9) => {
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

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: checkRngParity <seed> [count]');
  process.exit(1);
}

const seed = args[0];
const count = Number(args[1] || 20);

const rng = createRng(seed);
const values = [];
const ids = [];

for (let i = 0; i < count; i++) {
  values.push(rng.next());
}

let state = { rngSeed: seed, rngCounter: 0 };
for (let i = 0; i < Math.min(10, count); i++) {
  const res = consumeRandom(state);
  values.push(res.value);
  state = res.nextState;
}

const idRes = nextIdFromState({ rngSeed: seed, rngCounter: 0 }, Math.min(9, count));
ids.push(idRes.id);

const out = { seed, count, values, ids };
const fingerprint = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');

console.log(JSON.stringify({ out, fingerprint }, null, 2));
