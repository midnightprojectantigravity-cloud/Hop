import {
  DEFAULT_LOADOUTS,
  generateInitialState,
  pointToKey,
  type FloorTheme,
  type GameState,
  type Point
} from '@hop/engine';
import type { WallSettings } from '../types';
import { clamp } from './settings-utils';

const AXIAL_NEIGHBOR_OFFSETS: Point[] = [
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
  { q: 1, r: -1, s: 0 }
];

const hashString = (input: string): number => {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const hashFloat = (input: string): number => hashString(input) / 0xffffffff;

const hasWallTraits = (traits: Set<string>): boolean =>
  traits.has('BLOCKS_MOVEMENT') && traits.has('BLOCKS_LOS');

const hasHazardTraits = (traits: Set<string>): boolean =>
  traits.has('LAVA') || traits.has('FIRE') || (traits.has('HAZARDOUS') && traits.has('LIQUID'));

const getNeighborKeys = (position: Point): string[] =>
  AXIAL_NEIGHBOR_OFFSETS.map(offset =>
    pointToKey({
      q: position.q + offset.q,
      r: position.r + offset.r,
      s: position.s + offset.s
    })
  );

const collectBoundaryKeys = (tiles: Map<string, any>): Set<string> => {
  const boundary = new Set<string>();
  for (const [key, tile] of tiles.entries()) {
    const neighborKeys = getNeighborKeys(tile.position as Point);
    if (neighborKeys.some(neighborKey => !tiles.has(neighborKey))) {
      boundary.add(key);
    }
  }
  return boundary;
};

const collectSpawnSafeKeys = (tiles: Map<string, any>, spawn: Point, radius: number): Set<string> => {
  const safe = new Set<string>();
  const queue: Array<{ point: Point; depth: number }> = [{ point: spawn, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift() as { point: Point; depth: number };
    const key = pointToKey(current.point);
    if (safe.has(key)) continue;
    if (!tiles.has(key)) continue;
    safe.add(key);
    if (current.depth >= radius) continue;
    for (const neighborKey of getNeighborKeys(current.point)) {
      const neighborTile = tiles.get(neighborKey);
      if (!neighborTile) continue;
      queue.push({ point: neighborTile.position as Point, depth: current.depth + 1 });
    }
  }
  return safe;
};

const setWallTraits = (tiles: Map<string, any>, key: string, enabled: boolean) => {
  const tile = tiles.get(key);
  if (!tile) return;
  const traits = new Set<string>(Array.from(tile.traits as Set<string>));
  if (enabled) {
    traits.add('BLOCKS_MOVEMENT');
    traits.add('BLOCKS_LOS');
    traits.delete('LAVA');
    traits.delete('FIRE');
    traits.delete('LIQUID');
    traits.delete('HAZARDOUS');
  } else {
    traits.delete('BLOCKS_MOVEMENT');
    traits.delete('BLOCKS_LOS');
  }
  tiles.set(key, {
    ...tile,
    traits: traits as any
  });
};

const cloneTiles = (state: GameState): Map<string, any> => {
  const out = new Map<string, any>();
  for (const [key, tile] of state.tiles.entries()) {
    out.set(key, {
      ...tile,
      traits: new Set(tile.traits),
      effects: Array.isArray(tile.effects) ? [...tile.effects] : []
    });
  }
  return out;
};

export const applySyntheticHazards = (tiles: Map<string, any>, center: Point) => {
  const mark = (q: number, r: number, traitsToAdd: string[]) => {
    const p: Point = { q, r, s: -q - r };
    const key = pointToKey(p);
    const tile = tiles.get(key);
    if (!tile) return;
    const traits = new Set<string>(Array.from(tile.traits as Set<string>));
    if (hasWallTraits(traits)) return;
    for (const trait of traitsToAdd) traits.add(trait);
    tiles.set(key, {
      ...tile,
      traits: traits as any
    });
  };

  const lavaOffsets: Array<[number, number]> = [
    [0, 0], [1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1],
    [2, -1], [2, 0], [1, 1], [-2, 1], [-2, 0], [-1, -1]
  ];
  for (const [dq, dr] of lavaOffsets) {
    mark(center.q + dq, center.r + dr, ['HAZARDOUS', 'LIQUID', 'LAVA']);
  }

  const fireOffsets: Array<[number, number]> = [[3, -1], [3, 0], [2, 1], [-3, 1], [-3, 0], [-2, -1]];
  for (const [dq, dr] of fireOffsets) {
    mark(center.q + dq, center.r + dr, ['HAZARDOUS', 'FIRE']);
  }
};

export const applySyntheticWalls = (tiles: Map<string, any>, seed: string, spawn: Point, walls: WallSettings) => {
  const mode = walls.mode;
  const boundaryKeys = collectBoundaryKeys(tiles);
  const safeKeys = collectSpawnSafeKeys(tiles, spawn, 2);
  const sortedKeys = Array.from(tiles.keys()).sort((a, b) => a.localeCompare(b));

  if (mode === 'custom') {
    for (const key of sortedKeys) {
      if (safeKeys.has(key)) {
        setWallTraits(tiles, key, false);
        continue;
      }
      const keepBoundaryWall = walls.keepPerimeter && boundaryKeys.has(key);
      setWallTraits(tiles, key, keepBoundaryWall);
    }
  }

  if (mode === 'native') return;

  const interiorDensity = clamp(Number(walls.interiorDensity || 0), 0, 0.45);
  const clusterBias = clamp(Number(walls.clusterBias || 0), 0, 1);
  if (interiorDensity <= 0 && clusterBias <= 0) return;

  const candidates = sortedKeys.filter((key) => {
    if (boundaryKeys.has(key)) return false;
    if (safeKeys.has(key)) return false;
    const tile = tiles.get(key);
    if (!tile) return false;
    const traits = tile.traits as Set<string>;
    if (hasHazardTraits(traits)) return false;
    return true;
  });

  const isWall = (key: string): boolean => {
    const tile = tiles.get(key);
    if (!tile) return false;
    return hasWallTraits(tile.traits as Set<string>);
  };

  const staged = new Set<string>();
  for (const key of candidates) {
    if (isWall(key)) continue;
    const seedRoll = hashFloat(`${seed}|sandbox-wall-seed|${key}`);
    if (seedRoll < interiorDensity) staged.add(key);
  }

  for (let pass = 0; pass < 2; pass++) {
    for (const key of candidates) {
      if (isWall(key) || staged.has(key)) continue;
      const tile = tiles.get(key);
      if (!tile) continue;
      const neighborKeys = getNeighborKeys(tile.position as Point).filter(nKey => tiles.has(nKey));
      let wallNeighbors = 0;
      for (const neighborKey of neighborKeys) {
        if (isWall(neighborKey) || staged.has(neighborKey)) wallNeighbors++;
      }
      if (wallNeighbors === 0) continue;
      const chance = clusterBias * (wallNeighbors / 6);
      const growRoll = hashFloat(`${seed}|sandbox-wall-grow|pass:${pass}|${key}`);
      if (growRoll < chance) staged.add(key);
    }
  }

  for (const key of staged) {
    setWallTraits(tiles, key, true);
  }
};

const themeFloor = (theme: FloorTheme): number => {
  switch (theme) {
    case 'inferno':
      return 4;
    case 'throne':
      return 6;
    case 'frozen':
      return 8;
    case 'void':
      return 10;
    case 'catacombs':
    default:
      return 1;
  }
};

export const buildPreviewState = (theme: FloorTheme, seed: string, injectHazards: boolean, walls: WallSettings): GameState => {
  const floor = themeFloor(theme);
  const safeSeed = seed.trim() || 'biome-sandbox-seed';
  const base = generateInitialState(floor, safeSeed, safeSeed, undefined, DEFAULT_LOADOUTS.VANGUARD);
  const tiles = cloneTiles(base);
  applySyntheticWalls(tiles, safeSeed, base.player.position, walls);
  if (injectHazards) {
    applySyntheticHazards(tiles, base.player.position);
  }
  return {
    ...base,
    floor,
    theme,
    rngSeed: safeSeed,
    initialSeed: safeSeed,
    turnNumber: 1,
    tiles,
    visualEvents: [],
    timelineEvents: [],
    intentPreview: undefined
  };
};

