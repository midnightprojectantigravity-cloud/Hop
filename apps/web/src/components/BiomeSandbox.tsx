import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LOADOUTS,
  generateInitialState,
  pointToKey,
  type FloorTheme,
  type GameState,
  type Point
} from '@hop/engine';
import { GameBoard } from './GameBoard';
import type {
  VisualAssetManifest,
  VisualBiomeThemePreset,
  VisualBiomeTextureLayer,
  VisualBiomeMaterialProfile,
  VisualBiomeTintProfile,
  VisualBiomeWallsProfile,
  VisualBiomeWallsThemeOverride,
  VisualMountainRenderSettings,
  VisualBlendMode
} from '../visual/asset-manifest';
import { getBiomeThemePreset } from '../visual/asset-manifest';

type LayerMode = 'off' | 'cover' | 'repeat';
type BlendMode = VisualBlendMode;
type MountainBlendMode = 'off' | BlendMode;

type UndercurrentSettings = {
  path: string;
  mode: LayerMode;
  scalePx: number;
  opacity: number;
  scrollX: number;
  scrollY: number;
  scrollDurationMs: number;
  offsetX: number;
  offsetY: number;
};

type CrustSettings = {
  path: string;
  mode: LayerMode;
  scalePx: number;
  opacity: number;
  seedShiftPx: number;
  offsetX: number;
  offsetY: number;
};

type ClutterSettings = {
  density: number;
  maxPerHex: number;
  bleedScaleMax: number;
};

type WallMode = 'native' | 'additive' | 'custom';

type WallSettings = {
  mode: WallMode;
  interiorDensity: number;
  clusterBias: number;
  keepPerimeter: boolean;
  mountainPath: string;
  mountainScale: number;
  mountainOffsetX: number;
  mountainOffsetY: number;
  mountainAnchorX: number;
  mountainAnchorY: number;
  mountainCrustBlendMode: MountainBlendMode;
  mountainCrustBlendOpacity: number;
  mountainTintColor: string;
  mountainTintBlendMode: MountainBlendMode;
  mountainTintOpacity: number;
};

type MaterialDetailSettings = {
  path: string;
  mode: LayerMode;
  scalePx: number;
  opacity: number;
};

type CrustMaterialSettings = {
  detailA: MaterialDetailSettings;
  detailB: MaterialDetailSettings;
  tintColor: string;
  tintOpacity: number;
  tintBlend: BlendMode;
};

type BiomeSandboxSettings = {
  theme: FloorTheme;
  seed: string;
  injectHazards: boolean;
  undercurrent: UndercurrentSettings;
  crust: CrustSettings;
  clutter: ClutterSettings;
  walls: WallSettings;
  materials: CrustMaterialSettings;
};

interface BiomeSandboxProps {
  assetManifest: VisualAssetManifest | null;
  onBack: () => void;
}

const FLOOR_THEMES: FloorTheme[] = ['catacombs', 'inferno', 'throne', 'frozen', 'void'];
const MODE_OPTIONS: LayerMode[] = ['off', 'repeat', 'cover'];
const SETTINGS_STORAGE_KEY = 'hop_biome_sandbox_settings_v1';
const BASE_URL = import.meta.env.BASE_URL || '/';
const UNDERCURRENT_SCALE_MIN = 64;
const UNDERCURRENT_SCALE_MAX = 192;
const DETAIL_SCALE_MIN = 64;
const DETAIL_SCALE_MAX = 512;
const BLEND_OPTIONS: BlendMode[] = ['normal', 'multiply', 'overlay', 'soft-light', 'screen', 'color-dodge'];
const MOUNTAIN_BLEND_OPTIONS: MountainBlendMode[] = ['off', 'multiply', 'overlay', 'soft-light', 'screen', 'color-dodge', 'normal'];
const TINT_SWATCHES: string[] = ['#8b6f4a', '#8f4a2e', '#5b6d41', '#536e8e', '#5f5977', '#b79a73', '#d15a3a', '#3e4f3a'];
const WALL_MODE_OPTIONS: WallMode[] = ['native', 'additive', 'custom'];
const AXIAL_NEIGHBOR_OFFSETS: Point[] = [
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
  { q: 1, r: -1, s: 0 }
];

const joinBase = (base: string, path: string): string => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
};

const toRuntimeAssetPath = (assetPath: string): string => {
  const trimmed = assetPath.trim();
  if (!trimmed) return trimmed;
  if (/^(?:[a-z]+:)?\/\//i.test(trimmed) || trimmed.startsWith('data:')) return trimmed;
  if (!trimmed.startsWith('/')) return joinBase(BASE_URL, trimmed);
  if (trimmed.startsWith('/assets/')) return joinBase(BASE_URL, trimmed.slice(1));
  return trimmed;
};

const toManifestAssetPath = (assetPath: string): string => {
  const trimmed = assetPath.trim();
  if (!trimmed) return trimmed;
  if (/^\/assets\/[a-z0-9/_\-.]+$/i.test(trimmed)) return trimmed;
  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const baseAssetsPrefix = `${normalizedBase}assets/`;
  if (trimmed.startsWith(baseAssetsPrefix)) {
    return `/assets/${trimmed.slice(baseAssetsPrefix.length)}`;
  }
  return trimmed;
};

const normalizeHexColor = (value: string, fallback = '#8b6f4a'): string => {
  const raw = String(value || '').trim();
  const fullHex = /^#([0-9a-f]{6})$/i;
  if (fullHex.test(raw)) return raw.toLowerCase();
  const shortHex = /^#([0-9a-f]{3})$/i;
  if (shortHex.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

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

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const resolveLayerPath = (layer: VisualBiomeTextureLayer | undefined, theme: string): string => {
  if (!layer) return '';
  if (theme && layer.themes?.[theme]) return layer.themes[theme];
  return layer.default || '';
};

const readLayerMode = (layer?: VisualBiomeTextureLayer): LayerMode => {
  if (!layer) return 'off';
  if (layer.mode === 'cover' || layer.mode === 'repeat' || layer.mode === 'off') return layer.mode;
  return 'repeat';
};

const resolveTintColor = (tint: VisualBiomeTintProfile | undefined, theme: string): string => {
  if (!tint) return '#8b6f4a';
  if (theme && tint.themes?.[theme]) return tint.themes[theme];
  return tint.default || '#8b6f4a';
};

const readBlendMode = (blend: unknown): BlendMode => {
  if (
    blend === 'normal'
    || blend === 'multiply'
    || blend === 'overlay'
    || blend === 'soft-light'
    || blend === 'screen'
    || blend === 'color-dodge'
  ) {
    return blend;
  }
  return 'multiply';
};

const readMountainBlendMode = (blend: unknown): MountainBlendMode => {
  if (blend === 'off') return 'off';
  return readBlendMode(blend);
};

const readWallMountainOverride = <T,>(
  themeOverride: Partial<VisualBiomeWallsThemeOverride> | undefined,
  walls: Partial<VisualBiomeWallsProfile> | undefined,
  canonicalKey: keyof VisualMountainRenderSettings,
  aliasKey:
    | 'mountainScale'
    | 'mountainOffsetX'
    | 'mountainOffsetY'
    | 'mountainAnchorX'
    | 'mountainAnchorY'
    | 'mountainCrustBlendMode'
    | 'mountainCrustBlendOpacity'
    | 'mountainTintColor'
    | 'mountainTintBlendMode'
    | 'mountainTintOpacity'
): T | undefined => {
  const themed = (themeOverride as any)?.[canonicalKey] ?? (themeOverride as any)?.[aliasKey];
  if (themed !== undefined) return themed as T;
  const base = (walls as any)?.[canonicalKey] ?? (walls as any)?.[aliasKey];
  return base as T | undefined;
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

const applySyntheticHazards = (tiles: Map<string, any>, center: Point) => {
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

const applySyntheticWalls = (tiles: Map<string, any>, seed: string, spawn: Point, walls: WallSettings) => {
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

const buildPreviewState = (theme: FloorTheme, seed: string, injectHazards: boolean, walls: WallSettings): GameState => {
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

const defaultsFromManifest = (manifest: VisualAssetManifest, theme: FloorTheme): BiomeSandboxSettings => {
  const themeKey = theme.toLowerCase();
  const themePreset = getBiomeThemePreset(manifest, themeKey) as VisualBiomeThemePreset | undefined;
  const undercurrentLayer = themePreset?.biomeLayers?.undercurrent ?? manifest.biomeLayers?.undercurrent;
  const crustLayer = themePreset?.biomeLayers?.crust
    ?? manifest.biomeLayers?.crust
    ?? (manifest.biomeUnderlay
      ? {
          default: manifest.biomeUnderlay.default,
          themes: manifest.biomeUnderlay.themes,
          mode: manifest.biomeUnderlay.mode,
          scalePx: manifest.biomeUnderlay.scalePx,
          opacity: manifest.biomeUnderlay.opacity
        } satisfies VisualBiomeTextureLayer
      : undefined);
  const crustMaterial = themePreset?.biomeMaterials?.crust ?? manifest.biomeMaterials?.crust;
  const detailA = crustMaterial?.detailA;
  const detailB = crustMaterial?.detailB;
  const tint = crustMaterial?.tint;
  const wallsProfile = (themePreset?.walls || manifest.walls) as Partial<VisualBiomeWallsProfile> | undefined;
  const wallsThemeOverride = (
    themePreset?.walls
      ? themePreset.walls
      : manifest.walls?.themes?.[themeKey]
  ) as Partial<VisualBiomeWallsThemeOverride> | undefined;
  const mountainCandidates = (manifest.assets || [])
    .filter((asset) => {
      if (asset.type !== 'prop') return false;
      const id = asset.id.toLowerCase();
      const tags = new Set((asset.tags || []).map(tag => tag.toLowerCase()));
      if (!id.includes('mountain') && !tags.has('mountain')) return false;
      if (!asset.theme) return true;
      const assetTheme = asset.theme.toLowerCase();
      return assetTheme === themeKey || assetTheme === 'core';
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  const presetMountainPath = String(
    wallsThemeOverride?.mountainPath
    ?? wallsProfile?.mountainPath
    ?? ''
  ).trim();
  const mountainPath = presetMountainPath
    || mountainCandidates.find(asset => asset.path.toLowerCase().includes('biome.volcano.mountain.03.webp'))?.path
    || mountainCandidates[0]?.path
    || '';
  const selectedMountainAsset = mountainCandidates.find(asset => asset.path === mountainPath) || mountainCandidates[0];
  const assetMountainDefaults = selectedMountainAsset?.mountainSettings as VisualMountainRenderSettings | undefined;
  const assetMountainThemeDefaults = selectedMountainAsset?.mountainSettingsByTheme?.[themeKey] as VisualMountainRenderSettings | undefined;
  const presetAssetMountainDefaults = (
    selectedMountainAsset
      ? themePreset?.assetOverrides?.[selectedMountainAsset.id]?.mountainSettings
      : undefined
  ) as VisualMountainRenderSettings | undefined;

  const readMountainNumber = (
    canonicalKey: keyof VisualMountainRenderSettings,
    aliasKey:
      | 'mountainScale'
      | 'mountainOffsetX'
      | 'mountainOffsetY'
      | 'mountainAnchorX'
      | 'mountainAnchorY'
      | 'mountainCrustBlendOpacity'
      | 'mountainTintOpacity',
    fallback: number
  ): number => {
    const wallValue = readWallMountainOverride<number>(wallsThemeOverride, wallsProfile, canonicalKey, aliasKey);
    const raw = wallValue
      ?? (presetAssetMountainDefaults as any)?.[canonicalKey]
      ?? (assetMountainThemeDefaults as any)?.[canonicalKey]
      ?? (assetMountainDefaults as any)?.[canonicalKey]
      ?? fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  const readMountainBlend = (
    canonicalKey: keyof VisualMountainRenderSettings,
    aliasKey: 'mountainCrustBlendMode' | 'mountainTintBlendMode',
    fallback: MountainBlendMode
  ): MountainBlendMode => {
    const wallValue = readWallMountainOverride<unknown>(wallsThemeOverride, wallsProfile, canonicalKey, aliasKey);
    const raw = wallValue
      ?? (presetAssetMountainDefaults as any)?.[canonicalKey]
      ?? (assetMountainThemeDefaults as any)?.[canonicalKey]
      ?? (assetMountainDefaults as any)?.[canonicalKey]
      ?? fallback;
    return readMountainBlendMode(raw);
  };

  const readMountainColor = (
    canonicalKey: keyof VisualMountainRenderSettings,
    aliasKey: 'mountainTintColor',
    fallback: string
  ): string => {
    const wallValue = readWallMountainOverride<unknown>(wallsThemeOverride, wallsProfile, canonicalKey, aliasKey);
    const raw = wallValue
      ?? (presetAssetMountainDefaults as any)?.[canonicalKey]
      ?? (assetMountainThemeDefaults as any)?.[canonicalKey]
      ?? (assetMountainDefaults as any)?.[canonicalKey]
      ?? fallback;
    return normalizeHexColor(String(raw || ''), fallback);
  };

  return {
    theme,
    seed: String(themePreset?.seed || 'biome-sandbox-seed'),
    injectHazards: themePreset?.injectHazards !== undefined ? Boolean(themePreset.injectHazards) : true,
    undercurrent: {
      path: resolveLayerPath(undercurrentLayer, themeKey),
      mode: readLayerMode(undercurrentLayer),
      scalePx: clamp(Number(undercurrentLayer?.scalePx ?? manifest.tileUnitPx ?? 256), UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX),
      opacity: clamp(Number(undercurrentLayer?.opacity ?? 0.6), 0, 1),
      scrollX: Number(undercurrentLayer?.scroll?.x ?? 120),
      scrollY: Number(undercurrentLayer?.scroll?.y ?? 90),
      scrollDurationMs: Math.max(1000, Number(undercurrentLayer?.scroll?.durationMs ?? 92000)),
      offsetX: Number(undercurrentLayer?.offsetX ?? 0),
      offsetY: Number(undercurrentLayer?.offsetY ?? 0)
    },
    crust: {
      path: resolveLayerPath(crustLayer, themeKey),
      mode: readLayerMode(crustLayer),
      scalePx: Math.max(64, Number(crustLayer?.scalePx ?? manifest.tileUnitPx ?? 256)),
      opacity: 1,
      seedShiftPx: Math.max(0, Number(crustLayer?.seedShiftPx ?? 96)),
      offsetX: Number(crustLayer?.offsetX ?? 0),
      offsetY: Number(crustLayer?.offsetY ?? 0)
    },
    clutter: {
      density: clamp(Number((themePreset?.biomeLayers?.clutter ?? manifest.biomeLayers?.clutter)?.density ?? 0.14), 0, 1),
      maxPerHex: Math.max(0, Number((themePreset?.biomeLayers?.clutter ?? manifest.biomeLayers?.clutter)?.maxPerHex ?? 1)),
      bleedScaleMax: clamp(Number((themePreset?.biomeLayers?.clutter ?? manifest.biomeLayers?.clutter)?.bleedScaleMax ?? 2), 1, 2)
    },
    walls: {
      mode: (wallsProfile?.mode === 'native' || wallsProfile?.mode === 'additive' || wallsProfile?.mode === 'custom')
        ? wallsProfile.mode
        : 'custom',
      interiorDensity: clamp(Number(wallsProfile?.interiorDensity ?? 0.05), 0, 0.45),
      clusterBias: clamp(Number(wallsProfile?.clusterBias ?? 0), 0, 1),
      keepPerimeter: wallsProfile?.keepPerimeter !== undefined ? Boolean(wallsProfile.keepPerimeter) : true,
      mountainPath,
      mountainScale: clamp(readMountainNumber('scale', 'mountainScale', 0.53), 0.2, 3),
      mountainOffsetX: readMountainNumber('offsetX', 'mountainOffsetX', 0),
      mountainOffsetY: readMountainNumber('offsetY', 'mountainOffsetY', 0),
      mountainAnchorX: clamp(readMountainNumber('anchorX', 'mountainAnchorX', 0.5), 0, 1),
      mountainAnchorY: clamp(readMountainNumber('anchorY', 'mountainAnchorY', 0.55), 0, 1),
      mountainCrustBlendMode: readMountainBlend('crustBlendMode', 'mountainCrustBlendMode', 'multiply'),
      mountainCrustBlendOpacity: clamp(readMountainNumber('crustBlendOpacity', 'mountainCrustBlendOpacity', 1), 0, 1),
      mountainTintColor: readMountainColor('tintColor', 'mountainTintColor', '#7d7d7d'),
      mountainTintBlendMode: readMountainBlend('tintBlendMode', 'mountainTintBlendMode', 'overlay'),
      mountainTintOpacity: clamp(readMountainNumber('tintOpacity', 'mountainTintOpacity', 1), 0, 1)
    },
    materials: {
      detailA: {
        path: resolveLayerPath(detailA, themeKey),
        mode: readLayerMode(detailA),
        scalePx: clamp(Number(detailA?.scalePx ?? 192), DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
        opacity: clamp(Number(detailA?.opacity ?? 0), 0, 1)
      },
      detailB: {
        path: resolveLayerPath(detailB, themeKey),
        mode: readLayerMode(detailB),
        scalePx: clamp(Number(detailB?.scalePx ?? 256), DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
        opacity: clamp(Number(detailB?.opacity ?? 0), 0, 1)
      },
      tintColor: resolveTintColor(tint, themeKey),
      tintOpacity: clamp(Number(tint?.opacity ?? 0), 0, 1),
      tintBlend: readBlendMode(tint?.blendMode)
    }
  };
};

const parseStoredSettings = (raw: string | null): BiomeSandboxSettings | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiomeSandboxSettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as BiomeSandboxSettings;
  } catch {
    return null;
  }
};

const toNumber = (value: string, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const BiomeSandbox: React.FC<BiomeSandboxProps> = ({ assetManifest, onBack }) => {
  const initializedRef = useRef(false);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [settings, setSettings] = useState<BiomeSandboxSettings | null>(null);

  useEffect(() => {
    if (!assetManifest || initializedRef.current) return;
    const defaults = defaultsFromManifest(assetManifest, 'inferno');
    const stored = parseStoredSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
    if (!stored) {
      setSettings(defaults);
      initializedRef.current = true;
      return;
    }
    setSettings({
      ...defaults,
      ...stored,
      undercurrent: {
        ...defaults.undercurrent,
        ...(stored.undercurrent || {}),
        scalePx: clamp(
          Number((stored.undercurrent || {}).scalePx ?? defaults.undercurrent.scalePx),
          UNDERCURRENT_SCALE_MIN,
          UNDERCURRENT_SCALE_MAX
        )
      },
      crust: {
        ...defaults.crust,
        ...(stored.crust || {}),
        opacity: 1
      },
      clutter: { ...defaults.clutter, ...(stored.clutter || {}) },
      walls: {
        ...defaults.walls,
        ...(stored.walls || {}),
        mode: (
          (stored.walls || {}).mode === 'native'
          || (stored.walls || {}).mode === 'additive'
          || (stored.walls || {}).mode === 'custom'
        )
          ? (stored.walls || {}).mode as WallMode
          : defaults.walls.mode,
        interiorDensity: clamp(
          Number((stored.walls || {}).interiorDensity ?? defaults.walls.interiorDensity),
          0,
          0.45
        ),
        clusterBias: clamp(
          Number((stored.walls || {}).clusterBias ?? defaults.walls.clusterBias),
          0,
          1
        ),
        keepPerimeter: (stored.walls || {}).keepPerimeter !== undefined
          ? Boolean((stored.walls || {}).keepPerimeter)
          : defaults.walls.keepPerimeter,
        mountainPath: String((stored.walls || {}).mountainPath || defaults.walls.mountainPath || ''),
        mountainScale: clamp(
          Number((stored.walls || {}).mountainScale ?? defaults.walls.mountainScale),
          0.2,
          3
        ),
        mountainOffsetX: toNumber(
          String((stored.walls || {}).mountainOffsetX ?? defaults.walls.mountainOffsetX),
          defaults.walls.mountainOffsetX
        ),
        mountainOffsetY: toNumber(
          String((stored.walls || {}).mountainOffsetY ?? defaults.walls.mountainOffsetY),
          defaults.walls.mountainOffsetY
        ),
        mountainAnchorX: clamp(
          Number((stored.walls || {}).mountainAnchorX ?? defaults.walls.mountainAnchorX),
          0,
          1
        ),
        mountainAnchorY: clamp(
          Number((stored.walls || {}).mountainAnchorY ?? defaults.walls.mountainAnchorY),
          0,
          1
        ),
        mountainCrustBlendMode: readMountainBlendMode(
          (stored.walls || {}).mountainCrustBlendMode ?? defaults.walls.mountainCrustBlendMode
        ),
        mountainCrustBlendOpacity: clamp(
          Number((stored.walls || {}).mountainCrustBlendOpacity ?? defaults.walls.mountainCrustBlendOpacity),
          0,
          1
        ),
        mountainTintColor: normalizeHexColor(
          String((stored.walls || {}).mountainTintColor ?? defaults.walls.mountainTintColor),
          defaults.walls.mountainTintColor
        ),
        mountainTintBlendMode: readMountainBlendMode(
          (stored.walls || {}).mountainTintBlendMode ?? defaults.walls.mountainTintBlendMode
        ),
        mountainTintOpacity: clamp(
          Number((stored.walls || {}).mountainTintOpacity ?? defaults.walls.mountainTintOpacity),
          0,
          1
        )
      },
      materials: {
        ...defaults.materials,
        ...(stored.materials || {}),
        detailA: {
          ...defaults.materials.detailA,
          ...((stored.materials || {}).detailA || {}),
          scalePx: clamp(
            Number(((stored.materials || {}).detailA || {}).scalePx ?? defaults.materials.detailA.scalePx),
            DETAIL_SCALE_MIN,
            DETAIL_SCALE_MAX
          ),
          opacity: clamp(
            Number(((stored.materials || {}).detailA || {}).opacity ?? defaults.materials.detailA.opacity),
            0,
            1
          )
        },
        detailB: {
          ...defaults.materials.detailB,
          ...((stored.materials || {}).detailB || {}),
          scalePx: clamp(
            Number(((stored.materials || {}).detailB || {}).scalePx ?? defaults.materials.detailB.scalePx),
            DETAIL_SCALE_MIN,
            DETAIL_SCALE_MAX
          ),
          opacity: clamp(
            Number(((stored.materials || {}).detailB || {}).opacity ?? defaults.materials.detailB.opacity),
            0,
            1
          )
        },
        tintOpacity: clamp(
          Number((stored.materials || {}).tintOpacity ?? defaults.materials.tintOpacity),
          0,
          1
        ),
        tintBlend: readBlendMode((stored.materials || {}).tintBlend)
      }
    });
    initializedRef.current = true;
  }, [assetManifest]);

  useEffect(() => {
    if (!settings) return;
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const themeKey = settings?.theme?.toLowerCase() || 'inferno';
  const tintPickerColor = useMemo(
    () => normalizeHexColor(settings?.materials.tintColor || '#8b6f4a'),
    [settings?.materials.tintColor]
  );
  const mountainTintPickerColor = useMemo(
    () => normalizeHexColor(settings?.walls.mountainTintColor || '#8b6f4a'),
    [settings?.walls.mountainTintColor]
  );

  const pathSets = useMemo(() => {
    const undercurrent = new Set<string>();
    const crust = new Set<string>();
    const detail = new Set<string>();
    const mountain = new Set<string>();
    if (!assetManifest) {
      return { undercurrent: [] as string[], crust: [] as string[], detail: [] as string[], mountain: [] as string[] };
    }

    const registerLayerPaths = (layer?: VisualBiomeTextureLayer) => {
      if (!layer) return;
      if (layer.default) {
        undercurrent.add(layer.default);
        crust.add(layer.default);
        detail.add(layer.default);
      }
      for (const value of Object.values(layer.themes || {})) {
        undercurrent.add(value);
        crust.add(value);
        detail.add(value);
      }
    };

    registerLayerPaths(assetManifest.biomeLayers?.undercurrent);
    registerLayerPaths(assetManifest.biomeLayers?.crust);
    for (const preset of Object.values(assetManifest.biomePresets || {})) {
      registerLayerPaths(preset?.biomeLayers?.undercurrent);
      registerLayerPaths(preset?.biomeLayers?.crust);
      if (preset?.biomeMaterials?.crust?.detailA) registerLayerPaths(preset.biomeMaterials.crust.detailA);
      if (preset?.biomeMaterials?.crust?.detailB) registerLayerPaths(preset.biomeMaterials.crust.detailB);
    }
    if (assetManifest.biomeUnderlay) {
      if (assetManifest.biomeUnderlay.default) crust.add(assetManifest.biomeUnderlay.default);
      for (const value of Object.values(assetManifest.biomeUnderlay.themes || {})) crust.add(value);
    }
    if (assetManifest.biomeMaterials?.crust?.detailA) registerLayerPaths(assetManifest.biomeMaterials.crust.detailA);
    if (assetManifest.biomeMaterials?.crust?.detailB) registerLayerPaths(assetManifest.biomeMaterials.crust.detailB);

    for (const asset of assetManifest.assets || []) {
      const tags = new Set((asset.tags || []).map(tag => tag.toLowerCase()));
      const isMountain = asset.type === 'prop' && (asset.id.toLowerCase().includes('mountain') || tags.has('mountain'));
      if (tags.has('floor') || tags.has('stone') || tags.has('void') || tags.has('frozen') || tags.has('inferno')) {
        crust.add(asset.path);
        detail.add(asset.path);
      }
      if (tags.has('lava') || tags.has('hazard') || tags.has('fire') || tags.has('quicksand')) {
        undercurrent.add(asset.path);
      }
      if (asset.type === 'decal' || asset.type === 'prop' || asset.type === 'tile') {
        detail.add(asset.path);
      }
      if (isMountain) {
        mountain.add(asset.path);
      }
    }
    if (assetManifest.walls?.mountainPath) {
      mountain.add(assetManifest.walls.mountainPath);
    }
    for (const override of Object.values(assetManifest.walls?.themes || {})) {
      if (override?.mountainPath) {
        mountain.add(override.mountainPath);
      }
    }
    for (const preset of Object.values(assetManifest.biomePresets || {})) {
      if (preset?.walls?.mountainPath) {
        mountain.add(preset.walls.mountainPath);
      }
      for (const override of Object.values(preset?.walls?.themes || {})) {
        if (override?.mountainPath) {
          mountain.add(override.mountainPath);
        }
      }
    }

    return {
      undercurrent: Array.from(undercurrent).sort((a, b) => a.localeCompare(b)),
      crust: Array.from(crust).sort((a, b) => a.localeCompare(b)),
      detail: Array.from(detail).sort((a, b) => a.localeCompare(b)),
      mountain: Array.from(mountain).sort((a, b) => a.localeCompare(b))
    };
  }, [assetManifest]);

  const previewManifest = useMemo((): VisualAssetManifest | null => {
    if (!assetManifest || !settings) return null;
    const underPath = toRuntimeAssetPath(settings.undercurrent.path);
    const crustPath = toRuntimeAssetPath(settings.crust.path);
    const detailAPath = toRuntimeAssetPath(settings.materials.detailA.path);
    const detailBPath = toRuntimeAssetPath(settings.materials.detailB.path);
    const presetBase = getBiomeThemePreset(assetManifest, themeKey) as VisualBiomeThemePreset | undefined;
    const underBase = presetBase?.biomeLayers?.undercurrent ?? assetManifest.biomeLayers?.undercurrent;
    const crustBase = presetBase?.biomeLayers?.crust
      ?? assetManifest.biomeLayers?.crust
      ?? (assetManifest.biomeUnderlay
        ? {
            default: assetManifest.biomeUnderlay.default,
            themes: assetManifest.biomeUnderlay.themes,
            mode: assetManifest.biomeUnderlay.mode,
            scalePx: assetManifest.biomeUnderlay.scalePx,
            opacity: assetManifest.biomeUnderlay.opacity
          } satisfies VisualBiomeTextureLayer
        : undefined);
    const crustMaterialBase = presetBase?.biomeMaterials?.crust ?? assetManifest.biomeMaterials?.crust;

    const undercurrentLayer: VisualBiomeTextureLayer | undefined = underBase || underPath
      ? {
          ...(underBase || { default: underPath || crustPath || '' }),
          default: underPath || underBase?.default || '',
          themes: { ...(underBase?.themes || {}), [themeKey]: underPath || underBase?.default || '' },
          mode: settings.undercurrent.mode,
          scalePx: clamp(settings.undercurrent.scalePx, UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX),
          opacity: clamp(settings.undercurrent.opacity, 0, 1),
          offsetX: settings.undercurrent.offsetX,
          offsetY: settings.undercurrent.offsetY,
          scroll: {
            x: settings.undercurrent.scrollX,
            y: settings.undercurrent.scrollY,
            durationMs: Math.max(1000, settings.undercurrent.scrollDurationMs)
          }
        }
      : undefined;

    const crustLayer: VisualBiomeTextureLayer | undefined = crustBase || crustPath
      ? {
          ...(crustBase || { default: crustPath || underPath || '' }),
          default: crustPath || crustBase?.default || '',
          themes: { ...(crustBase?.themes || {}), [themeKey]: crustPath || crustBase?.default || '' },
          mode: settings.crust.mode,
          scalePx: Math.max(64, settings.crust.scalePx),
          opacity: 1,
          seedShiftPx: Math.max(0, settings.crust.seedShiftPx),
          offsetX: settings.crust.offsetX,
          offsetY: settings.crust.offsetY
        }
      : undefined;

    const detailADefault = detailAPath || crustMaterialBase?.detailA?.default || '';
    const detailAThemes = { ...(crustMaterialBase?.detailA?.themes || {}) };
    if (detailADefault) detailAThemes[themeKey] = detailADefault;
    const detailALayer: VisualBiomeTextureLayer | undefined = detailADefault
      ? {
          ...(crustMaterialBase?.detailA || { default: detailADefault }),
          default: detailADefault,
          themes: detailAThemes,
          mode: settings.materials.detailA.mode,
          scalePx: clamp(settings.materials.detailA.scalePx, DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
          opacity: clamp(settings.materials.detailA.opacity, 0, 1)
        }
      : undefined;

    const detailBDefault = detailBPath || crustMaterialBase?.detailB?.default || '';
    const detailBThemes = { ...(crustMaterialBase?.detailB?.themes || {}) };
    if (detailBDefault) detailBThemes[themeKey] = detailBDefault;
    const detailBLayer: VisualBiomeTextureLayer | undefined = detailBDefault
      ? {
          ...(crustMaterialBase?.detailB || { default: detailBDefault }),
          default: detailBDefault,
          themes: detailBThemes,
          mode: settings.materials.detailB.mode,
          scalePx: clamp(settings.materials.detailB.scalePx, DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
          opacity: clamp(settings.materials.detailB.opacity, 0, 1)
        }
      : undefined;

    const tintDefault = String(settings.materials.tintColor || '').trim()
      || crustMaterialBase?.tint?.default
      || '#8b6f4a';
    const tintThemes = { ...(crustMaterialBase?.tint?.themes || {}) };
    tintThemes[themeKey] = tintDefault;
    const tintProfile: VisualBiomeTintProfile = {
      ...(crustMaterialBase?.tint || { default: tintDefault }),
      default: tintDefault,
      themes: tintThemes,
      opacity: clamp(settings.materials.tintOpacity, 0, 1),
      blendMode: readBlendMode(settings.materials.tintBlend)
    };
    const crustMaterialProfile: VisualBiomeMaterialProfile | undefined = (detailALayer || detailBLayer || tintProfile)
      ? {
          ...(crustMaterialBase || {}),
          detailA: detailALayer,
          detailB: detailBLayer,
          tint: tintProfile
        }
      : undefined;
    const resolvedMountainPath = toRuntimeAssetPath(settings.walls.mountainPath);
    const presetWallsBase = presetBase?.walls as VisualBiomeWallsProfile | undefined;
    const wallThemePatch: VisualBiomeWallsThemeOverride = {
      ...(presetWallsBase || assetManifest.walls?.themes?.[themeKey] || {}),
      mountainPath: resolvedMountainPath,
      scale: clamp(settings.walls.mountainScale, 0.2, 3),
      offsetX: settings.walls.mountainOffsetX,
      offsetY: settings.walls.mountainOffsetY,
      anchorX: clamp(settings.walls.mountainAnchorX, 0, 1),
      anchorY: clamp(settings.walls.mountainAnchorY, 0, 1),
      crustBlendMode: readMountainBlendMode(settings.walls.mountainCrustBlendMode),
      crustBlendOpacity: clamp(settings.walls.mountainCrustBlendOpacity, 0, 1),
      tintColor: normalizeHexColor(settings.walls.mountainTintColor, '#7d7d7d'),
      tintBlendMode: readMountainBlendMode(settings.walls.mountainTintBlendMode),
      tintOpacity: clamp(settings.walls.mountainTintOpacity, 0, 1),
      mountainScale: clamp(settings.walls.mountainScale, 0.2, 3),
      mountainOffsetX: settings.walls.mountainOffsetX,
      mountainOffsetY: settings.walls.mountainOffsetY,
      mountainAnchorX: clamp(settings.walls.mountainAnchorX, 0, 1),
      mountainAnchorY: clamp(settings.walls.mountainAnchorY, 0, 1),
      mountainCrustBlendMode: readMountainBlendMode(settings.walls.mountainCrustBlendMode),
      mountainCrustBlendOpacity: clamp(settings.walls.mountainCrustBlendOpacity, 0, 1),
      mountainTintColor: normalizeHexColor(settings.walls.mountainTintColor, '#7d7d7d'),
      mountainTintBlendMode: readMountainBlendMode(settings.walls.mountainTintBlendMode),
      mountainTintOpacity: clamp(settings.walls.mountainTintOpacity, 0, 1)
    };
    const wallsProfile: VisualBiomeWallsProfile = {
      ...(assetManifest.walls || {}),
      ...(presetWallsBase || {}),
      mode: settings.walls.mode,
      interiorDensity: clamp(settings.walls.interiorDensity, 0, 0.45),
      clusterBias: clamp(settings.walls.clusterBias, 0, 1),
      keepPerimeter: Boolean(settings.walls.keepPerimeter),
      mountainPath: resolvedMountainPath,
      scale: wallThemePatch.scale,
      offsetX: wallThemePatch.offsetX,
      offsetY: wallThemePatch.offsetY,
      anchorX: wallThemePatch.anchorX,
      anchorY: wallThemePatch.anchorY,
      crustBlendMode: wallThemePatch.crustBlendMode,
      crustBlendOpacity: wallThemePatch.crustBlendOpacity,
      tintColor: wallThemePatch.tintColor,
      tintBlendMode: wallThemePatch.tintBlendMode,
      tintOpacity: wallThemePatch.tintOpacity,
      mountainScale: wallThemePatch.mountainScale,
      mountainOffsetX: wallThemePatch.mountainOffsetX,
      mountainOffsetY: wallThemePatch.mountainOffsetY,
      mountainAnchorX: wallThemePatch.mountainAnchorX,
      mountainAnchorY: wallThemePatch.mountainAnchorY,
      mountainCrustBlendMode: wallThemePatch.mountainCrustBlendMode,
      mountainCrustBlendOpacity: wallThemePatch.mountainCrustBlendOpacity,
      mountainTintColor: wallThemePatch.mountainTintColor,
      mountainTintBlendMode: wallThemePatch.mountainTintBlendMode,
      mountainTintOpacity: wallThemePatch.mountainTintOpacity,
      themes: {
        ...(assetManifest.walls?.themes || {}),
        [themeKey]: wallThemePatch
      }
    };
    const presetLayers: VisualBiomeThemePreset['biomeLayers'] = {
      ...(presetBase?.biomeLayers || {}),
      undercurrent: undercurrentLayer,
      crust: crustLayer,
      clutter: {
        ...((presetBase?.biomeLayers?.clutter || assetManifest.biomeLayers?.clutter) || {}),
        density: clamp(settings.clutter.density, 0, 1),
        maxPerHex: Math.max(0, Math.floor(settings.clutter.maxPerHex)),
        bleedScaleMax: clamp(settings.clutter.bleedScaleMax, 1, 2)
      }
    };
    const presetMaterials: VisualBiomeThemePreset['biomeMaterials'] = {
      ...(presetBase?.biomeMaterials || {}),
      crust: crustMaterialProfile
    };
    const themePreset: VisualBiomeThemePreset = {
      ...(presetBase || {}),
      seed: settings.seed.trim() || 'biome-sandbox-seed',
      injectHazards: settings.injectHazards,
      biomeLayers: presetLayers,
      biomeMaterials: presetMaterials,
      walls: wallsProfile
    };

    return {
      ...assetManifest,
      biomeLayers: {
        ...(assetManifest.biomeLayers || {}),
        undercurrent: undercurrentLayer,
        crust: crustLayer,
        clutter: {
          ...(assetManifest.biomeLayers?.clutter || {}),
          density: clamp(settings.clutter.density, 0, 1),
          maxPerHex: Math.max(0, Math.floor(settings.clutter.maxPerHex)),
          bleedScaleMax: clamp(settings.clutter.bleedScaleMax, 1, 2)
        }
      },
      biomeMaterials: {
        ...(assetManifest.biomeMaterials || {}),
        crust: crustMaterialProfile
      },
      walls: wallsProfile,
      biomePresets: {
        ...(assetManifest.biomePresets || {}),
        [themeKey]: themePreset
      }
    };
  }, [assetManifest, settings, themeKey]);

  const previewState = useMemo(() => {
    if (!settings) return null;
    return buildPreviewState(settings.theme, settings.seed, settings.injectHazards, settings.walls);
  }, [settings]);

  const copySettings = async () => {
    if (!settings) return;
    const underPath = toManifestAssetPath(settings.undercurrent.path);
    const crustPath = toManifestAssetPath(settings.crust.path);
    const detailAPath = toManifestAssetPath(settings.materials.detailA.path);
    const detailBPath = toManifestAssetPath(settings.materials.detailB.path);
    const mountainPath = toManifestAssetPath(settings.walls.mountainPath);
    const wallThemePayload = {
      mountainPath,
      mountainScale: clamp(settings.walls.mountainScale, 0.2, 3),
      mountainOffsetX: settings.walls.mountainOffsetX,
      mountainOffsetY: settings.walls.mountainOffsetY,
      mountainAnchorX: clamp(settings.walls.mountainAnchorX, 0, 1),
      mountainAnchorY: clamp(settings.walls.mountainAnchorY, 0, 1),
      mountainCrustBlendMode: readMountainBlendMode(settings.walls.mountainCrustBlendMode),
      mountainCrustBlendOpacity: clamp(settings.walls.mountainCrustBlendOpacity, 0, 1),
      mountainTintColor: normalizeHexColor(settings.walls.mountainTintColor, '#7d7d7d'),
      mountainTintBlendMode: readMountainBlendMode(settings.walls.mountainTintBlendMode),
      mountainTintOpacity: clamp(settings.walls.mountainTintOpacity, 0, 1),
      scale: clamp(settings.walls.mountainScale, 0.2, 3),
      offsetX: settings.walls.mountainOffsetX,
      offsetY: settings.walls.mountainOffsetY,
      anchorX: clamp(settings.walls.mountainAnchorX, 0, 1),
      anchorY: clamp(settings.walls.mountainAnchorY, 0, 1),
      crustBlendMode: readMountainBlendMode(settings.walls.mountainCrustBlendMode),
      crustBlendOpacity: clamp(settings.walls.mountainCrustBlendOpacity, 0, 1),
      tintColor: normalizeHexColor(settings.walls.mountainTintColor, '#7d7d7d'),
      tintBlendMode: readMountainBlendMode(settings.walls.mountainTintBlendMode),
      tintOpacity: clamp(settings.walls.mountainTintOpacity, 0, 1)
    };
    const themePresetPayload = {
      seed: settings.seed.trim() || 'biome-sandbox-seed',
      injectHazards: settings.injectHazards,
      biomeLayers: {
        undercurrent: {
          default: underPath,
          mode: settings.undercurrent.mode,
          scalePx: clamp(settings.undercurrent.scalePx, UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX),
          opacity: clamp(settings.undercurrent.opacity, 0, 1),
          offsetX: settings.undercurrent.offsetX,
          offsetY: settings.undercurrent.offsetY,
          scroll: {
            x: settings.undercurrent.scrollX,
            y: settings.undercurrent.scrollY,
            durationMs: Math.max(1000, settings.undercurrent.scrollDurationMs)
          }
        },
        crust: {
          default: crustPath,
          mode: settings.crust.mode,
          scalePx: Math.max(64, settings.crust.scalePx),
          opacity: 1,
          seedShiftPx: settings.crust.seedShiftPx,
          offsetX: settings.crust.offsetX,
          offsetY: settings.crust.offsetY
        },
        clutter: {
          density: settings.clutter.density,
          maxPerHex: settings.clutter.maxPerHex,
          bleedScaleMax: settings.clutter.bleedScaleMax
        }
      },
      walls: {
        mode: settings.walls.mode,
        interiorDensity: settings.walls.interiorDensity,
        clusterBias: settings.walls.clusterBias,
        keepPerimeter: settings.walls.keepPerimeter,
        ...wallThemePayload
      },
      biomeMaterials: {
        crust: {
          detailA: {
            default: detailAPath,
            mode: settings.materials.detailA.mode,
            scalePx: clamp(settings.materials.detailA.scalePx, DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
            opacity: clamp(settings.materials.detailA.opacity, 0, 1)
          },
          detailB: {
            default: detailBPath,
            mode: settings.materials.detailB.mode,
            scalePx: clamp(settings.materials.detailB.scalePx, DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
            opacity: clamp(settings.materials.detailB.opacity, 0, 1)
          },
          tint: {
            default: normalizeHexColor(settings.materials.tintColor, '#8b6f4a'),
            opacity: clamp(settings.materials.tintOpacity, 0, 1),
            blendMode: readBlendMode(settings.materials.tintBlend)
          }
        }
      }
    };
    const payload = {
      theme: settings.theme,
      seed: settings.seed.trim() || 'biome-sandbox-seed',
      injectHazards: settings.injectHazards,
      biomeLayers: {
        undercurrent: {
          default: underPath,
          mode: settings.undercurrent.mode,
          scalePx: clamp(settings.undercurrent.scalePx, UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX),
          opacity: clamp(settings.undercurrent.opacity, 0, 1),
          offsetX: settings.undercurrent.offsetX,
          offsetY: settings.undercurrent.offsetY,
          scroll: {
            x: settings.undercurrent.scrollX,
            y: settings.undercurrent.scrollY,
            durationMs: Math.max(1000, settings.undercurrent.scrollDurationMs)
          }
        },
        crust: {
          default: crustPath,
          mode: settings.crust.mode,
          scalePx: Math.max(64, settings.crust.scalePx),
          opacity: 1,
          seedShiftPx: settings.crust.seedShiftPx,
          offsetX: settings.crust.offsetX,
          offsetY: settings.crust.offsetY
        },
        clutter: {
          density: settings.clutter.density,
          maxPerHex: settings.clutter.maxPerHex,
          bleedScaleMax: settings.clutter.bleedScaleMax
        }
      },
      walls: {
        mode: settings.walls.mode,
        interiorDensity: settings.walls.interiorDensity,
        clusterBias: settings.walls.clusterBias,
        keepPerimeter: settings.walls.keepPerimeter,
        ...wallThemePayload,
        themes: {
          [themeKey]: wallThemePayload
        }
      },
      biomeMaterials: {
        crust: {
          detailA: {
            default: detailAPath,
            mode: settings.materials.detailA.mode,
            scalePx: clamp(settings.materials.detailA.scalePx, DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
            opacity: clamp(settings.materials.detailA.opacity, 0, 1)
          },
          detailB: {
            default: detailBPath,
            mode: settings.materials.detailB.mode,
            scalePx: clamp(settings.materials.detailB.scalePx, DETAIL_SCALE_MIN, DETAIL_SCALE_MAX),
            opacity: clamp(settings.materials.detailB.opacity, 0, 1)
          },
          tint: {
            default: normalizeHexColor(settings.materials.tintColor, '#8b6f4a'),
            opacity: clamp(settings.materials.tintOpacity, 0, 1),
            blendMode: readBlendMode(settings.materials.tintBlend)
          }
        }
      },
      biomePresets: {
        [themeKey]: themePresetPayload
      }
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopyStatus('Copied');
      window.setTimeout(() => setCopyStatus(''), 1600);
    } catch {
      setCopyStatus('Copy failed');
      window.setTimeout(() => setCopyStatus(''), 1600);
    }
  };

  if (!assetManifest || !settings || !previewManifest || !previewState) {
    return (
      <div className="w-screen h-screen bg-[#030712] text-white flex items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute top-5 left-5 px-4 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-xs font-black uppercase tracking-[0.2em]"
        >
          Back
        </button>
        <div className="text-sm text-white/70 uppercase tracking-[0.25em] font-black">Loading Biome Sandbox...</div>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-[#030712] text-white flex">
      <aside className="w-[420px] border-r border-white/10 bg-[#02040a] overflow-y-auto">
        <div className="sticky top-0 z-20 border-b border-white/10 bg-[#02040a]/95 backdrop-blur p-4">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setSettings(defaultsFromManifest(assetManifest, settings.theme))}
              className="px-3 py-2 rounded-lg border border-amber-300/40 bg-amber-500/10 hover:bg-amber-500/20 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={copySettings}
              className="px-3 py-2 rounded-lg border border-cyan-300/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-[11px] font-black uppercase tracking-[0.18em]"
            >
              Copy JSON
            </button>
          </div>
          <div className="mt-3 text-[10px] uppercase tracking-[0.22em] text-white/50">
            Hop / Biomes {copyStatus ? `* ${copyStatus}` : ''}
          </div>
        </div>

        <div className="p-4 space-y-6">
          <section className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-white/75">Preview</div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Theme</label>
            <select
              value={settings.theme}
              onChange={(e) => setSettings(prev => prev ? { ...prev, theme: e.target.value as FloorTheme } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              {FLOOR_THEMES.map(theme => (
                <option key={theme} value={theme}>{theme}</option>
              ))}
            </select>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Seed</label>
            <input
              value={settings.seed}
              onChange={(e) => setSettings(prev => prev ? { ...prev, seed: e.target.value } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input
                type="checkbox"
                checked={settings.injectHazards}
                onChange={(e) => setSettings(prev => prev ? { ...prev, injectHazards: e.target.checked } : prev)}
              />
              Inject synthetic lava/fire patches for mask testing
            </label>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Undercurrent</div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Asset Path</label>
            <input
              list="sandbox-undercurrent-paths"
              value={settings.undercurrent.path}
              onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, path: e.target.value } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
            />
            <datalist id="sandbox-undercurrent-paths">
              {pathSets.undercurrent.map(path => (
                <option key={path} value={path} />
              ))}
            </datalist>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Mode</label>
            <select
              value={settings.undercurrent.mode}
              onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, mode: e.target.value as LayerMode } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              {MODE_OPTIONS.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scale Px</label>
                <input
                  type="number"
                  min={UNDERCURRENT_SCALE_MIN}
                  max={UNDERCURRENT_SCALE_MAX}
                  step={16}
                  value={settings.undercurrent.scalePx}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    undercurrent: {
                      ...prev.undercurrent,
                      scalePx: clamp(toNumber(e.target.value, prev.undercurrent.scalePx), UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX)
                    }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Opacity</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.undercurrent.opacity}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, opacity: clamp(toNumber(e.target.value, prev.undercurrent.opacity), 0, 1) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scroll X</label>
                <input
                  type="number"
                  step={5}
                  value={settings.undercurrent.scrollX}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, scrollX: toNumber(e.target.value, prev.undercurrent.scrollX) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scroll Y</label>
                <input
                  type="number"
                  step={5}
                  value={settings.undercurrent.scrollY}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, scrollY: toNumber(e.target.value, prev.undercurrent.scrollY) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Duration</label>
                <input
                  type="number"
                  min={1000}
                  step={500}
                  value={settings.undercurrent.scrollDurationMs}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, scrollDurationMs: Math.max(1000, toNumber(e.target.value, prev.undercurrent.scrollDurationMs)) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset X</label>
                <input
                  type="number"
                  step={4}
                  value={settings.undercurrent.offsetX}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, offsetX: toNumber(e.target.value, prev.undercurrent.offsetX) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset Y</label>
                <input
                  type="number"
                  step={4}
                  value={settings.undercurrent.offsetY}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, undercurrent: { ...prev.undercurrent, offsetY: toNumber(e.target.value, prev.undercurrent.offsetY) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">Crust</div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Asset Path</label>
            <input
              list="sandbox-crust-paths"
              value={settings.crust.path}
              onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, path: e.target.value } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
            />
            <datalist id="sandbox-crust-paths">
              {pathSets.crust.map(path => (
                <option key={path} value={path} />
              ))}
            </datalist>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Mode</label>
            <select
              value={settings.crust.mode}
              onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, mode: e.target.value as LayerMode } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              {MODE_OPTIONS.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scale Px</label>
                <input
                  type="number"
                  min={64}
                  step={16}
                  value={settings.crust.scalePx}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, scalePx: Math.max(64, toNumber(e.target.value, prev.crust.scalePx)) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Opacity</label>
                <input
                  type="number"
                  min={1}
                  max={1}
                  step={0.01}
                  value={1}
                  onChange={() => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, opacity: 1 } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Seed Shift Budget</label>
              <input
                type="number"
                min={0}
                step={8}
                value={settings.crust.seedShiftPx}
                onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, seedShiftPx: Math.max(0, toNumber(e.target.value, prev.crust.seedShiftPx)) } } : prev)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset X</label>
                <input
                  type="number"
                  step={4}
                  value={settings.crust.offsetX}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, offsetX: toNumber(e.target.value, prev.crust.offsetX) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset Y</label>
                <input
                  type="number"
                  step={4}
                  value={settings.crust.offsetY}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, crust: { ...prev.crust, offsetY: toNumber(e.target.value, prev.crust.offsetY) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-rose-200">Walls / Mountains</div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Mountain Asset</label>
            <input
              list="sandbox-mountain-paths"
              value={settings.walls.mountainPath}
              onChange={(e) => setSettings(prev => prev ? {
                ...prev,
                walls: { ...prev.walls, mountainPath: e.target.value }
              } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
              placeholder="/assets/biomes/biome.volcano.mountain.01.webp"
            />
            <datalist id="sandbox-mountain-paths">
              {pathSets.mountain.map(path => (
                <option key={path} value={path} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Scale</label>
                <input
                  type="number"
                  min={0.2}
                  max={3}
                  step={0.01}
                  value={settings.walls.mountainScale}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainScale: clamp(toNumber(e.target.value, prev.walls.mountainScale), 0.2, 3) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Anchor X</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.walls.mountainAnchorX}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainAnchorX: clamp(toNumber(e.target.value, prev.walls.mountainAnchorX), 0, 1) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset X</label>
                <input
                  type="number"
                  step={2}
                  value={settings.walls.mountainOffsetX}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainOffsetX: toNumber(e.target.value, prev.walls.mountainOffsetX) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Offset Y</label>
                <input
                  type="number"
                  step={2}
                  value={settings.walls.mountainOffsetY}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainOffsetY: toNumber(e.target.value, prev.walls.mountainOffsetY) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Anchor Y</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={settings.walls.mountainAnchorY}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  walls: { ...prev.walls, mountainAnchorY: clamp(toNumber(e.target.value, prev.walls.mountainAnchorY), 0, 1) }
                } : prev)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Crust Blend</label>
                <select
                  value={settings.walls.mountainCrustBlendMode}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainCrustBlendMode: readMountainBlendMode(e.target.value) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                >
                  {MOUNTAIN_BLEND_OPTIONS.map(mode => (
                    <option key={`mountain-blend-${mode}`} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
                  Blend Opacity {settings.walls.mountainCrustBlendOpacity.toFixed(2)}
                </label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.walls.mountainCrustBlendOpacity}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainCrustBlendOpacity: clamp(toNumber(e.target.value, prev.walls.mountainCrustBlendOpacity), 0, 1) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Mountain Tint</div>
            <div className="grid grid-cols-[72px_1fr] gap-3">
              <input
                type="color"
                value={mountainTintPickerColor}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  walls: { ...prev.walls, mountainTintColor: e.target.value }
                } : prev)}
                className="h-10 w-full rounded-lg border border-white/15 bg-white/5 p-1 cursor-pointer"
                aria-label="Mountain Tint Color Picker"
              />
              <input
                value={settings.walls.mountainTintColor}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  walls: { ...prev.walls, mountainTintColor: e.target.value }
                } : prev)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                placeholder="#8b6f4a"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Tint Blend</label>
                <select
                  value={settings.walls.mountainTintBlendMode}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainTintBlendMode: readMountainBlendMode(e.target.value) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                >
                  {MOUNTAIN_BLEND_OPTIONS.map(mode => (
                    <option key={`mountain-tint-blend-${mode}`} value={mode}>{mode}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
                  Tint Opacity {settings.walls.mountainTintOpacity.toFixed(2)}
                </label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={settings.walls.mountainTintOpacity}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    walls: { ...prev.walls, mountainTintOpacity: clamp(toNumber(e.target.value, prev.walls.mountainTintOpacity), 0, 1) }
                  } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Wall Layout Mode</label>
            <select
              value={settings.walls.mode}
              onChange={(e) => setSettings(prev => prev ? {
                ...prev,
                walls: { ...prev.walls, mode: e.target.value as WallMode }
              } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              {WALL_MODE_OPTIONS.map(mode => (
                <option key={`wall-mode-${mode}`} value={mode}>{mode}</option>
              ))}
            </select>
            <div className="space-y-2">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
                Interior Density {settings.walls.interiorDensity.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={0.45}
                step={0.01}
                value={settings.walls.interiorDensity}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  walls: { ...prev.walls, interiorDensity: clamp(toNumber(e.target.value, prev.walls.interiorDensity), 0, 0.45) }
                } : prev)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
                Cluster Bias {settings.walls.clusterBias.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.walls.clusterBias}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  walls: { ...prev.walls, clusterBias: clamp(toNumber(e.target.value, prev.walls.clusterBias), 0, 1) }
                } : prev)}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-white/80">
              <input
                type="checkbox"
                checked={settings.walls.keepPerimeter}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  walls: { ...prev.walls, keepPerimeter: e.target.checked }
                } : prev)}
              />
              Keep perimeter walls (custom mode)
            </label>
          </section>

          <section className="space-y-3">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-200">Crust Materials</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">Detail A</div>
            <input
              list="sandbox-detail-paths"
              value={settings.materials.detailA.path}
              onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailA: { ...prev.materials.detailA, path: e.target.value } } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
            />
            <datalist id="sandbox-detail-paths">
              {pathSets.detail.map(path => (
                <option key={path} value={path} />
              ))}
            </datalist>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={settings.materials.detailA.mode}
                onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailA: { ...prev.materials.detailA, mode: e.target.value as LayerMode } } } : prev)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              >
                {MODE_OPTIONS.map(mode => (
                  <option key={`detail-a-${mode}`} value={mode}>{mode}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={settings.materials.detailA.opacity}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  materials: {
                    ...prev.materials,
                    detailA: { ...prev.materials.detailA, opacity: clamp(toNumber(e.target.value, prev.materials.detailA.opacity), 0, 1) }
                  }
                } : prev)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <input
              type="number"
              min={DETAIL_SCALE_MIN}
              max={DETAIL_SCALE_MAX}
              step={16}
              value={settings.materials.detailA.scalePx}
              onChange={(e) => setSettings(prev => prev ? {
                ...prev,
                materials: {
                  ...prev.materials,
                  detailA: {
                    ...prev.materials.detailA,
                    scalePx: clamp(toNumber(e.target.value, prev.materials.detailA.scalePx), DETAIL_SCALE_MIN, DETAIL_SCALE_MAX)
                  }
                }
              } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />

            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 pt-1">Detail B</div>
            <input
              list="sandbox-detail-paths"
              value={settings.materials.detailB.path}
              onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailB: { ...prev.materials.detailB, path: e.target.value } } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-3">
              <select
                value={settings.materials.detailB.mode}
                onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, detailB: { ...prev.materials.detailB, mode: e.target.value as LayerMode } } } : prev)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              >
                {MODE_OPTIONS.map(mode => (
                  <option key={`detail-b-${mode}`} value={mode}>{mode}</option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={settings.materials.detailB.opacity}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  materials: {
                    ...prev.materials,
                    detailB: { ...prev.materials.detailB, opacity: clamp(toNumber(e.target.value, prev.materials.detailB.opacity), 0, 1) }
                  }
                } : prev)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <input
              type="number"
              min={DETAIL_SCALE_MIN}
              max={DETAIL_SCALE_MAX}
              step={16}
              value={settings.materials.detailB.scalePx}
              onChange={(e) => setSettings(prev => prev ? {
                ...prev,
                materials: {
                  ...prev.materials,
                  detailB: {
                    ...prev.materials.detailB,
                    scalePx: clamp(toNumber(e.target.value, prev.materials.detailB.scalePx), DETAIL_SCALE_MIN, DETAIL_SCALE_MAX)
                  }
                }
              } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            />

            <div className="text-[10px] uppercase tracking-[0.18em] text-white/45 pt-1">Tint</div>
            <div className="grid grid-cols-[72px_1fr] gap-3">
              <input
                type="color"
                value={tintPickerColor}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  materials: { ...prev.materials, tintColor: e.target.value }
                } : prev)}
                className="h-10 w-full rounded-lg border border-white/15 bg-white/5 p-1 cursor-pointer"
                aria-label="Tint Color Picker"
              />
              <input
                value={settings.materials.tintColor}
                onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, tintColor: e.target.value } } : prev)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                placeholder="#8b6f4a"
              />
            </div>
            <div className="grid grid-cols-8 gap-2">
              {TINT_SWATCHES.map((swatch) => (
                <button
                  key={`tint-swatch-${swatch}`}
                  type="button"
                  onClick={() => setSettings(prev => prev ? {
                    ...prev,
                    materials: { ...prev.materials, tintColor: swatch }
                  } : prev)}
                  className={`h-6 rounded border ${normalizeHexColor(settings.materials.tintColor) === normalizeHexColor(swatch) ? 'border-white' : 'border-white/20'}`}
                  style={{ backgroundColor: swatch }}
                  title={swatch}
                />
              ))}
            </div>
            <div className="space-y-2">
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">
                Tint Opacity {settings.materials.tintOpacity.toFixed(2)}
              </label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={settings.materials.tintOpacity}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  materials: {
                    ...prev.materials,
                    tintOpacity: clamp(toNumber(e.target.value, prev.materials.tintOpacity), 0, 1)
                  }
                } : prev)}
                className="w-full"
              />
            </div>
            <select
              value={settings.materials.tintBlend}
              onChange={(e) => setSettings(prev => prev ? { ...prev, materials: { ...prev.materials, tintBlend: readBlendMode(e.target.value) } } : prev)}
              className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
            >
              {BLEND_OPTIONS.map(mode => (
                <option key={`blend-${mode}`} value={mode}>{mode}</option>
              ))}
            </select>
          </section>

          <section className="space-y-3 pb-8">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-200">Clutter</div>
            <div>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Density</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={settings.clutter.density}
                onChange={(e) => setSettings(prev => prev ? { ...prev, clutter: { ...prev.clutter, density: clamp(toNumber(e.target.value, prev.clutter.density), 0, 1) } } : prev)}
                className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Max / Hex</label>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={1}
                  value={settings.clutter.maxPerHex}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, clutter: { ...prev.clutter, maxPerHex: Math.max(0, Math.floor(toNumber(e.target.value, prev.clutter.maxPerHex))) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-[0.16em] text-white/60">Bleed Max</label>
                <input
                  type="number"
                  min={1}
                  max={2}
                  step={0.01}
                  value={settings.clutter.bleedScaleMax}
                  onChange={(e) => setSettings(prev => prev ? { ...prev, clutter: { ...prev.clutter, bleedScaleMax: clamp(toNumber(e.target.value, prev.clutter.bleedScaleMax), 1, 2) } } : prev)}
                  className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>
        </div>
      </aside>

      <main className="flex-1 relative bg-[#050914] overflow-hidden">
        <div className="absolute top-4 right-5 z-20 px-3 py-2 rounded-lg border border-white/15 bg-black/35 text-[10px] font-black uppercase tracking-[0.2em]">
          Theme: {settings.theme}
        </div>
        <div className="w-full h-full p-6">
          <div className="w-full h-full rounded-[28px] border border-white/10 bg-[#030712]/70 overflow-hidden">
            <GameBoard
              gameState={previewState}
              onMove={() => {}}
              selectedSkillId={null}
              showMovementRange={false}
              assetManifest={previewManifest}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
