export interface UiFeatureFlags {
  ui_mobile_dock_v2: boolean;
  ui_defeat_loop_v2: boolean;
  ui_sensory_dispatcher_v1: boolean;
  ui_dedicated_hub_routes_v1: boolean;
  strict_target_path_parity_v1: boolean;
}

export const UI_FEATURE_FLAGS_STORAGE_KEY = 'hop_ui_feature_flags_v1';

const DEFAULT_UI_FEATURE_FLAGS: UiFeatureFlags = {
  ui_mobile_dock_v2: true,
  ui_defeat_loop_v2: false,
  ui_sensory_dispatcher_v1: false,
  ui_dedicated_hub_routes_v1: false,
  strict_target_path_parity_v1: false
};

type FlagStorage = Pick<Storage, 'getItem' | 'setItem'>;

const getBrowserStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'on', 'enabled', 'yes'].includes(normalized)) return true;
  if (['0', 'false', 'off', 'disabled', 'no'].includes(normalized)) return false;
  return null;
};

const normalizeFlags = (value: unknown): UiFeatureFlags => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_UI_FEATURE_FLAGS };
  const source = value as Record<string, unknown>;
  return {
    ui_mobile_dock_v2: parseBoolean(source.ui_mobile_dock_v2) ?? DEFAULT_UI_FEATURE_FLAGS.ui_mobile_dock_v2,
    ui_defeat_loop_v2: parseBoolean(source.ui_defeat_loop_v2) ?? DEFAULT_UI_FEATURE_FLAGS.ui_defeat_loop_v2,
    ui_sensory_dispatcher_v1: parseBoolean(source.ui_sensory_dispatcher_v1) ?? DEFAULT_UI_FEATURE_FLAGS.ui_sensory_dispatcher_v1,
    ui_dedicated_hub_routes_v1:
      parseBoolean(source.ui_dedicated_hub_routes_v1) ?? DEFAULT_UI_FEATURE_FLAGS.ui_dedicated_hub_routes_v1,
    strict_target_path_parity_v1:
      parseBoolean(source.strict_target_path_parity_v1) ?? DEFAULT_UI_FEATURE_FLAGS.strict_target_path_parity_v1
  };
};

const readFlagsFromQuery = (): Partial<UiFeatureFlags> => {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Partial<UiFeatureFlags> = {};
  (Object.keys(DEFAULT_UI_FEATURE_FLAGS) as (keyof UiFeatureFlags)[]).forEach((flag) => {
    const queryValue = parseBoolean(params.get(flag));
    if (queryValue !== null) {
      result[flag] = queryValue;
    }
  });
  return result;
};

export const readUiFeatureFlags = (storage: FlagStorage | null = getBrowserStorage()): UiFeatureFlags => {
  let rawFlags = { ...DEFAULT_UI_FEATURE_FLAGS };

  if (storage) {
    try {
      const saved = storage.getItem(UI_FEATURE_FLAGS_STORAGE_KEY);
      if (saved) {
        rawFlags = normalizeFlags(JSON.parse(saved));
      }
    } catch {
      rawFlags = { ...DEFAULT_UI_FEATURE_FLAGS };
    }
  }

  return {
    ...rawFlags,
    ...readFlagsFromQuery()
  };
};

export const writeUiFeatureFlags = (
  flags: Partial<UiFeatureFlags>,
  storage: FlagStorage | null = getBrowserStorage()
): UiFeatureFlags => {
  const normalized = {
    ...DEFAULT_UI_FEATURE_FLAGS,
    ...normalizeFlags(flags)
  };
  if (storage) {
    storage.setItem(UI_FEATURE_FLAGS_STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
};
