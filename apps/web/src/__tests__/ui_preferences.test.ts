import { describe, expect, it } from 'vitest';
import {
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

describe('ui preferences v1', () => {
  it('reads default preferences when storage is empty', () => {
    const storage = new MemoryStorage();
    const prefs = readUiPreferences(storage);
    expect(prefs).toEqual({
      colorMode: 'light',
      motionMode: 'snappy',
      hudDensity: 'compact',
      mobileLayout: 'portrait_primary'
    });
  });

  it('writes and re-reads canonical preference keys', () => {
    const storage = new MemoryStorage();
    const prefs: UiPreferencesV1 = {
      colorMode: 'dark',
      motionMode: 'reduced',
      hudDensity: 'comfortable',
      mobileLayout: 'portrait_primary'
    };

    writeUiPreferences(prefs, storage);

    expect(storage.getItem(UI_PREFERENCES_STORAGE_KEY)).toBeTruthy();
    expect(storage.getItem(UI_THEME_STORAGE_KEY)).toBe('dark');

    const roundTrip = readUiPreferences(storage);
    expect(roundTrip).toEqual(prefs);
  });

  it('applies preference dataset attributes to root element', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyUiPreferencesToRoot(
      {
        colorMode: 'dark',
        motionMode: 'reduced',
        hudDensity: 'comfortable',
        mobileLayout: 'portrait_primary'
      },
      root
    );

    expect(root.dataset.theme).toBe('dark');
    expect(root.dataset.motion).toBe('reduced');
    expect(root.dataset.hudDensity).toBe('comfortable');
    expect(root.dataset.mobileLayout).toBe('portrait_primary');
  });
});
