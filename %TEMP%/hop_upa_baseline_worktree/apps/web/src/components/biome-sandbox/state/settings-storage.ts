import type {
  BiomeSandboxSettings,
  WallMode
} from '../types';
import {
  DETAIL_SCALE_MAX,
  DETAIL_SCALE_MIN,
  UNDERCURRENT_SCALE_MAX,
  UNDERCURRENT_SCALE_MIN,
  clamp,
  normalizeHexColor,
  readBlendMode,
  readMountainBlendMode,
  toNumber
} from './settings-utils';

export const SETTINGS_STORAGE_KEY = 'hop_biome_sandbox_settings_v1';

const isWallMode = (value: unknown): value is WallMode =>
  value === 'native' || value === 'additive' || value === 'custom';

export const parseStoredSettings = (raw: string | null): BiomeSandboxSettings | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BiomeSandboxSettings>;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as BiomeSandboxSettings;
  } catch {
    return null;
  }
};

export const hydrateStoredSettings = (
  defaults: BiomeSandboxSettings,
  stored: BiomeSandboxSettings | null
): BiomeSandboxSettings => {
  if (!stored) return defaults;
  return {
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
      mode: isWallMode((stored.walls || {}).mode) ? (stored.walls || {}).mode : defaults.walls.mode,
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
  };
};

