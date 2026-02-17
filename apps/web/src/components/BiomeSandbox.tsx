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
  VisualBiomeTextureLayer,
  VisualBiomeMaterialProfile,
  VisualBiomeTintProfile,
  VisualBlendMode
} from '../visual/asset-manifest';

type LayerMode = 'off' | 'cover' | 'repeat';
type BlendMode = VisualBlendMode;

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
const TINT_SWATCHES: string[] = ['#8b6f4a', '#8f4a2e', '#5b6d41', '#536e8e', '#5f5977', '#b79a73', '#d15a3a', '#3e4f3a'];

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

const buildPreviewState = (theme: FloorTheme, seed: string, injectHazards: boolean): GameState => {
  const floor = themeFloor(theme);
  const safeSeed = seed.trim() || 'biome-sandbox-seed';
  const base = generateInitialState(floor, safeSeed, safeSeed, undefined, DEFAULT_LOADOUTS.VANGUARD);
  const tiles = cloneTiles(base);
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
  const undercurrentLayer = manifest.biomeLayers?.undercurrent;
  const crustLayer = manifest.biomeLayers?.crust
    ?? (manifest.biomeUnderlay
      ? {
          default: manifest.biomeUnderlay.default,
          themes: manifest.biomeUnderlay.themes,
          mode: manifest.biomeUnderlay.mode,
          scalePx: manifest.biomeUnderlay.scalePx,
          opacity: manifest.biomeUnderlay.opacity
        } satisfies VisualBiomeTextureLayer
      : undefined);
  const crustMaterial = manifest.biomeMaterials?.crust;
  const detailA = crustMaterial?.detailA;
  const detailB = crustMaterial?.detailB;
  const tint = crustMaterial?.tint;

  return {
    theme,
    seed: 'biome-sandbox-seed',
    injectHazards: true,
    undercurrent: {
      path: resolveLayerPath(undercurrentLayer, themeKey),
      mode: readLayerMode(undercurrentLayer),
      scalePx: clamp(Number(undercurrentLayer?.scalePx ?? manifest.tileUnitPx ?? 256), UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX),
      opacity: clamp(Number(undercurrentLayer?.opacity ?? 0.6), 0, 1),
      scrollX: Number(undercurrentLayer?.scroll?.x ?? 120),
      scrollY: Number(undercurrentLayer?.scroll?.y ?? 90),
      scrollDurationMs: Math.max(1000, Number(undercurrentLayer?.scroll?.durationMs ?? 18000)),
      offsetX: 0,
      offsetY: 0
    },
    crust: {
      path: resolveLayerPath(crustLayer, themeKey),
      mode: readLayerMode(crustLayer),
      scalePx: Math.max(64, Number(crustLayer?.scalePx ?? manifest.tileUnitPx ?? 256)),
      opacity: 1,
      seedShiftPx: Math.max(0, Number(crustLayer?.seedShiftPx ?? 96)),
      offsetX: 0,
      offsetY: 0
    },
    clutter: {
      density: clamp(Number(manifest.biomeLayers?.clutter?.density ?? 0.14), 0, 1),
      maxPerHex: Math.max(0, Number(manifest.biomeLayers?.clutter?.maxPerHex ?? 1)),
      bleedScaleMax: clamp(Number(manifest.biomeLayers?.clutter?.bleedScaleMax ?? 2), 1, 2)
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

  const pathSets = useMemo(() => {
    const undercurrent = new Set<string>();
    const crust = new Set<string>();
    const detail = new Set<string>();
    if (!assetManifest) return { undercurrent: [] as string[], crust: [] as string[], detail: [] as string[] };

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
    if (assetManifest.biomeUnderlay) {
      if (assetManifest.biomeUnderlay.default) crust.add(assetManifest.biomeUnderlay.default);
      for (const value of Object.values(assetManifest.biomeUnderlay.themes || {})) crust.add(value);
    }
    if (assetManifest.biomeMaterials?.crust?.detailA) registerLayerPaths(assetManifest.biomeMaterials.crust.detailA);
    if (assetManifest.biomeMaterials?.crust?.detailB) registerLayerPaths(assetManifest.biomeMaterials.crust.detailB);

    for (const asset of assetManifest.assets || []) {
      const tags = new Set((asset.tags || []).map(tag => tag.toLowerCase()));
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
    }

    return {
      undercurrent: Array.from(undercurrent).sort((a, b) => a.localeCompare(b)),
      crust: Array.from(crust).sort((a, b) => a.localeCompare(b)),
      detail: Array.from(detail).sort((a, b) => a.localeCompare(b))
    };
  }, [assetManifest]);

  const previewManifest = useMemo((): VisualAssetManifest | null => {
    if (!assetManifest || !settings) return null;
    const underPath = toRuntimeAssetPath(settings.undercurrent.path);
    const crustPath = toRuntimeAssetPath(settings.crust.path);
    const detailAPath = toRuntimeAssetPath(settings.materials.detailA.path);
    const detailBPath = toRuntimeAssetPath(settings.materials.detailB.path);
    const underBase = assetManifest.biomeLayers?.undercurrent;
    const crustBase = assetManifest.biomeLayers?.crust
      ?? (assetManifest.biomeUnderlay
        ? {
            default: assetManifest.biomeUnderlay.default,
            themes: assetManifest.biomeUnderlay.themes,
            mode: assetManifest.biomeUnderlay.mode,
            scalePx: assetManifest.biomeUnderlay.scalePx,
            opacity: assetManifest.biomeUnderlay.opacity
          } satisfies VisualBiomeTextureLayer
        : undefined);
    const crustMaterialBase = assetManifest.biomeMaterials?.crust;

    const undercurrentLayer: VisualBiomeTextureLayer | undefined = underBase || underPath
      ? {
          ...(underBase || { default: underPath || crustPath || '' }),
          default: underPath || underBase?.default || '',
          themes: { ...(underBase?.themes || {}), [themeKey]: underPath || underBase?.default || '' },
          mode: settings.undercurrent.mode,
          scalePx: clamp(settings.undercurrent.scalePx, UNDERCURRENT_SCALE_MIN, UNDERCURRENT_SCALE_MAX),
          opacity: clamp(settings.undercurrent.opacity, 0, 1),
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
          seedShiftPx: Math.max(0, settings.crust.seedShiftPx)
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
      }
    };
  }, [assetManifest, settings, themeKey]);

  const previewState = useMemo(() => {
    if (!settings) return null;
    return buildPreviewState(settings.theme, settings.seed, settings.injectHazards);
  }, [settings]);

  const copySettings = async () => {
    if (!settings) return;
    const payload = {
      theme: settings.theme,
      seed: settings.seed.trim() || 'biome-sandbox-seed',
      biomeLayers: {
        undercurrent: {
          default: settings.undercurrent.path,
          mode: settings.undercurrent.mode,
          scalePx: settings.undercurrent.scalePx,
          opacity: settings.undercurrent.opacity,
          scroll: {
            x: settings.undercurrent.scrollX,
            y: settings.undercurrent.scrollY,
            durationMs: settings.undercurrent.scrollDurationMs
          },
          debugOffset: { x: settings.undercurrent.offsetX, y: settings.undercurrent.offsetY }
        },
        crust: {
          default: settings.crust.path,
          mode: settings.crust.mode,
          scalePx: settings.crust.scalePx,
          opacity: 1,
          seedShiftPx: settings.crust.seedShiftPx,
          debugOffset: { x: settings.crust.offsetX, y: settings.crust.offsetY }
        },
        clutter: {
          density: settings.clutter.density,
          maxPerHex: settings.clutter.maxPerHex,
          bleedScaleMax: settings.clutter.bleedScaleMax
        }
      },
      biomeMaterials: {
        crust: {
          detailA: {
            default: settings.materials.detailA.path,
            mode: settings.materials.detailA.mode,
            scalePx: settings.materials.detailA.scalePx,
            opacity: settings.materials.detailA.opacity
          },
          detailB: {
            default: settings.materials.detailB.path,
            mode: settings.materials.detailB.mode,
            scalePx: settings.materials.detailB.scalePx,
            opacity: settings.materials.detailB.opacity
          },
          tint: {
            default: settings.materials.tintColor,
            opacity: settings.materials.tintOpacity,
            blendMode: settings.materials.tintBlend
          }
        }
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
              biomeDebug={{
                undercurrentOffset: { x: settings.undercurrent.offsetX, y: settings.undercurrent.offsetY },
                crustOffset: { x: settings.crust.offsetX, y: settings.crust.offsetY }
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
};
