#!/usr/bin/env node
import { createRng, randomFromSeed, consumeRandom, nextIdFromState } from '../src/systems/rng.ts';
import crypto from 'crypto';

type RngProbeState = {
  rngSeed: string;
  rngCounter: number;
};

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('Usage: checkRngParity <seed> [count]');
  process.exit(1);
}

const seed = args[0];
const count = Number(args[1] || 20);

const rng = createRng(seed);
const values: number[] = [];
const ids: string[] = [];

for (let i = 0; i < count; i++) {
  values.push(rng.next());
}

// Also exercise stateful consumeRandom/nextIdFromState
let state: RngProbeState = { rngSeed: seed, rngCounter: 0 };
for (let i = 0; i < Math.min(10, count); i++) {
  const res = consumeRandom(state);
  values.push(res.value);
  state = res.nextState;
}

// deterministic id from state
const idRes = nextIdFromState({ rngSeed: seed, rngCounter: 0 }, Math.min(9, count));
ids.push(idRes.id);

const out = { seed, count, values, ids };
const fingerprint = crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');

console.log(JSON.stringify({ out, fingerprint }, null, 2));
