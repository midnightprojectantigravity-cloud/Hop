#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { generateInitialState, gameReducer } from '../src/logic.ts';
import { safeParse } from '../src/systems/serialization.ts';
import { validateReplayEnvelopeV3 } from '../src/systems/replay-validation.ts';

const usage = () => {
  console.log('Usage: validateReplay <replay.json>');
  process.exit(1);
};

const file = process.argv[2];
if (!file) usage();

const full = path.resolve(process.cwd(), file);
if (!fs.existsSync(full)) {
  console.error('File not found:', full);
  process.exit(2);
}

const txt = fs.readFileSync(full, 'utf-8');
let parsed: any;
try {
  parsed = safeParse(txt);
} catch (e) {
  try { parsed = JSON.parse(txt); } catch { console.error('Failed to parse replay file'); process.exit(3); }
}

const envelopeCandidate = parsed?.replay ?? parsed;
const replayValidation = validateReplayEnvelopeV3(envelopeCandidate);
if (!replayValidation.valid || !replayValidation.envelope) {
  console.error('ReplayEnvelopeV3 validation failed:', replayValidation.errors.join(' | '));
  process.exit(5);
}

const replay = replayValidation.envelope;
const seed = replay.run.seed;
const startFloor = replay.run.startFloor ?? 1;
const initialSeed = replay.run.initialSeed ?? seed;

console.log('Replaying', full, 'seed=', seed, 'actions=', replay.actions.length);
const init = generateInitialState(startFloor, seed || '', initialSeed || '');
let s = init;
try {
  for (const a of replay.actions) {
    s = gameReducer(s, a);
  }
  // Print a small fingerprint
  const fingerprint = (() => {
    const p = s.player;
    const enemies = s.enemies.map((e:any) => ({ id: e.id, subtype: e.subtype, hp: e.hp, position: e.position }));
    const obj = {
      player: { id: p.id, subtype: p.subtype, hp: p.hp, maxHp: p.maxHp, position: p.position },
      enemies,
      floor: s.floor,
      turnNumber: s.turnNumber,
      upgrades: s.upgrades
    };
    return JSON.stringify(obj);
  })();
  console.log('Replay applied. Fingerprint:', fingerprint);
  process.exit(0);
} catch (e:any) {
  console.error('Error during replay:', e && e.stack ? e.stack : e);
  process.exit(4);
}
