import { useCallback, useEffect, useState } from 'react';

export const UI_THEME_IDS = [
  'parchment',
  'verdigris',
  'glacial',
  'rose',
  'midnight',
  'dusk',
  'cinder',
  'obsidian'
] as const;
export type UiColorMode = (typeof UI_THEME_IDS)[number];
export type UiMotionMode = 'snappy' | 'reduced';
export type UiHudDensity = 'compact' | 'comfortable';
export type UiMobileLayout = 'portrait_primary';
export type UiTurnFlowMode = 'protected_single' | 'manual_chain';
export type UiOverdriveUiMode = 'per_turn_arm';
export type UiVitalsMode = 'glance' | 'full';

export const UI_THEME_OPTIONS: ReadonlyArray<{ id: UiColorMode; label: string }> = [
  { id: 'parchment', label: 'Parchment' },
  { id: 'verdigris', label: 'Verdigris' },
  { id: 'glacial', label: 'Glacial' },
  { id: 'rose', label: 'Rose' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'dusk', label: 'Dusk' },
  { id: 'cinder', label: 'Cinder' },
  { id: 'obsidian', label: 'Obsidian' }
];

export interface UiPreferencesV2 {
  colorMode: UiColorMode;
  motionMode: UiMotionMode;
  hudDensity: UiHudDensity;
  mobileLayout: UiMobileLayout;
  turnFlowMode: UiTurnFlowMode;
  overdriveUiMode: UiOverdriveUiMode;
  audioEnabled: boolean;
  hapticsEnabled: boolean;
  vitalsMode: UiVitalsMode;
}

export type UiPreferencesV1 = UiPreferencesV2;

export const UI_PREFERENCES_STORAGE_KEY = 'hop_ui_prefs_v2';
export const UI_PREFERENCES_LEGACY_STORAGE_KEY = 'hop_ui_prefs_v1';
export const UI_THEME_STORAGE_KEY = 'hop_ui_theme_v1';

export const DEFAULT_UI_PREFERENCES: UiPreferencesV2 = {
  colorMode: 'parchment',
  motionMode: 'snappy',
  hudDensity: 'compact',
  mobileLayout: 'portrait_primary',
  turnFlowMode: 'protected_single',
  overdriveUiMode: 'per_turn_arm',
  audioEnabled: true,
  hapticsEnabled: true,
  vitalsMode: 'glance'
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

const resolveColorMode = (value: unknown): UiColorMode | null => {
  if (value === 'light') return 'parchment';
  if (value === 'dark') return 'midnight';
  if (typeof value !== 'string') return null;
  if ((UI_THEME_IDS as readonly string[]).includes(value)) {
    return value as UiColorMode;
  }
  return null;
};

const isMotionMode = (value: unknown): value is UiMotionMode => value === 'snappy' || value === 'reduced';
const isHudDensity = (value: unknown): value is UiHudDensity => value === 'compact' || value === 'comfortable';
const isMobileLayout = (value: unknown): value is UiMobileLayout => value === 'portrait_primary';
const isTurnFlowMode = (value: unknown): value is UiTurnFlowMode => value === 'protected_single' || value === 'manual_chain';
const isOverdriveUiMode = (value: unknown): value is UiOverdriveUiMode => value === 'per_turn_arm';
const isVitalsMode = (value: unknown): value is UiVitalsMode => value === 'glance' || value === 'full';

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const normalizeUiPreferences = (input: unknown): UiPreferencesV2 => {
  const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    colorMode: resolveColorMode(obj.colorMode) ?? DEFAULT_UI_PREFERENCES.colorMode,
    motionMode: isMotionMode(obj.motionMode) ? obj.motionMode : DEFAULT_UI_PREFERENCES.motionMode,
    hudDensity: isHudDensity(obj.hudDensity) ? obj.hudDensity : DEFAULT_UI_PREFERENCES.hudDensity,
    mobileLayout: isMobileLayout(obj.mobileLayout) ? obj.mobileLayout : DEFAULT_UI_PREFERENCES.mobileLayout,
    turnFlowMode: isTurnFlowMode(obj.turnFlowMode) ? obj.turnFlowMode : DEFAULT_UI_PREFERENCES.turnFlowMode,
    overdriveUiMode: isOverdriveUiMode(obj.overdriveUiMode) ? obj.overdriveUiMode : DEFAULT_UI_PREFERENCES.overdriveUiMode,
    audioEnabled: typeof obj.audioEnabled === 'boolean' ? obj.audioEnabled : DEFAULT_UI_PREFERENCES.audioEnabled,
    hapticsEnabled: typeof obj.hapticsEnabled === 'boolean' ? obj.hapticsEnabled : DEFAULT_UI_PREFERENCES.hapticsEnabled,
    vitalsMode: isVitalsMode(obj.vitalsMode) ? obj.vitalsMode : DEFAULT_UI_PREFERENCES.vitalsMode
  };
};

export const readUiPreferences = (storage: Pick<Storage, 'getItem'> | null = getBrowserStorage()): UiPreferencesV2 => {
  if (!storage) return { ...DEFAULT_UI_PREFERENCES };

  let parsed: unknown = null;
  try {
    const raw = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
    const legacyRaw = storage.getItem(UI_PREFERENCES_LEGACY_STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : legacyRaw ? JSON.parse(legacyRaw) : null;
  } catch {
    parsed = null;
  }

  const normalized = normalizeUiPreferences(parsed);

  try {
    const legacyTheme = storage.getItem(UI_THEME_STORAGE_KEY);
    const resolvedTheme = resolveColorMode(legacyTheme);
    if (resolvedTheme) {
      normalized.colorMode = resolvedTheme;
    }
  } catch {
    // ignore malformed storage for theme key
  }

  return normalized;
};

export const writeUiPreferences = (
  preferences: UiPreferencesV2,
  storage: StorageLike | null = getBrowserStorage()
): void => {
  if (!storage) return;
  const normalized = normalizeUiPreferences(preferences);
  storage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(normalized));
  storage.setItem(UI_THEME_STORAGE_KEY, normalized.colorMode);
};

export const applyUiPreferencesToRoot = (
  preferences: UiPreferencesV2,
  root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null
): void => {
  if (!root) return;
  const normalized = normalizeUiPreferences(preferences);
  root.dataset.theme = normalized.colorMode;
  root.dataset.motion = normalized.motionMode;
  root.dataset.hudDensity = normalized.hudDensity;
  root.dataset.mobileLayout = normalized.mobileLayout;
  root.dataset.turnFlowMode = normalized.turnFlowMode;
  root.dataset.audioEnabled = String(normalized.audioEnabled);
  root.dataset.hapticsEnabled = String(normalized.hapticsEnabled);
  root.dataset.vitalsMode = normalized.vitalsMode;
};

export const useUiPreferences = () => {
  const [preferences, setPreferences] = useState<UiPreferencesV2>(() => readUiPreferences());

  useEffect(() => {
    writeUiPreferences(preferences);
    applyUiPreferencesToRoot(preferences);
  }, [preferences]);

  const patchPreferences = useCallback((patch: Partial<UiPreferencesV2>) => {
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
