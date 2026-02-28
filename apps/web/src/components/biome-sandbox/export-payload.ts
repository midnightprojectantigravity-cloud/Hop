import type {
  BiomeSandboxSettings,
  BlendMode,
  MountainBlendMode
} from './types';

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

const toManifestAssetPath = (assetPath: string): string => {
  const trimmed = assetPath.trim();
  if (!trimmed) return trimmed;
  if (/^\/assets\/[a-z0-9/_\-.]+$/i.test(trimmed)) return trimmed;
  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const baseAssetsPrefix = `${normalizedBase}assets/`;
  if (trimmed.startsWith(baseAssetsPrefix)) {
    return `/assets/${trimmed.slice(baseAssetsPrefix.length)}`;
  }
  if (!trimmed.startsWith('/')) return joinBase(BASE_URL, trimmed);
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

export const buildBiomeSandboxExportPayload = (settings: BiomeSandboxSettings) => {
  const themeKey = settings.theme.toLowerCase();
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

  return {
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
};
