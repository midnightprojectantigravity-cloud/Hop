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
  scroll?: VisualBiomeLayerScroll;
}

export type VisualBlendMode = 'normal' | 'multiply' | 'overlay' | 'soft-light' | 'screen' | 'color-dodge';

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

export interface VisualAssetManifest {
  version: string;
  gridTopology: 'flat-top-hex';
  tileUnitPx: number;
  tileAspectRatio: number;
  biomeUnderlay?: VisualBiomeUnderlay;
  biomeLayers?: VisualBiomeLayers;
  biomeMaterials?: VisualBiomeMaterials;
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
  assets: manifest.assets.map(asset => ({
    ...asset,
    path: toRuntimeAssetPath(asset.path)
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
