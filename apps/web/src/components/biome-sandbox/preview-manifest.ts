import type { BiomeSandboxSettings, BlendMode, MountainBlendMode } from './types';
import type {
  VisualAssetManifest,
  VisualBiomeMaterialProfile,
  VisualBiomeThemePreset,
  VisualBiomeTextureLayer,
  VisualBiomeTintProfile,
  VisualBiomeWallsProfile,
  VisualBiomeWallsThemeOverride
} from '../../visual/asset-manifest';
import { getBiomeThemePreset } from '../../visual/asset-manifest';

const BASE_URL = import.meta.env.BASE_URL || '/';
const UNDERCURRENT_SCALE_MIN = 64;
const UNDERCURRENT_SCALE_MAX = 192;
const DETAIL_SCALE_MIN = 64;
const DETAIL_SCALE_MAX = 512;

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

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

export const buildBiomeSandboxPreviewManifest = (
  assetManifest: VisualAssetManifest | null,
  settings: BiomeSandboxSettings | null,
  themeKey: string
): VisualAssetManifest | null => {
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
};
