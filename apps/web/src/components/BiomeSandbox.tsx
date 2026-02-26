import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LOADOUTS,
  generateInitialState,
  pointToKey,
  type FloorTheme,
  type GameState,
  type Point
} from '@hop/engine';
import { BiomeSandboxControlsPanel } from './biome-sandbox/BiomeSandboxControlsPanel';
import { buildBiomeSandboxPreviewManifest } from './biome-sandbox/preview-manifest';
import { BiomeSandboxPreviewPane } from './biome-sandbox/BiomeSandboxPreviewPane';
import { buildBiomeSandboxExportPayload } from './biome-sandbox/export-payload';
import { useBiomeSandboxPathSets } from './biome-sandbox/use-biome-sandbox-path-sets';
import type {
  VisualAssetManifest,
  VisualBiomeThemePreset,
  VisualBiomeTextureLayer,
  VisualBiomeTintProfile,
  VisualBiomeWallsProfile,
  VisualBiomeWallsThemeOverride,
  VisualMountainRenderSettings,
  VisualBlendMode
} from '../visual/asset-manifest';
import { getBiomeThemePreset } from '../visual/asset-manifest';

export type LayerMode = 'off' | 'cover' | 'repeat';
export type BlendMode = VisualBlendMode;
export type MountainBlendMode = 'off' | BlendMode;

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

export type WallMode = 'native' | 'additive' | 'custom';

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

export type BiomeSandboxSettings = {
  theme: FloorTheme;
  seed: string;
  injectHazards: boolean;
  undercurrent: UndercurrentSettings;
  crust: CrustSettings;
  clutter: ClutterSettings;
  walls: WallSettings;
  materials: CrustMaterialSettings;
};

export type BiomeSandboxPathSets = {
  undercurrent: string[];
  crust: string[];
  detail: string[];
  mountain: string[];
};

interface BiomeSandboxProps {
  assetManifest: VisualAssetManifest | null;
  onBack: () => void;
}

const SETTINGS_STORAGE_KEY = 'hop_biome_sandbox_settings_v1';
const UNDERCURRENT_SCALE_MIN = 64;
const UNDERCURRENT_SCALE_MAX = 192;
const DETAIL_SCALE_MIN = 64;
const DETAIL_SCALE_MAX = 512;
const AXIAL_NEIGHBOR_OFFSETS: Point[] = [
  { q: 1, r: 0, s: -1 },
  { q: 0, r: 1, s: -1 },
  { q: -1, r: 1, s: 0 },
  { q: -1, r: 0, s: 1 },
  { q: 0, r: -1, s: 1 },
  { q: 1, r: -1, s: 0 }
];

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

  const pathSets = useBiomeSandboxPathSets(assetManifest);

  const previewManifest = useMemo(
    () => buildBiomeSandboxPreviewManifest(assetManifest, settings, themeKey),
    [assetManifest, settings, themeKey]
  );

  const previewState = useMemo(() => {
    if (!settings) return null;
    return buildPreviewState(settings.theme, settings.seed, settings.injectHazards, settings.walls);
  }, [settings]);

  const copySettings = async () => {
    if (!settings) return;
    const payload = buildBiomeSandboxExportPayload(settings);
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
      <BiomeSandboxControlsPanel
        settings={settings}
        setSettings={setSettings}
        pathSets={pathSets}
        copyStatus={copyStatus}
        onBack={onBack}
        onReset={() => setSettings(defaultsFromManifest(assetManifest, settings.theme))}
        onCopySettings={copySettings}
        tintPickerColor={tintPickerColor}
        mountainTintPickerColor={mountainTintPickerColor}
      />

      <BiomeSandboxPreviewPane
        theme={settings.theme}
        previewState={previewState}
        previewManifest={previewManifest}
      />
    </div>
  );
};

