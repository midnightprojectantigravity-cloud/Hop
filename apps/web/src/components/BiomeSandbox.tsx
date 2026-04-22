import React, { useCallback, useMemo } from 'react';
import type { FloorTheme } from '@hop/engine';
import { BiomeSandboxControlsPanel } from './biome-sandbox/BiomeSandboxControlsPanel';
import { BiomeSandboxPreviewPane } from './biome-sandbox/BiomeSandboxPreviewPane';
import { buildBiomeSandboxPreviewManifest } from './biome-sandbox/preview-manifest';
import { useBiomeSandboxPathSets } from './biome-sandbox/use-biome-sandbox-path-sets';
import { buildPreviewState } from './biome-sandbox/state/preview-state';
import { normalizeHexColor } from './biome-sandbox/state/settings-utils';
import { defaultsFromManifest, getBiomeSandboxThemeOptions, resolveBiomeSandboxTheme } from './biome-sandbox/state/default-settings';
import { useBiomeSandboxSettings } from './biome-sandbox/state/use-biome-sandbox-settings';
import type { VisualAssetManifest } from '../visual/asset-manifest';

interface BiomeSandboxProps {
  assetManifest: VisualAssetManifest | null;
  onBack: () => void;
}

export const BiomeSandbox: React.FC<BiomeSandboxProps> = ({ assetManifest, onBack }) => {
  const {
    settings,
    setSettings,
    copyStatus,
    copySettings,
    resetSettings
  } = useBiomeSandboxSettings(assetManifest);

  const themeOptions = useMemo(() => getBiomeSandboxThemeOptions(assetManifest), [assetManifest]);
  const resolvedTheme = useMemo(
    () => resolveBiomeSandboxTheme(assetManifest, settings?.theme || 'inferno'),
    [assetManifest, settings?.theme]
  );
  const themeKey = resolvedTheme.toLowerCase();
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
    return buildPreviewState(resolvedTheme, settings.seed, settings.injectHazards, settings.walls);
  }, [resolvedTheme, settings]);

  const handleThemeChange = useCallback((nextTheme: FloorTheme) => {
    if (!assetManifest) return;
    setSettings(() => defaultsFromManifest(assetManifest, nextTheme));
  }, [assetManifest, setSettings]);

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
        themeOptions={themeOptions}
        onThemeChange={handleThemeChange}
        onBack={onBack}
        onReset={resetSettings}
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
