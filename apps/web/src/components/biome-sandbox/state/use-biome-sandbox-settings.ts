import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type {
  BiomeSandboxSettings
} from '../types';
import type { VisualAssetManifest } from '../../../visual/asset-manifest';
import { buildBiomeSandboxExportPayload } from '../export-payload';
import { defaultsFromManifest } from './default-settings';
import {
  SETTINGS_STORAGE_KEY,
  hydrateStoredSettings,
  parseStoredSettings
} from './settings-storage';

interface UseBiomeSandboxSettingsResult {
  settings: BiomeSandboxSettings | null;
  setSettings: Dispatch<SetStateAction<BiomeSandboxSettings | null>>;
  copyStatus: string;
  copySettings: () => Promise<void>;
  resetSettings: () => void;
}

export const useBiomeSandboxSettings = (
  assetManifest: VisualAssetManifest | null
): UseBiomeSandboxSettingsResult => {
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

  const copySettings = async (): Promise<void> => {
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

  const resetSettings = (): void => {
    if (!assetManifest) return;
    setSettings(prev => {
      if (!prev) return prev;
      return defaultsFromManifest(assetManifest, prev.theme);
    });
  };

  return {
    settings,
    setSettings,
    copyStatus,
    copySettings,
    resetSettings
  };
};
