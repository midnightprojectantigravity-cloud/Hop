// Minimal verifier that re-implements the deterministic parts of the game logic
// needed to replay actions and produce a fingerprint. This is a small, somewhat
// duplicated subset of the client-side logic intentionally kept independent so
// the server can verify client submissions without importing the TS client code.

// RNG (mulberry32 + string hash)
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

const createRng = (seed) => {
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

// Hex utilities
const createHex = (q, r) => ({ q, r, s: -q - r });
const hexEquals = (a, b) => a.q === b.q && a.r === b.r && a.s === b.s;
const hexDistance = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
const DIRECTIONS = [createHex(1,0), createHex(1,-1), createHex(0,-1), createHex(-1,0), createHex(-1,1), createHex(0,1)];
const getNeighbors = (hex) => DIRECTIONS.map(d => createHex(hex.q + d.q, hex.r + d.r));
const getGridCells = (radius) => {
  const cells = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) cells.push(createHex(q, r));
  }
  return cells;
};

// Simple actor helpers
const applyDamage = (actor, amount) => ({ ...actor, hp: Math.max(0, actor.hp - amount) });

// Enemy AI (mirrors client behavior and consumes RNG via state.rngCounter)
const randomFromSeed = (seed, counter) => createRng(`${seed}:${counter}`).next();

const consumeRandom = (state) => {
  const seed = state.initialSeed ?? state.rngSeed ?? '0';
  const counter = state.rngCounter ?? 0;
  const value = randomFromSeed(seed, counter);
  const nextState = { ...state, rngCounter: counter + 1 };
  return { value, nextState };
};

const computeEnemyAction = (bt, playerMovedTo, state) => {
  const dist = hexDistance(bt.position, playerMovedTo);
  let moveResult = bt;
  let curState = state;
  if (bt.subtype === 'archer') {
    const isInLine = (bt.position.q === playerMovedTo.q) || (bt.position.r === playerMovedTo.r) || (bt.position.s === playerMovedTo.s);
    if (isInLine && dist > 1 && dist <= 4) {
      moveResult = { ...bt, intent: 'Aiming', intentPosition: { ...playerMovedTo } };
    } else {
      const neighbors = getNeighbors(bt.position);
      let candidates = [];
      let minDst = dist;
      for (const n of neighbors) {
        const d = hexDistance(n, playerMovedTo);
        const blocked = curState.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n)) || hexEquals(n, playerMovedTo);
        if (!blocked) {
          if (d < minDst) { minDst = d; candidates = [n]; }
          else if (d === minDst) candidates.push(n);
        }
      }
      let bestMove = bt.position;
      if (candidates.length > 0) {
        if (candidates.length === 1) bestMove = candidates[0];
        else {
          const { value, nextState } = consumeRandom(curState);
          curState = nextState;
          const idx = Math.floor(value * candidates.length) % candidates.length;
          bestMove = candidates[idx];
        }
      }
      const nDist = hexDistance(bestMove, playerMovedTo);
      const canAim = (bestMove.q === playerMovedTo.q) || (bestMove.r === playerMovedTo.r) || (bestMove.s === playerMovedTo.s);
      moveResult = { ...bt, position: bestMove, intent: (canAim && nDist > 1) ? 'Aiming' : 'Moving', intentPosition: (canAim && nDist > 1) ? { ...playerMovedTo } : undefined };
    }
  } else if (bt.subtype === 'bomber') {
    if (dist >= 2 && dist <= 3) {
      moveResult = { ...bt, intent: 'Bombing', intentPosition: { ...playerMovedTo } };
    } else {
      const neighbors = getNeighbors(bt.position);
      let candidates = [];
      let minScore = Math.abs(dist - 2.5);
      for (const n of neighbors) {
        const d = hexDistance(n, playerMovedTo);
        const score = Math.abs(d - 2.5);
        const blocked = curState.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n)) || hexEquals(n, playerMovedTo);
        if (!blocked) {
          if (score < minScore) { minScore = score; candidates = [n]; }
          else if (score === minScore) candidates.push(n);
        }
      }
      let bestMove = bt.position;
      if (candidates.length > 0) {
        if (candidates.length === 1) bestMove = candidates[0];
        else {
          const { value, nextState } = consumeRandom(curState);
          curState = nextState;
          const idx = Math.floor(value * candidates.length) % candidates.length;
          bestMove = candidates[idx];
        }
      }
      const nDist = hexDistance(bestMove, playerMovedTo);
      moveResult = { ...bt, position: bestMove, intent: (nDist >= 2 && nDist <= 3) ? 'Bombing' : 'Moving', intentPosition: (nDist >= 2 && nDist <= 3) ? { ...playerMovedTo } : undefined };
    }
  } else {
    if (dist === 1) {
      moveResult = { ...bt, intent: 'Attacking!', intentPosition: { ...playerMovedTo } };
    } else {
      const neighbors = getNeighbors(bt.position);
      let candidates = [];
      let minDst = dist;
      for (const n of neighbors) {
        const d = hexDistance(n, playerMovedTo);
        const blocked = curState.enemies.some(e => e.id !== bt.id && hexEquals(e.position, n)) || hexEquals(n, playerMovedTo);
        if (!blocked) {
          if (d < minDst) { minDst = d; candidates = [n]; }
          else if (d === minDst) candidates.push(n);
        }
      }
      let bestMove = bt.position;
      if (candidates.length > 0) {
        if (candidates.length === 1) bestMove = candidates[0];
        else {
          const { value, nextState } = consumeRandom(curState);
          curState = nextState;
          const idx = Math.floor(value * candidates.length) % candidates.length;
          bestMove = candidates[idx];
        }
      }
      const nDist = hexDistance(bestMove, playerMovedTo);
      moveResult = { ...bt, position: bestMove, intent: nDist === 1 ? 'Attacking!' : 'Moving', intentPosition: nDist === 1 ? { ...playerMovedTo } : undefined };
    }
  }

  return { entity: moveResult, nextState: curState };
};

const resolveTelegraphedAttacks = (state, playerMovedTo) => {
  let player = state.player;
  const messages = [];
  (state.enemies || []).forEach(e => {
    if (e.intentPosition && hexEquals(e.intentPosition, playerMovedTo)) {
      player = applyDamage(player, 1);
      messages.push(`Hit by ${e.subtype}!`);
    }
  });
  return { player, messages };
};

const applyLavaToEnemy = (enemy, state) => {
  if ((state.lavaPositions || []).some(lp => hexEquals(lp, enemy.position))) return applyDamage(enemy, 1);
  return enemy;
};

const computeNextEnemies = (state, playerMovedTo) => {
  let curState = state;
  const nextEnemies = [];
  for (const bt of curState.enemies || []) {
    const { entity: moveResult, nextState } = computeEnemyAction(bt, playerMovedTo, curState);
    curState = nextState;
    const afterLava = applyLavaToEnemy(moveResult, curState);
    if (afterLava.hp > 0) nextEnemies.push(afterLava);
  }
  return { enemies: nextEnemies, nextState: curState };
};

// Generate initial state similar to client
const GRID_RADIUS = 3;
const INITIAL_PLAYER_STATS = { hp: 10, maxHp: 10 };
const ENEMY_STATS = {
  footman: { hp: 3, maxHp: 3 },
  archer: { hp: 2, maxHp: 2 },
  bomber: { hp: 2, maxHp: 2 }
};

const createIdFromRng = (rng) => rng.id(9);

const generateInitialState = (floor = 1, seed = String(Date.now()), initialSeed) => {
  const rng = createRng(seed);
  const cells = getGridCells(GRID_RADIUS);
  const stairsPos = cells[Math.floor(rng.next() * cells.length)];
  const lavaCount = 5 + Math.floor(rng.next() * 5);
  const lavaPositions = [];
  let shrinePos;
  if (floor % 2 === 0) shrinePos = cells[Math.floor(rng.next() * cells.length)];
  while (lavaPositions.length < lavaCount) {
    const potential = cells[Math.floor(rng.next() * cells.length)];
    const isSpecial = hexEquals(potential, createHex(0, 0)) || hexEquals(potential, stairsPos) || (shrinePos && hexEquals(potential, shrinePos));
    if (!isSpecial && !lavaPositions.some(lp => hexEquals(lp, potential))) lavaPositions.push(potential);
  }
  return {
    turn: 1,
    player: { id: 'player', type: 'player', position: createHex(0,0), ...INITIAL_PLAYER_STATS },
    enemies: [
      { id: createIdFromRng(rng), type: 'enemy', subtype: 'footman', position: createHex(0,-2), ...ENEMY_STATS.footman },
      { id: createIdFromRng(rng), type: 'enemy', subtype: 'archer', position: createHex(2,2), ...ENEMY_STATS.archer },
      { id: createIdFromRng(rng), type: 'enemy', subtype: 'bomber', position: createHex(-2,0), ...ENEMY_STATS.bomber }
    ],
    gridRadius: GRID_RADIUS,
    gameStatus: 'playing',
    message: floor === 1 ? 'Welcome to the arena. Survive.' : `Floor ${floor}. Be careful.`,
    hasSpear: true,
    rngSeed: seed,
    initialSeed: initialSeed ?? (floor === 1 ? seed : undefined),
    rngCounter: 0,
    stairsPosition: stairsPos,
    lavaPositions,
    shrinePosition: shrinePos,
    floor,
    upgrades: [],
    actionLog: []
  };
};

// Apply a single action to state (subset needed for verification)
const appendAction = (s, a) => ({ ...s, actionLog: (s.actionLog || []).concat([a]) });

const resolveEnemyActions = (state, playerMovedTo) => {
  let player = state.player;
  const tele = resolveTelegraphedAttacks(state, playerMovedTo);
  player = tele.player;
  if ((state.lavaPositions || []).some(lp => hexEquals(lp, playerMovedTo))) {
    player = applyDamage(player, 1);
  }
  const nextEnemiesResult = computeNextEnemies(state, playerMovedTo);
  const nextEnemies = nextEnemiesResult.enemies;
  state = { ...state, ...nextEnemiesResult.nextState };
  let hasSpear = state.hasSpear;
  let spearPos = state.spearPosition;
  if (spearPos && hexEquals(playerMovedTo, spearPos)) { hasSpear = true; spearPos = undefined; }
  if (hexEquals(playerMovedTo, state.stairsPosition)) {
    const arcadeMax = 5;
    if (state.floor >= arcadeMax) {
      const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
      const score = (player.hp || 0) + (state.floor || 0) * 100;
      return { ...state, player: { ...player, position: playerMovedTo }, gameStatus: 'won', completedRun: { seed: baseSeed, actionLog: state.actionLog, score, floor: state.floor } };
    }
    const baseSeed = state.initialSeed ?? state.rngSeed ?? '0';
    const nextSeed = `${baseSeed}:${state.floor + 1}`;
    return generateInitialState(state.floor + 1, nextSeed, baseSeed);
  }
  return { ...state, enemies: nextEnemies, player: { ...player, position: playerMovedTo }, hasSpear, spearPosition: spearPos, turn: state.turn + 1, message: 'Enemy turn over.', gameStatus: player.hp <= 0 ? 'lost' : 'playing' };
};

const gameReducer = (state, action) => {
  if (state.gameStatus !== 'playing' && action.type !== 'RESET' && action.type !== 'SELECT_UPGRADE') return state;
  switch (action.type) {
    case 'LOAD_STATE': return action.payload;
    case 'RESET': return generateInitialState(1, String(Date.now()));
    case 'SELECT_UPGRADE': {
      const upgrade = action.payload;
      let player = state.player;
      if (upgrade === 'EXTRA_HP') {
        player = { ...player, maxHp: player.maxHp + 1, hp: Math.min(player.maxHp + 1, player.hp + 1) };
      }
      return appendAction({ ...state, player, upgrades: [...state.upgrades, upgrade], gameStatus: 'playing', message: `Applied ${upgrade}!` }, action);
    }
    case 'LEAP':
    case 'MOVE': {
      const target = action.payload;
      const dist = hexDistance(state.player.position, target);
      if (action.type === 'MOVE' && dist !== 1) return state;
      if (action.type === 'LEAP' && (dist > 2 || dist < 1)) return state;
      const killedEnemies = (state.enemies || []).filter(e => (hexDistance(state.player.position, e.position) === 2 && hexDistance(target, e.position) === 1));
      return resolveEnemyActions(appendAction({ ...state, enemies: (state.enemies || []).filter(e => !killedEnemies.includes(e)) }, action), target);
    }
    case 'THROW_SPEAR': {
      if (!state.hasSpear) return state;
      const target = action.payload;
      const targetEnemy = (state.enemies || []).find(e => hexEquals(e.position, target));
      return resolveEnemyActions(appendAction({ ...state, enemies: (state.enemies || []).filter(e => e.id !== (targetEnemy && targetEnemy.id)), hasSpear: false, spearPosition: target }, action), state.player.position);
    }
    case 'WAIT': {
      return resolveEnemyActions(appendAction(state, action), state.player.position);
    }
    default: return state;
  }
};

const fingerprintFromState = (st) => {
  const p = st.player || {};
  const enemies = (st.enemies || []).map(e => ({ id: e.id, subtype: e.subtype, hp: e.hp, position: e.position }));
  const obj = { player: { id: p.id, subtype: p.subtype, hp: p.hp, maxHp: p.maxHp, position: p.position }, enemies, floor: st.floor, turn: st.turn, upgrades: st.upgrades };
  return JSON.stringify(obj);
};

module.exports = { generateInitialState, gameReducer, fingerprintFromState };
