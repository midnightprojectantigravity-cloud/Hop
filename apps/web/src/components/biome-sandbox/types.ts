import type { FloorTheme } from '@hop/engine';
import type { VisualBlendMode } from '../../visual/asset-manifest';

export type LayerMode = 'off' | 'cover' | 'repeat';
export type BlendMode = VisualBlendMode;
export type MountainBlendMode = 'off' | BlendMode;
export type WallMode = 'native' | 'additive' | 'custom';

export type UndercurrentSettings = {
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

export type CrustSettings = {
  path: string;
  mode: LayerMode;
  scalePx: number;
  opacity: number;
  seedShiftPx: number;
  offsetX: number;
  offsetY: number;
};

export type ClutterSettings = {
  density: number;
  maxPerHex: number;
  bleedScaleMax: number;
};

export type WallSettings = {
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

export type MaterialDetailSettings = {
  path: string;
  mode: LayerMode;
  scalePx: number;
  opacity: number;
};

export type CrustMaterialSettings = {
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

