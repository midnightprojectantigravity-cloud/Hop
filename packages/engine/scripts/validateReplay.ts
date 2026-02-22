#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { generateInitialState, gameReducer } from '../src/logic.ts';
import { safeParse } from '../src/systems/serialization.ts';

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

const actions = parsed.actions ?? parsed.actionLog ?? parsed;
const seed = parsed.seed ?? parsed.meta?.seed ?? '';

console.log('Replaying', full, 'seed=', seed, 'actions=', actions?.length ?? 0);
const init = generateInitialState(1, seed || '', seed || '');
let s = init;
try {
  for (const a of actions) {
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
