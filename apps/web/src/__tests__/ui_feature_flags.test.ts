import { describe, expect, it } from 'vitest';
import {
  UI_FEATURE_FLAGS_STORAGE_KEY,
  readUiFeatureFlags,
  writeUiFeatureFlags
} from '../app/ui-feature-flags';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('ui feature flags', () => {
  it('reads mobile dock v2 as enabled by default', () => {
    const flags = readUiFeatureFlags(null);
    expect(flags).toEqual({
      ui_mobile_dock_v2: true,
      ui_defeat_loop_v2: false,
      ui_sensory_dispatcher_v1: false,
      ui_dedicated_hub_routes_v1: false
    });
  });

  it('writes and re-reads persisted values', () => {
    const storage = new MemoryStorage();
    writeUiFeatureFlags(
      {
        ui_mobile_dock_v2: true,
        ui_defeat_loop_v2: false,
        ui_sensory_dispatcher_v1: true,
        ui_dedicated_hub_routes_v1: false
      },
      storage
    );

    expect(storage.getItem(UI_FEATURE_FLAGS_STORAGE_KEY)).toBeTruthy();
    const readBack = readUiFeatureFlags(storage);
    expect(readBack.ui_mobile_dock_v2).toBe(true);
    expect(readBack.ui_defeat_loop_v2).toBe(false);
    expect(readBack.ui_sensory_dispatcher_v1).toBe(true);
    expect(readBack.ui_dedicated_hub_routes_v1).toBe(false);
  });
});
