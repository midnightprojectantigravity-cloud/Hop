import { useCallback, useEffect, useState } from 'react';

export type UiColorMode = 'light' | 'dark';
export type UiMotionMode = 'snappy' | 'reduced';
export type UiHudDensity = 'compact' | 'comfortable';
export type UiMobileLayout = 'portrait_primary';

export interface UiPreferencesV1 {
  colorMode: UiColorMode;
  motionMode: UiMotionMode;
  hudDensity: UiHudDensity;
  mobileLayout: UiMobileLayout;
}

export const UI_PREFERENCES_STORAGE_KEY = 'hop_ui_prefs_v1';
export const UI_THEME_STORAGE_KEY = 'hop_ui_theme_v1';

export const DEFAULT_UI_PREFERENCES: UiPreferencesV1 = {
  colorMode: 'light',
  motionMode: 'snappy',
  hudDensity: 'compact',
  mobileLayout: 'portrait_primary'
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const isColorMode = (value: unknown): value is UiColorMode => value === 'light' || value === 'dark';
const isMotionMode = (value: unknown): value is UiMotionMode => value === 'snappy' || value === 'reduced';
const isHudDensity = (value: unknown): value is UiHudDensity => value === 'compact' || value === 'comfortable';
const isMobileLayout = (value: unknown): value is UiMobileLayout => value === 'portrait_primary';

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const normalizeUiPreferences = (input: unknown): UiPreferencesV1 => {
  const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    colorMode: isColorMode(obj.colorMode) ? obj.colorMode : DEFAULT_UI_PREFERENCES.colorMode,
    motionMode: isMotionMode(obj.motionMode) ? obj.motionMode : DEFAULT_UI_PREFERENCES.motionMode,
    hudDensity: isHudDensity(obj.hudDensity) ? obj.hudDensity : DEFAULT_UI_PREFERENCES.hudDensity,
    mobileLayout: isMobileLayout(obj.mobileLayout) ? obj.mobileLayout : DEFAULT_UI_PREFERENCES.mobileLayout
  };
};

export const readUiPreferences = (storage: Pick<Storage, 'getItem'> | null = getBrowserStorage()): UiPreferencesV1 => {
  if (!storage) return { ...DEFAULT_UI_PREFERENCES };

  let parsed: unknown = null;
  try {
    const raw = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }

  const normalized = normalizeUiPreferences(parsed);

  // Theme key remains backward/forward-compatible as a dedicated preference key.
  try {
    const legacyTheme = storage.getItem(UI_THEME_STORAGE_KEY);
    if (isColorMode(legacyTheme)) {
      normalized.colorMode = legacyTheme;
    }
  } catch {
    // ignore malformed storage for theme key and continue with normalized defaults
  }

  return normalized;
};

export const writeUiPreferences = (
  preferences: UiPreferencesV1,
  storage: StorageLike | null = getBrowserStorage()
): void => {
  if (!storage) return;
  const normalized = normalizeUiPreferences(preferences);
  storage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  storage.setItem(UI_THEME_STORAGE_KEY, normalized.colorMode);
};

export const applyUiPreferencesToRoot = (
  preferences: UiPreferencesV1,
  root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null
): void => {
  if (!root) return;
  const normalized = normalizeUiPreferences(preferences);
  root.dataset.theme = normalized.colorMode;
  root.dataset.motion = normalized.motionMode;
  root.dataset.hudDensity = normalized.hudDensity;
  root.dataset.mobileLayout = normalized.mobileLayout;
};

export const useUiPreferences = () => {
  const [preferences, setPreferences] = useState<UiPreferencesV1>(() => readUiPreferences());

  useEffect(() => {
    writeUiPreferences(preferences);
    applyUiPreferencesToRoot(preferences);
  }, [preferences]);

  const patchPreferences = useCallback((patch: Partial<UiPreferencesV1>) => {
    setPreferences((prev) => ({
      ...prev,
      ...patch
    }));
  }, []);

  return {
    preferences,
    patchPreferences,
    setPreferences
  };
};
