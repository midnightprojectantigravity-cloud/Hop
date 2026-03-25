import { describe, expect, it } from 'vitest';
import {
  UI_PREFERENCES_LEGACY_STORAGE_KEY,
  UI_PREFERENCES_STORAGE_KEY,
  UI_THEME_STORAGE_KEY,
  applyUiPreferencesToRoot,
  readUiPreferences,
  writeUiPreferences,
  type UiPreferencesV1
} from '../app/ui-preferences';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('ui preferences v2', () => {
  it('reads default preferences when storage is empty', () => {
    const storage = new MemoryStorage();
    const prefs = readUiPreferences(storage);
    expect(prefs).toEqual({
      colorMode: 'parchment',
      motionMode: 'snappy',
      hudDensity: 'compact',
      mobileLayout: 'portrait_primary',
      turnFlowMode: 'protected_single',
      overdriveUiMode: 'per_turn_arm',
      audioEnabled: true,
      hapticsEnabled: true,
      vitalsMode: 'glance'
    });
  });

  it('writes and re-reads canonical preference keys', () => {
    const storage = new MemoryStorage();
    const prefs: UiPreferencesV1 = {
      colorMode: 'midnight',
      motionMode: 'reduced',
      hudDensity: 'comfortable',
      mobileLayout: 'portrait_primary',
      turnFlowMode: 'manual_chain',
      overdriveUiMode: 'per_turn_arm',
      audioEnabled: false,
      hapticsEnabled: false,
      vitalsMode: 'full'
    };

    writeUiPreferences(prefs, storage);

    expect(storage.getItem(UI_PREFERENCES_STORAGE_KEY)).toBeTruthy();
    expect(storage.getItem(UI_THEME_STORAGE_KEY)).toBe('midnight');

    const roundTrip = readUiPreferences(storage);
    expect(roundTrip).toEqual(prefs);
  });

  it('migrates legacy v1 preference payloads', () => {
    const storage = new MemoryStorage();
    storage.setItem(UI_PREFERENCES_LEGACY_STORAGE_KEY, JSON.stringify({
      colorMode: 'light',
      motionMode: 'snappy',
      hudDensity: 'compact',
      mobileLayout: 'portrait_primary',
      turnFlowMode: 'protected_single',
      overdriveUiMode: 'per_turn_arm'
    }));
    storage.setItem(UI_THEME_STORAGE_KEY, 'dark');

    const prefs = readUiPreferences(storage);
    expect(prefs.colorMode).toBe('midnight');
    expect(prefs.audioEnabled).toBe(true);
    expect(prefs.hapticsEnabled).toBe(true);
    expect(prefs.vitalsMode).toBe('glance');
  });

  it('applies preference dataset attributes to root element', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyUiPreferencesToRoot(
      {
        colorMode: 'midnight',
        motionMode: 'reduced',
        hudDensity: 'comfortable',
        mobileLayout: 'portrait_primary',
        turnFlowMode: 'protected_single',
        overdriveUiMode: 'per_turn_arm',
        audioEnabled: false,
        hapticsEnabled: true,
        vitalsMode: 'full'
      },
      root
    );

    expect(root.dataset.theme).toBe('midnight');
    expect(root.dataset.motion).toBe('reduced');
    expect(root.dataset.hudDensity).toBe('comfortable');
    expect(root.dataset.mobileLayout).toBe('portrait_primary');
    expect(root.dataset.turnFlowMode).toBe('protected_single');
    expect(root.dataset.audioEnabled).toBe('false');
    expect(root.dataset.hapticsEnabled).toBe('true');
    expect(root.dataset.vitalsMode).toBe('full');
  });
});
