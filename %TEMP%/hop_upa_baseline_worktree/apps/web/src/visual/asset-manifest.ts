export type VisualAssetType = 'tile' | 'decal' | 'prop' | 'unit' | 'fx' | 'ui';
export type VisualAssetLayer = 'ground' | 'decal' | 'prop' | 'unit' | 'fx' | 'ui';
export type VisualAssetFormat = 'svg' | 'webp' | 'avif' | 'png' | 'jpg' | 'jpeg';

export interface VisualAssetAnchor {
  x: number;
  y: number;
}

export interface VisualAssetEntry {
  id: string;
  type: VisualAssetType;
  layer: VisualAssetLayer;
  recommendedFormat: VisualAssetFormat;
  path: string;
  width: number;
  height: number;
  theme?: string;
  anchor?: VisualAssetAnchor;
  tags?: string[];
  variants?: string[];
  mountainSettings?: VisualMountainRenderSettings;
  mountainSettingsByTheme?: Record<string, VisualMountainRenderSettings>;
}

export interface VisualBiomeUnderlay {
  default: string;
  themes?: Record<string, string>;
  mode?: 'off' | 'cover' | 'repeat';
  scalePx?: number;
  opacity?: number;
}

export interface VisualBiomeLayerScroll {
  x?: number;
  y?: number;
  durationMs?: number;
}

export interface VisualBiomeTextureLayer {
  default: string;
  themes?: Record<string, string>;
  mode?: 'off' | 'cover' | 'repeat';
  scalePx?: number;
  opacity?: number;
  seedShiftPx?: number;
  offsetX?: number;
  offsetY?: number;
  scroll?: VisualBiomeLayerScroll;
}

export type VisualBlendMode = 'normal' | 'multiply' | 'overlay' | 'soft-light' | 'screen' | 'color-dodge';
export type VisualMountainBlendMode = 'off' | VisualBlendMode;

export interface VisualMountainRenderSettings {
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  anchorX?: number;
  anchorY?: number;
  crustBlendMode?: VisualMountainBlendMode;
  crustBlendOpacity?: number;
  tintColor?: string;
  tintBlendMode?: VisualMountainBlendMode;
  tintOpacity?: number;
}

export interface VisualBiomeWallsThemeOverride extends VisualMountainRenderSettings {
  mountainPath?: string;
  mountainScale?: number;
  mountainOffsetX?: number;
  mountainOffsetY?: number;
  mountainAnchorX?: number;
  mountainAnchorY?: number;
  mountainCrustBlendMode?: VisualMountainBlendMode;
  mountainCrustBlendOpacity?: number;
  mountainTintColor?: string;
  mountainTintBlendMode?: VisualMountainBlendMode;
  mountainTintOpacity?: number;
}

export interface VisualBiomeWallsProfile extends VisualBiomeWallsThemeOverride {
  mode?: 'native' | 'additive' | 'custom';
  interiorDensity?: number;
  clusterBias?: number;
  keepPerimeter?: boolean;
  themes?: Record<string, VisualBiomeWallsThemeOverride>;
}

export interface VisualBiomeTintProfile {
  default: string;
  themes?: Record<string, string>;
  opacity?: number;
  blendMode?: VisualBlendMode;
}

export interface VisualBiomeMaterialProfile {
  detailA?: VisualBiomeTextureLayer;
  detailB?: VisualBiomeTextureLayer;
  tint?: VisualBiomeTintProfile;
}

export interface VisualBiomeMaterials {
  undercurrent?: VisualBiomeMaterialProfile;
  crust?: VisualBiomeMaterialProfile;
}

export interface VisualBiomeClutterLayer {
  density?: number;
  maxPerHex?: number;
  bleedScaleMax?: number;
  tags?: string[];
}

export interface VisualBiomeLayers {
  undercurrent?: VisualBiomeTextureLayer;
  crust?: VisualBiomeTextureLayer;
  clutter?: VisualBiomeClutterLayer;
}

export interface VisualThemeAssetOverride {
  mountainSettings?: VisualMountainRenderSettings;
}

export interface VisualBiomeThemePreset {
  seed?: string;
  injectHazards?: boolean;
  biomeLayers?: VisualBiomeLayers;
  biomeMaterials?: VisualBiomeMaterials;
  walls?: VisualBiomeWallsProfile;
  assetOverrides?: Record<string, VisualThemeAssetOverride>;
}

export interface VisualAssetManifest {
  version: string;
  gridTopology: 'flat-top-hex';
  tileUnitPx: number;
  tileAspectRatio: number;
  biomeUnderlay?: VisualBiomeUnderlay;
  biomeLayers?: VisualBiomeLayers;
  biomeMaterials?: VisualBiomeMaterials;
  walls?: VisualBiomeWallsProfile;
  biomePresets?: Record<string, VisualBiomeThemePreset>;
  layers: VisualAssetLayer[];
  assets: VisualAssetEntry[];
}

const BASE_URL = import.meta.env.BASE_URL || '/';
const ASSET_ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const ASSET_PATH_RE = /^\/assets\/[a-z0-9/_\-.]+$/;
const REQUIRED_LAYERS: VisualAssetLayer[] = ['ground', 'decal', 'prop', 'unit', 'fx', 'ui'];
const SUPPORTED_FORMATS: VisualAssetFormat[] = ['svg', 'webp', 'avif', 'png', 'jpg', 'jpeg'];
const UNIT_FORMATS: VisualAssetFormat[] = ['svg', 'webp', 'avif', 'png'];
const ENV_FORMATS: VisualAssetFormat[] = ['svg', 'webp', 'avif', 'png', 'jpg', 'jpeg'];
const FX_FORMATS: VisualAssetFormat[] = ['svg', 'webp', 'avif', 'png'];
const UI_FORMATS: VisualAssetFormat[] = ['svg'];

const joinBase = (base: string, path: string): string => {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${path.replace(/^\/+/, '')}`;
};

const MANIFEST_URL = joinBase(BASE_URL, 'assets/manifest.json');

const toRuntimeAssetPath = (assetPath: string): string => {
  if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('data:')) {
    return assetPath;
  }
  if (!assetPath.startsWith('/')) {
    return joinBase(BASE_URL, assetPath);
  }
  if (assetPath.startsWith('/assets/')) {
    return joinBase(BASE_URL, assetPath.slice(1));
  }
  return assetPath;
};

const normalizeTextureLayer = (layer?: VisualBiomeTextureLayer): VisualBiomeTextureLayer | undefined => {
  if (!layer) return undefined;
  return {
    ...layer,
    default: toRuntimeAssetPath(layer.default),
    themes: Object.fromEntries(
      Object.entries(layer.themes || {}).map(([k, v]) => [k, toRuntimeAssetPath(v)])
    )
  };
};

const normalizeWallsThemeOverride = (
  override?: VisualBiomeWallsThemeOverride
): VisualBiomeWallsThemeOverride | undefined => {
  if (!override) return undefined;
  return {
    ...override,
    scale: override.scale ?? override.mountainScale,
    offsetX: override.offsetX ?? override.mountainOffsetX,
    offsetY: override.offsetY ?? override.mountainOffsetY,
    anchorX: override.anchorX ?? override.mountainAnchorX,
    anchorY: override.anchorY ?? override.mountainAnchorY,
    crustBlendMode: override.crustBlendMode ?? override.mountainCrustBlendMode,
    crustBlendOpacity: override.crustBlendOpacity ?? override.mountainCrustBlendOpacity,
    tintColor: override.tintColor ?? override.mountainTintColor,
    tintBlendMode: override.tintBlendMode ?? override.mountainTintBlendMode,
    tintOpacity: override.tintOpacity ?? override.mountainTintOpacity
  };
};

const normalizeTintProfile = (tint?: VisualBiomeTintProfile): VisualBiomeTintProfile | undefined => {
  if (!tint) return undefined;
  return {
    ...tint,
    themes: Object.fromEntries(
      Object.entries(tint.themes || {}).map(([k, v]) => [k, String(v)])
    )
  };
};

const normalizeMaterialProfile = (profile?: VisualBiomeMaterialProfile): VisualBiomeMaterialProfile | undefined => {
  if (!profile) return undefined;
  return {
    detailA: normalizeTextureLayer(profile.detailA),
    detailB: normalizeTextureLayer(profile.detailB),
    tint: normalizeTintProfile(profile.tint)
  };
};

const normalizeMountainRenderSettings = (
  settings?: VisualMountainRenderSettings
): VisualMountainRenderSettings | undefined => {
  if (!settings) return undefined;
  return { ...settings };
};

const normalizeWallsProfile = (walls?: VisualBiomeWallsProfile): VisualBiomeWallsProfile | undefined => {
  if (!walls) return undefined;
  const normalized = normalizeWallsThemeOverride(walls);
  return {
    ...normalized,
    mountainPath: normalized?.mountainPath ? toRuntimeAssetPath(normalized.mountainPath) : normalized?.mountainPath,
    themes: Object.fromEntries(
      Object.entries(walls.themes || {}).map(([theme, override]) => [
        theme,
        {
          ...normalizeWallsThemeOverride(override),
          mountainPath: override?.mountainPath ? toRuntimeAssetPath(override.mountainPath) : override?.mountainPath
        }
      ])
    )
  };
};

const normalizeBiomeThemePreset = (
  preset?: VisualBiomeThemePreset
): VisualBiomeThemePreset | undefined => {
  if (!preset) return undefined;
  return {
    ...preset,
    biomeLayers: preset.biomeLayers
      ? {
          undercurrent: normalizeTextureLayer(preset.biomeLayers.undercurrent),
          crust: normalizeTextureLayer(preset.biomeLayers.crust),
          clutter: preset.biomeLayers.clutter
            ? {
                ...preset.biomeLayers.clutter,
                tags: [...(preset.biomeLayers.clutter.tags || [])]
              }
            : undefined
        }
      : undefined,
    biomeMaterials: preset.biomeMaterials
      ? {
          undercurrent: normalizeMaterialProfile(preset.biomeMaterials.undercurrent),
          crust: normalizeMaterialProfile(preset.biomeMaterials.crust)
        }
      : undefined,
    walls: normalizeWallsProfile(preset.walls),
    assetOverrides: Object.fromEntries(
      Object.entries(preset.assetOverrides || {}).map(([assetId, override]) => [
        assetId,
        {
          ...override,
          mountainSettings: normalizeMountainRenderSettings(override?.mountainSettings)
        }
      ])
    )
  };
};

const normalizeManifestForRuntime = (manifest: VisualAssetManifest): VisualAssetManifest => ({
  ...manifest,
  biomeUnderlay: manifest.biomeUnderlay
    ? {
        ...manifest.biomeUnderlay,
        default: toRuntimeAssetPath(manifest.biomeUnderlay.default),
        themes: Object.fromEntries(
          Object.entries(manifest.biomeUnderlay.themes || {}).map(([k, v]) => [k, toRuntimeAssetPath(v)])
        )
      }
    : undefined,
  biomeLayers: manifest.biomeLayers
    ? {
        undercurrent: normalizeTextureLayer(manifest.biomeLayers.undercurrent),
        crust: normalizeTextureLayer(manifest.biomeLayers.crust),
        clutter: manifest.biomeLayers.clutter
          ? {
              ...manifest.biomeLayers.clutter,
              tags: [...(manifest.biomeLayers.clutter.tags || [])]
            }
          : undefined
      }
    : undefined,
  biomeMaterials: manifest.biomeMaterials
    ? {
        undercurrent: normalizeMaterialProfile(manifest.biomeMaterials.undercurrent),
        crust: normalizeMaterialProfile(manifest.biomeMaterials.crust)
      }
    : undefined,
  walls: normalizeWallsProfile(manifest.walls),
  biomePresets: Object.fromEntries(
    Object.entries(manifest.biomePresets || {}).map(([theme, preset]) => [
      theme,
      normalizeBiomeThemePreset(preset) || {}
    ])
  ),
  assets: manifest.assets.map(asset => ({
    ...asset,
    path: toRuntimeAssetPath(asset.path),
    mountainSettings: normalizeMountainRenderSettings(asset.mountainSettings),
    mountainSettingsByTheme: Object.fromEntries(
      Object.entries(asset.mountainSettingsByTheme || {}).map(([theme, settings]) => [
        theme,
        normalizeMountainRenderSettings(settings) || {}
      ])
    )
  }))
});

const EMPTY_MANIFEST: VisualAssetManifest = {
  version: '1.0.0',
  gridTopology: 'flat-top-hex',
  tileUnitPx: 256,
  tileAspectRatio: 1.154700538,
  layers: [...REQUIRED_LAYERS],
  assets: []
};

let manifestPromise: Promise<VisualAssetManifest> | null = null;

const isLayer = (value: unknown): value is VisualAssetLayer =>
  typeof value === 'string' && REQUIRED_LAYERS.includes(value as VisualAssetLayer);

const isAssetType = (value: unknown): value is VisualAssetType =>
  typeof value === 'string' && ['tile', 'decal', 'prop', 'unit', 'fx', 'ui'].includes(value);

const isAssetFormat = (value: unknown): value is VisualAssetFormat =>
  typeof value === 'string' && SUPPORTED_FORMATS.includes(value as VisualAssetFormat);

const validateTextureLayer = (
  layer: Partial<VisualBiomeTextureLayer> | null,
  label: string,
  errors: string[]
) => {
  if (!layer || typeof layer !== 'object') {
    errors.push(`"${label}" must be an object when provided.`);
    return;
  }
  if (typeof layer.default !== 'string' || !ASSET_PATH_RE.test(layer.default)) {
    errors.push(`"${label}.default" must be a /assets/... path.`);
  }
  if (layer.themes !== undefined) {
    if (!layer.themes || typeof layer.themes !== 'object') {
      errors.push(`"${label}.themes" must be an object when provided.`);
    } else {
      for (const [theme, path] of Object.entries(layer.themes)) {
        if (typeof theme !== 'string' || theme.trim().length === 0) {
          errors.push(`"${label}.themes" contains an invalid theme key.`);
        }
        if (typeof path !== 'string' || !ASSET_PATH_RE.test(path)) {
          errors.push(`"${label}.themes.${theme}" must be a /assets/... path.`);
        }
      }
    }
  }
  if (layer.mode !== undefined && layer.mode !== 'off' && layer.mode !== 'cover' && layer.mode !== 'repeat') {
    errors.push(`"${label}.mode" must be one of "off", "cover", or "repeat".`);
  }
  if (layer.scalePx !== undefined && (!Number.isFinite(layer.scalePx) || Number(layer.scalePx) <= 0)) {
    errors.push(`"${label}.scalePx" must be > 0 when provided.`);
  }
  if (layer.opacity !== undefined && (!Number.isFinite(layer.opacity) || Number(layer.opacity) < 0 || Number(layer.opacity) > 1)) {
    errors.push(`"${label}.opacity" must be in [0, 1] when provided.`);
  }
  if (layer.seedShiftPx !== undefined && (!Number.isFinite(layer.seedShiftPx) || Number(layer.seedShiftPx) < 0)) {
    errors.push(`"${label}.seedShiftPx" must be >= 0 when provided.`);
  }
  if (layer.offsetX !== undefined && !Number.isFinite(layer.offsetX)) {
    errors.push(`"${label}.offsetX" must be a finite number when provided.`);
  }
  if (layer.offsetY !== undefined && !Number.isFinite(layer.offsetY)) {
    errors.push(`"${label}.offsetY" must be a finite number when provided.`);
  }
  if (layer.scroll !== undefined) {
    const scroll = layer.scroll as Partial<VisualBiomeLayerScroll> | null;
    if (!scroll || typeof scroll !== 'object') {
      errors.push(`"${label}.scroll" must be an object when provided.`);
    } else {
      if (scroll.x !== undefined && !Number.isFinite(scroll.x)) {
        errors.push(`"${label}.scroll.x" must be a finite number.`);
      }
      if (scroll.y !== undefined && !Number.isFinite(scroll.y)) {
        errors.push(`"${label}.scroll.y" must be a finite number.`);
      }
      if (scroll.durationMs !== undefined && (!Number.isFinite(scroll.durationMs) || Number(scroll.durationMs) <= 0)) {
        errors.push(`"${label}.scroll.durationMs" must be > 0 when provided.`);
      }
    }
  }
};

const validateTintProfile = (
  tint: Partial<VisualBiomeTintProfile> | null,
  label: string,
  errors: string[]
) => {
  if (!tint || typeof tint !== 'object') {
    errors.push(`"${label}" must be an object when provided.`);
    return;
  }
  if (typeof tint.default !== 'string' || tint.default.trim().length === 0) {
    errors.push(`"${label}.default" must be a non-empty color string.`);
  }
  if (tint.themes !== undefined) {
    if (!tint.themes || typeof tint.themes !== 'object') {
      errors.push(`"${label}.themes" must be an object when provided.`);
    } else {
      for (const [theme, color] of Object.entries(tint.themes)) {
        if (typeof theme !== 'string' || theme.trim().length === 0) {
          errors.push(`"${label}.themes" contains an invalid theme key.`);
        }
        if (typeof color !== 'string' || color.trim().length === 0) {
          errors.push(`"${label}.themes.${theme}" must be a non-empty color string.`);
        }
      }
    }
  }
  if (tint.opacity !== undefined && (!Number.isFinite(tint.opacity) || Number(tint.opacity) < 0 || Number(tint.opacity) > 1)) {
    errors.push(`"${label}.opacity" must be in [0, 1] when provided.`);
  }
  if (
    tint.blendMode !== undefined
    && tint.blendMode !== 'normal'
    && tint.blendMode !== 'multiply'
    && tint.blendMode !== 'overlay'
    && tint.blendMode !== 'soft-light'
    && tint.blendMode !== 'screen'
    && tint.blendMode !== 'color-dodge'
  ) {
    errors.push(`"${label}.blendMode" must be one of "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
  }
};

const validateMountainRenderSettings = (
  settings: Partial<VisualMountainRenderSettings> | null,
  label: string,
  errors: string[]
) => {
  if (!settings || typeof settings !== 'object') {
    errors.push(`"${label}" must be an object when provided.`);
    return;
  }
  if (settings.scale !== undefined && (!Number.isFinite(settings.scale) || Number(settings.scale) <= 0)) {
    errors.push(`"${label}.scale" must be > 0 when provided.`);
  }
  if (settings.offsetX !== undefined && !Number.isFinite(settings.offsetX)) {
    errors.push(`"${label}.offsetX" must be a finite number when provided.`);
  }
  if (settings.offsetY !== undefined && !Number.isFinite(settings.offsetY)) {
    errors.push(`"${label}.offsetY" must be a finite number when provided.`);
  }
  if (settings.anchorX !== undefined && (!Number.isFinite(settings.anchorX) || Number(settings.anchorX) < 0 || Number(settings.anchorX) > 1)) {
    errors.push(`"${label}.anchorX" must be in [0, 1] when provided.`);
  }
  if (settings.anchorY !== undefined && (!Number.isFinite(settings.anchorY) || Number(settings.anchorY) < 0 || Number(settings.anchorY) > 1)) {
    errors.push(`"${label}.anchorY" must be in [0, 1] when provided.`);
  }
  if (
    settings.crustBlendMode !== undefined
    && settings.crustBlendMode !== 'off'
    && settings.crustBlendMode !== 'normal'
    && settings.crustBlendMode !== 'multiply'
    && settings.crustBlendMode !== 'overlay'
    && settings.crustBlendMode !== 'soft-light'
    && settings.crustBlendMode !== 'screen'
    && settings.crustBlendMode !== 'color-dodge'
  ) {
    errors.push(`"${label}.crustBlendMode" must be one of "off", "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
  }
  if (
    settings.tintBlendMode !== undefined
    && settings.tintBlendMode !== 'off'
    && settings.tintBlendMode !== 'normal'
    && settings.tintBlendMode !== 'multiply'
    && settings.tintBlendMode !== 'overlay'
    && settings.tintBlendMode !== 'soft-light'
    && settings.tintBlendMode !== 'screen'
    && settings.tintBlendMode !== 'color-dodge'
  ) {
    errors.push(`"${label}.tintBlendMode" must be one of "off", "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
  }
  if (
    settings.crustBlendOpacity !== undefined
    && (!Number.isFinite(settings.crustBlendOpacity) || Number(settings.crustBlendOpacity) < 0 || Number(settings.crustBlendOpacity) > 1)
  ) {
    errors.push(`"${label}.crustBlendOpacity" must be in [0, 1] when provided.`);
  }
  if (
    settings.tintOpacity !== undefined
    && (!Number.isFinite(settings.tintOpacity) || Number(settings.tintOpacity) < 0 || Number(settings.tintOpacity) > 1)
  ) {
    errors.push(`"${label}.tintOpacity" must be in [0, 1] when provided.`);
  }
  if (settings.tintColor !== undefined && (typeof settings.tintColor !== 'string' || settings.tintColor.trim().length === 0)) {
    errors.push(`"${label}.tintColor" must be a non-empty color string when provided.`);
  }
};

const validateWallsProfile = (
  walls: Partial<VisualBiomeWallsProfile> | null,
  label: string,
  errors: string[]
) => {
  if (!walls || typeof walls !== 'object') {
    errors.push(`"${label}" must be an object when provided.`);
    return;
  }
  if (walls.mode !== undefined && walls.mode !== 'native' && walls.mode !== 'additive' && walls.mode !== 'custom') {
    errors.push(`"${label}.mode" must be one of "native", "additive", or "custom".`);
  }
  if (walls.interiorDensity !== undefined && (!Number.isFinite(walls.interiorDensity) || Number(walls.interiorDensity) < 0 || Number(walls.interiorDensity) > 1)) {
    errors.push(`"${label}.interiorDensity" must be in [0, 1] when provided.`);
  }
  if (walls.clusterBias !== undefined && (!Number.isFinite(walls.clusterBias) || Number(walls.clusterBias) < 0 || Number(walls.clusterBias) > 1)) {
    errors.push(`"${label}.clusterBias" must be in [0, 1] when provided.`);
  }
  if (walls.keepPerimeter !== undefined && typeof walls.keepPerimeter !== 'boolean') {
    errors.push(`"${label}.keepPerimeter" must be a boolean when provided.`);
  }
  if (walls.mountainPath !== undefined && (typeof walls.mountainPath !== 'string' || !ASSET_PATH_RE.test(walls.mountainPath))) {
    errors.push(`"${label}.mountainPath" must be a /assets/... path when provided.`);
  }
  if (walls.mountainScale !== undefined && (!Number.isFinite(walls.mountainScale) || Number(walls.mountainScale) <= 0)) {
    errors.push(`"${label}.mountainScale" must be > 0 when provided.`);
  }
  if (walls.mountainOffsetX !== undefined && !Number.isFinite(walls.mountainOffsetX)) {
    errors.push(`"${label}.mountainOffsetX" must be a finite number when provided.`);
  }
  if (walls.mountainOffsetY !== undefined && !Number.isFinite(walls.mountainOffsetY)) {
    errors.push(`"${label}.mountainOffsetY" must be a finite number when provided.`);
  }
  if (
    walls.mountainAnchorX !== undefined
    && (!Number.isFinite(walls.mountainAnchorX) || Number(walls.mountainAnchorX) < 0 || Number(walls.mountainAnchorX) > 1)
  ) {
    errors.push(`"${label}.mountainAnchorX" must be in [0, 1] when provided.`);
  }
  if (
    walls.mountainAnchorY !== undefined
    && (!Number.isFinite(walls.mountainAnchorY) || Number(walls.mountainAnchorY) < 0 || Number(walls.mountainAnchorY) > 1)
  ) {
    errors.push(`"${label}.mountainAnchorY" must be in [0, 1] when provided.`);
  }
  if (
    walls.mountainCrustBlendMode !== undefined
    && walls.mountainCrustBlendMode !== 'off'
    && walls.mountainCrustBlendMode !== 'normal'
    && walls.mountainCrustBlendMode !== 'multiply'
    && walls.mountainCrustBlendMode !== 'overlay'
    && walls.mountainCrustBlendMode !== 'soft-light'
    && walls.mountainCrustBlendMode !== 'screen'
    && walls.mountainCrustBlendMode !== 'color-dodge'
  ) {
    errors.push(`"${label}.mountainCrustBlendMode" must be one of "off", "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
  }
  if (
    walls.mountainCrustBlendOpacity !== undefined
    && (!Number.isFinite(walls.mountainCrustBlendOpacity) || Number(walls.mountainCrustBlendOpacity) < 0 || Number(walls.mountainCrustBlendOpacity) > 1)
  ) {
    errors.push(`"${label}.mountainCrustBlendOpacity" must be in [0, 1] when provided.`);
  }
  if (walls.mountainTintColor !== undefined && (typeof walls.mountainTintColor !== 'string' || walls.mountainTintColor.trim().length === 0)) {
    errors.push(`"${label}.mountainTintColor" must be a non-empty color string when provided.`);
  }
  if (
    walls.mountainTintBlendMode !== undefined
    && walls.mountainTintBlendMode !== 'off'
    && walls.mountainTintBlendMode !== 'normal'
    && walls.mountainTintBlendMode !== 'multiply'
    && walls.mountainTintBlendMode !== 'overlay'
    && walls.mountainTintBlendMode !== 'soft-light'
    && walls.mountainTintBlendMode !== 'screen'
    && walls.mountainTintBlendMode !== 'color-dodge'
  ) {
    errors.push(`"${label}.mountainTintBlendMode" must be one of "off", "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
  }
  if (
    walls.mountainTintOpacity !== undefined
    && (!Number.isFinite(walls.mountainTintOpacity) || Number(walls.mountainTintOpacity) < 0 || Number(walls.mountainTintOpacity) > 1)
  ) {
    errors.push(`"${label}.mountainTintOpacity" must be in [0, 1] when provided.`);
  }
  validateMountainRenderSettings(walls as Partial<VisualMountainRenderSettings>, label, errors);
  if (walls.themes !== undefined) {
    if (!walls.themes || typeof walls.themes !== 'object') {
      errors.push(`"${label}.themes" must be an object when provided.`);
    } else {
      for (const [theme, override] of Object.entries(walls.themes)) {
        if (typeof theme !== 'string' || theme.trim().length === 0) {
          errors.push(`"${label}.themes" contains an invalid theme key.`);
          continue;
        }
        if (!override || typeof override !== 'object') {
          errors.push(`"${label}.themes.${theme}" must be an object.`);
          continue;
        }
        if (
          (override as Partial<VisualBiomeWallsThemeOverride>).mountainPath !== undefined
          && (typeof (override as Partial<VisualBiomeWallsThemeOverride>).mountainPath !== 'string'
            || !ASSET_PATH_RE.test((override as Partial<VisualBiomeWallsThemeOverride>).mountainPath as string))
        ) {
          errors.push(`"${label}.themes.${theme}.mountainPath" must be a /assets/... path when provided.`);
        }
        const aliasOverride = override as Partial<VisualBiomeWallsThemeOverride>;
        if (aliasOverride.mountainScale !== undefined && (!Number.isFinite(aliasOverride.mountainScale) || Number(aliasOverride.mountainScale) <= 0)) {
          errors.push(`"${label}.themes.${theme}.mountainScale" must be > 0 when provided.`);
        }
        if (aliasOverride.mountainOffsetX !== undefined && !Number.isFinite(aliasOverride.mountainOffsetX)) {
          errors.push(`"${label}.themes.${theme}.mountainOffsetX" must be a finite number when provided.`);
        }
        if (aliasOverride.mountainOffsetY !== undefined && !Number.isFinite(aliasOverride.mountainOffsetY)) {
          errors.push(`"${label}.themes.${theme}.mountainOffsetY" must be a finite number when provided.`);
        }
        if (
          aliasOverride.mountainAnchorX !== undefined
          && (!Number.isFinite(aliasOverride.mountainAnchorX) || Number(aliasOverride.mountainAnchorX) < 0 || Number(aliasOverride.mountainAnchorX) > 1)
        ) {
          errors.push(`"${label}.themes.${theme}.mountainAnchorX" must be in [0, 1] when provided.`);
        }
        if (
          aliasOverride.mountainAnchorY !== undefined
          && (!Number.isFinite(aliasOverride.mountainAnchorY) || Number(aliasOverride.mountainAnchorY) < 0 || Number(aliasOverride.mountainAnchorY) > 1)
        ) {
          errors.push(`"${label}.themes.${theme}.mountainAnchorY" must be in [0, 1] when provided.`);
        }
        if (
          aliasOverride.mountainCrustBlendMode !== undefined
          && aliasOverride.mountainCrustBlendMode !== 'off'
          && aliasOverride.mountainCrustBlendMode !== 'normal'
          && aliasOverride.mountainCrustBlendMode !== 'multiply'
          && aliasOverride.mountainCrustBlendMode !== 'overlay'
          && aliasOverride.mountainCrustBlendMode !== 'soft-light'
          && aliasOverride.mountainCrustBlendMode !== 'screen'
          && aliasOverride.mountainCrustBlendMode !== 'color-dodge'
        ) {
          errors.push(`"${label}.themes.${theme}.mountainCrustBlendMode" must be one of "off", "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
        }
        if (
          aliasOverride.mountainCrustBlendOpacity !== undefined
          && (!Number.isFinite(aliasOverride.mountainCrustBlendOpacity)
            || Number(aliasOverride.mountainCrustBlendOpacity) < 0
            || Number(aliasOverride.mountainCrustBlendOpacity) > 1)
        ) {
          errors.push(`"${label}.themes.${theme}.mountainCrustBlendOpacity" must be in [0, 1] when provided.`);
        }
        if (
          aliasOverride.mountainTintBlendMode !== undefined
          && aliasOverride.mountainTintBlendMode !== 'off'
          && aliasOverride.mountainTintBlendMode !== 'normal'
          && aliasOverride.mountainTintBlendMode !== 'multiply'
          && aliasOverride.mountainTintBlendMode !== 'overlay'
          && aliasOverride.mountainTintBlendMode !== 'soft-light'
          && aliasOverride.mountainTintBlendMode !== 'screen'
          && aliasOverride.mountainTintBlendMode !== 'color-dodge'
        ) {
          errors.push(`"${label}.themes.${theme}.mountainTintBlendMode" must be one of "off", "normal", "multiply", "overlay", "soft-light", "screen", "color-dodge".`);
        }
        if (
          aliasOverride.mountainTintOpacity !== undefined
          && (!Number.isFinite(aliasOverride.mountainTintOpacity)
            || Number(aliasOverride.mountainTintOpacity) < 0
            || Number(aliasOverride.mountainTintOpacity) > 1)
        ) {
          errors.push(`"${label}.themes.${theme}.mountainTintOpacity" must be in [0, 1] when provided.`);
        }
        if (aliasOverride.mountainTintColor !== undefined && (typeof aliasOverride.mountainTintColor !== 'string' || aliasOverride.mountainTintColor.trim().length === 0)) {
          errors.push(`"${label}.themes.${theme}.mountainTintColor" must be a non-empty color string when provided.`);
        }
        validateMountainRenderSettings(
          override as Partial<VisualMountainRenderSettings>,
          `${label}.themes.${theme}`,
          errors
        );
      }
    }
  }
};

const validateMaterialProfile = (
  profile: Partial<VisualBiomeMaterialProfile> | null,
  label: string,
  errors: string[]
) => {
  if (!profile || typeof profile !== 'object') {
    errors.push(`"${label}" must be an object when provided.`);
    return;
  }
  if (profile.detailA !== undefined) {
    validateTextureLayer(profile.detailA as Partial<VisualBiomeTextureLayer> | null, `${label}.detailA`, errors);
  }
  if (profile.detailB !== undefined) {
    validateTextureLayer(profile.detailB as Partial<VisualBiomeTextureLayer> | null, `${label}.detailB`, errors);
  }
  if (profile.tint !== undefined) {
    validateTintProfile(profile.tint as Partial<VisualBiomeTintProfile> | null, `${label}.tint`, errors);
  }
  if (profile.detailA === undefined && profile.detailB === undefined && profile.tint === undefined) {
    errors.push(`"${label}" must define at least one of "detailA", "detailB", or "tint".`);
  }
};

const validateBiomeThemePreset = (
  preset: Partial<VisualBiomeThemePreset> | null,
  label: string,
  errors: string[]
) => {
  if (!preset || typeof preset !== 'object') {
    errors.push(`"${label}" must be an object when provided.`);
    return;
  }
  if (preset.seed !== undefined && (typeof preset.seed !== 'string' || preset.seed.trim().length === 0)) {
    errors.push(`"${label}.seed" must be a non-empty string when provided.`);
  }
  if (preset.injectHazards !== undefined && typeof preset.injectHazards !== 'boolean') {
    errors.push(`"${label}.injectHazards" must be a boolean when provided.`);
  }
  if (preset.biomeLayers !== undefined) {
    const layers = preset.biomeLayers as Partial<VisualBiomeLayers> | null;
    if (!layers || typeof layers !== 'object') {
      errors.push(`"${label}.biomeLayers" must be an object when provided.`);
    } else {
      if (layers.undercurrent !== undefined) {
        validateTextureLayer(layers.undercurrent as Partial<VisualBiomeTextureLayer> | null, `${label}.biomeLayers.undercurrent`, errors);
      }
      if (layers.crust !== undefined) {
        validateTextureLayer(layers.crust as Partial<VisualBiomeTextureLayer> | null, `${label}.biomeLayers.crust`, errors);
      }
      if (layers.clutter !== undefined) {
        const clutter = layers.clutter as Partial<VisualBiomeClutterLayer> | null;
        if (!clutter || typeof clutter !== 'object') {
          errors.push(`"${label}.biomeLayers.clutter" must be an object when provided.`);
        } else {
          if (clutter.density !== undefined && (!Number.isFinite(clutter.density) || Number(clutter.density) < 0 || Number(clutter.density) > 1)) {
            errors.push(`"${label}.biomeLayers.clutter.density" must be in [0, 1] when provided.`);
          }
          if (clutter.maxPerHex !== undefined && (!Number.isFinite(clutter.maxPerHex) || Number(clutter.maxPerHex) < 0)) {
            errors.push(`"${label}.biomeLayers.clutter.maxPerHex" must be >= 0 when provided.`);
          }
          if (clutter.bleedScaleMax !== undefined && (!Number.isFinite(clutter.bleedScaleMax) || Number(clutter.bleedScaleMax) < 1 || Number(clutter.bleedScaleMax) > 2)) {
            errors.push(`"${label}.biomeLayers.clutter.bleedScaleMax" must be within [1, 2] when provided.`);
          }
          if (clutter.tags !== undefined && (!Array.isArray(clutter.tags) || !clutter.tags.every(tag => typeof tag === 'string' && tag.length > 0))) {
            errors.push(`"${label}.biomeLayers.clutter.tags" must be a string array when provided.`);
          }
        }
      }
    }
  }
  if (preset.biomeMaterials !== undefined) {
    const materials = preset.biomeMaterials as Partial<VisualBiomeMaterials> | null;
    if (!materials || typeof materials !== 'object') {
      errors.push(`"${label}.biomeMaterials" must be an object when provided.`);
    } else {
      if (materials.undercurrent !== undefined) {
        validateMaterialProfile(
          materials.undercurrent as Partial<VisualBiomeMaterialProfile> | null,
          `${label}.biomeMaterials.undercurrent`,
          errors
        );
      }
      if (materials.crust !== undefined) {
        validateMaterialProfile(
          materials.crust as Partial<VisualBiomeMaterialProfile> | null,
          `${label}.biomeMaterials.crust`,
          errors
        );
      }
    }
  }
  if (preset.walls !== undefined) {
    validateWallsProfile(preset.walls as Partial<VisualBiomeWallsProfile> | null, `${label}.walls`, errors);
  }
  if (preset.assetOverrides !== undefined) {
    if (!preset.assetOverrides || typeof preset.assetOverrides !== 'object') {
      errors.push(`"${label}.assetOverrides" must be an object when provided.`);
    } else {
      for (const [assetId, override] of Object.entries(preset.assetOverrides)) {
        if (!ASSET_ID_RE.test(assetId)) {
          errors.push(`"${label}.assetOverrides" contains invalid asset id "${assetId}".`);
          continue;
        }
        if (!override || typeof override !== 'object') {
          errors.push(`"${label}.assetOverrides.${assetId}" must be an object.`);
          continue;
        }
        if ((override as Partial<VisualThemeAssetOverride>).mountainSettings !== undefined) {
          validateMountainRenderSettings(
            (override as Partial<VisualThemeAssetOverride>).mountainSettings as Partial<VisualMountainRenderSettings> | null,
            `${label}.assetOverrides.${assetId}.mountainSettings`,
            errors
          );
        }
      }
    }
  }
};

const validateManifest = (manifest: unknown): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest is not an object.'] };
  }

  const m = manifest as Partial<VisualAssetManifest>;

  if (typeof m.version !== 'string' || m.version.length === 0) {
    errors.push('Missing or invalid "version".');
  }
  if (m.gridTopology !== 'flat-top-hex') {
    errors.push('Only "flat-top-hex" gridTopology is supported.');
  }
  if (!Number.isFinite(m.tileUnitPx) || Number(m.tileUnitPx) <= 0) {
    errors.push('Missing or invalid "tileUnitPx".');
  }
  if (!Number.isFinite(m.tileAspectRatio) || Number(m.tileAspectRatio) <= 0) {
    errors.push('Missing or invalid "tileAspectRatio".');
  }
  if (m.biomeUnderlay !== undefined) {
    validateTextureLayer(m.biomeUnderlay as Partial<VisualBiomeTextureLayer> | null, 'biomeUnderlay', errors);
  }

  if (m.biomeLayers !== undefined) {
    const layers = m.biomeLayers as Partial<VisualBiomeLayers> | null;
    if (!layers || typeof layers !== 'object') {
      errors.push('"biomeLayers" must be an object when provided.');
    } else {
      if (layers.undercurrent !== undefined) {
        validateTextureLayer(layers.undercurrent as Partial<VisualBiomeTextureLayer> | null, 'biomeLayers.undercurrent', errors);
      }
      if (layers.crust !== undefined) {
        validateTextureLayer(layers.crust as Partial<VisualBiomeTextureLayer> | null, 'biomeLayers.crust', errors);
      }
      if (!layers.undercurrent && !layers.crust) {
        errors.push('"biomeLayers" must define at least one of "undercurrent" or "crust".');
      }
      if (layers.clutter !== undefined) {
        const clutter = layers.clutter as Partial<VisualBiomeClutterLayer> | null;
        if (!clutter || typeof clutter !== 'object') {
          errors.push('"biomeLayers.clutter" must be an object when provided.');
        } else {
          if (clutter.density !== undefined && (!Number.isFinite(clutter.density) || Number(clutter.density) < 0 || Number(clutter.density) > 1)) {
            errors.push('"biomeLayers.clutter.density" must be in [0, 1] when provided.');
          }
          if (clutter.maxPerHex !== undefined && (!Number.isFinite(clutter.maxPerHex) || Number(clutter.maxPerHex) < 0)) {
            errors.push('"biomeLayers.clutter.maxPerHex" must be >= 0 when provided.');
          }
          if (clutter.bleedScaleMax !== undefined && (!Number.isFinite(clutter.bleedScaleMax) || Number(clutter.bleedScaleMax) < 1 || Number(clutter.bleedScaleMax) > 2)) {
            errors.push('"biomeLayers.clutter.bleedScaleMax" must be within [1, 2] when provided.');
          }
          if (clutter.tags !== undefined && (!Array.isArray(clutter.tags) || !clutter.tags.every(tag => typeof tag === 'string' && tag.length > 0))) {
            errors.push('"biomeLayers.clutter.tags" must be a string array when provided.');
          }
        }
      }
    }
  }

  if (m.biomeMaterials !== undefined) {
    const materials = m.biomeMaterials as Partial<VisualBiomeMaterials> | null;
    if (!materials || typeof materials !== 'object') {
      errors.push('"biomeMaterials" must be an object when provided.');
    } else {
      if (materials.undercurrent !== undefined) {
        validateMaterialProfile(materials.undercurrent as Partial<VisualBiomeMaterialProfile> | null, 'biomeMaterials.undercurrent', errors);
      }
      if (materials.crust !== undefined) {
        validateMaterialProfile(materials.crust as Partial<VisualBiomeMaterialProfile> | null, 'biomeMaterials.crust', errors);
      }
      if (materials.undercurrent === undefined && materials.crust === undefined) {
        errors.push('"biomeMaterials" must define at least one of "undercurrent" or "crust".');
      }
    }
  }

  if (m.walls !== undefined) {
    validateWallsProfile(m.walls as Partial<VisualBiomeWallsProfile> | null, 'walls', errors);
  }
  if (m.biomePresets !== undefined) {
    if (!m.biomePresets || typeof m.biomePresets !== 'object') {
      errors.push('"biomePresets" must be an object when provided.');
    } else {
      for (const [theme, preset] of Object.entries(m.biomePresets)) {
        if (typeof theme !== 'string' || theme.trim().length === 0) {
          errors.push('"biomePresets" contains an invalid theme key.');
          continue;
        }
        validateBiomeThemePreset(
          preset as Partial<VisualBiomeThemePreset> | null,
          `biomePresets.${theme}`,
          errors
        );
      }
    }
  }

  if (!Array.isArray(m.layers) || m.layers.length === 0 || !m.layers.every(isLayer)) {
    errors.push('Missing or invalid "layers".');
  } else {
    for (const layer of REQUIRED_LAYERS) {
      if (!m.layers.includes(layer)) {
        errors.push(`Missing required layer "${layer}" in "layers".`);
      }
    }
  }

  if (!Array.isArray(m.assets)) {
    errors.push('Missing or invalid "assets".');
    return { valid: errors.length === 0, errors };
  }

  const ids = new Set<string>();
  for (const [idx, asset] of m.assets.entries()) {
    const p = `assets[${idx}]`;
    if (!asset || typeof asset !== 'object') {
      errors.push(`${p} is not an object.`);
      continue;
    }
    const a = asset as Partial<VisualAssetEntry>;
    if (typeof a.id !== 'string' || !ASSET_ID_RE.test(a.id)) {
      errors.push(`${p}.id is invalid; expected lowercase tokenized id.`);
    } else if (ids.has(a.id)) {
      errors.push(`${p}.id is duplicated (${a.id}).`);
    } else {
      ids.add(a.id);
    }
    if (!isAssetType(a.type)) {
      errors.push(`${p}.type is invalid.`);
    }
    if (!isLayer(a.layer)) {
      errors.push(`${p}.layer is invalid.`);
    }
    if (!isAssetFormat(a.recommendedFormat)) {
      errors.push(`${p}.recommendedFormat is invalid.`);
    }
    if (isAssetType(a.type) && isAssetFormat(a.recommendedFormat)) {
      if ((a.type === 'tile' || a.type === 'decal' || a.type === 'prop')
        && !ENV_FORMATS.includes(a.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be one of ${ENV_FORMATS.join(', ')} for ${a.type}.`);
      }
      if (a.type === 'ui' && !UI_FORMATS.includes(a.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be one of ${UI_FORMATS.join(', ')} for ui.`);
      }
      if (a.type === 'unit' && !UNIT_FORMATS.includes(a.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be one of ${UNIT_FORMATS.join(', ')} for units.`);
      }
      if (a.type === 'fx' && !FX_FORMATS.includes(a.recommendedFormat)) {
        errors.push(`${p}.recommendedFormat must be one of ${FX_FORMATS.join(', ')} for fx.`);
      }
    }
    if (typeof a.path !== 'string' || !ASSET_PATH_RE.test(a.path)) {
      errors.push(`${p}.path is invalid; expected /assets/...`);
    }
    if (!Number.isFinite(a.width) || Number(a.width) <= 0) {
      errors.push(`${p}.width must be > 0.`);
    }
    if (!Number.isFinite(a.height) || Number(a.height) <= 0) {
      errors.push(`${p}.height must be > 0.`);
    }
    if (a.mountainSettings !== undefined) {
      validateMountainRenderSettings(
        a.mountainSettings as Partial<VisualMountainRenderSettings> | null,
        `${p}.mountainSettings`,
        errors
      );
    }
    if (a.mountainSettingsByTheme !== undefined) {
      if (!a.mountainSettingsByTheme || typeof a.mountainSettingsByTheme !== 'object') {
        errors.push(`${p}.mountainSettingsByTheme must be an object when provided.`);
      } else {
        for (const [theme, settings] of Object.entries(a.mountainSettingsByTheme)) {
          if (typeof theme !== 'string' || theme.trim().length === 0) {
            errors.push(`${p}.mountainSettingsByTheme contains an invalid theme key.`);
            continue;
          }
          validateMountainRenderSettings(
            settings as Partial<VisualMountainRenderSettings> | null,
            `${p}.mountainSettingsByTheme.${theme}`,
            errors
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
};

export const clearAssetManifestCache = () => {
  manifestPromise = null;
};

export const loadAssetManifest = async (): Promise<VisualAssetManifest> => {
  if (manifestPromise) return manifestPromise;

  manifestPromise = fetch(MANIFEST_URL)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Asset manifest fetch failed: ${res.status}`);
      }
      return res.json();
    })
    .then((raw) => {
      const check = validateManifest(raw);
      if (!check.valid) {
        console.warn('[HOP_ASSETS] Invalid manifest; using fallback.', check.errors);
        return EMPTY_MANIFEST;
      }
      return normalizeManifestForRuntime(raw as VisualAssetManifest);
    })
    .catch((err) => {
      console.warn('[HOP_ASSETS] Failed to load manifest; using fallback.', err);
      return EMPTY_MANIFEST;
    });

  return manifestPromise;
};

export const getAssetById = (manifest: VisualAssetManifest, id: string): VisualAssetEntry | undefined =>
  manifest.assets.find(a => a.id === id);

export const getBiomeThemePreset = (
  manifest: VisualAssetManifest | null | undefined,
  theme: string
): VisualBiomeThemePreset | undefined => {
  if (!manifest) return undefined;
  const key = String(theme || '').toLowerCase();
  if (!key) return undefined;
  return manifest.biomePresets?.[key];
};

export const groupAssetsByLayer = (manifest: VisualAssetManifest): Record<VisualAssetLayer, VisualAssetEntry[]> => {
  const grouped: Record<VisualAssetLayer, VisualAssetEntry[]> = {
    ground: [],
    decal: [],
    prop: [],
    unit: [],
    fx: [],
    ui: []
  };
  for (const asset of manifest.assets) {
    grouped[asset.layer].push(asset);
  }
  return grouped;
};
