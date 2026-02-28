import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  type FloorTheme
} from '@hop/engine';
import { BiomeSandboxControlsPanel } from './biome-sandbox/BiomeSandboxControlsPanel';
import { buildBiomeSandboxPreviewManifest } from './biome-sandbox/preview-manifest';
import { BiomeSandboxPreviewPane } from './biome-sandbox/BiomeSandboxPreviewPane';
import { buildBiomeSandboxExportPayload } from './biome-sandbox/export-payload';
import { useBiomeSandboxPathSets } from './biome-sandbox/use-biome-sandbox-path-sets';
import { buildPreviewState } from './biome-sandbox/state/preview-state';
import {
  SETTINGS_STORAGE_KEY,
  hydrateStoredSettings,
  parseStoredSettings
} from './biome-sandbox/state/settings-storage';
import {
  DETAIL_SCALE_MAX,
  DETAIL_SCALE_MIN,
  UNDERCURRENT_SCALE_MAX,
  UNDERCURRENT_SCALE_MIN,
  clamp,
  normalizeHexColor,
  readBlendMode,
  readMountainBlendMode
} from './biome-sandbox/state/settings-utils';
import type {
  BiomeSandboxSettings,
  LayerMode,
  MountainBlendMode
} from './biome-sandbox/types';
import type {
  VisualAssetManifest,
  VisualBiomeThemePreset,
  VisualBiomeTextureLayer,
  VisualBiomeTintProfile,
  VisualBiomeWallsProfile,
  VisualBiomeWallsThemeOverride,
  VisualMountainRenderSettings
} from '../visual/asset-manifest';
import { getBiomeThemePreset } from '../visual/asset-manifest';

interface BiomeSandboxProps {
  assetManifest: VisualAssetManifest | null;
  onBack: () => void;
}

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

export const BiomeSandbox: React.FC<BiomeSandboxProps> = ({ assetManifest, onBack }) => {
  const initializedRef = useRef(false);
  const [copyStatus, setCopyStatus] = useState<string>('');
  const [settings, setSettings] = useState<BiomeSandboxSettings | null>(null);

  useEffect(() => {
    if (!assetManifest || initializedRef.current) return;
    const defaults = defaultsFromManifest(assetManifest, 'inferno');
    const stored = parseStoredSettings(localStorage.getItem(SETTINGS_STORAGE_KEY));
    setSettings(hydrateStoredSettings(defaults, stored));
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

