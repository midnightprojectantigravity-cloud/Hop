import { beforeEach, describe, expect, it } from 'vitest';
import { runDungeonLabArenaMatch } from '@hop/engine';
import {
  createDefaultDungeonLabArenaConfig,
  loadDungeonLabArenaArtifacts,
  loadDungeonLabArenaConfig,
  parseDungeonLabArenaConfig,
  persistDungeonLabArenaArtifacts,
  persistDungeonLabArenaConfig,
  serializeDungeonLabArenaConfig,
  toDungeonLabReplayRecord
} from '../app/dungeon-lab-storage';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  clear(): void {
    this.values.clear();
  }
}

class QuotaStorage extends MemoryStorage {
  private readonly maxValueLength: number;

  constructor(maxValueLength: number) {
    super();
    this.maxValueLength = maxValueLength;
  }

  override setItem(key: string, value: string): void {
    if (value.length > this.maxValueLength) {
      throw new DOMException('Quota exceeded.', 'QuotaExceededError');
    }
    super.setItem(key, value);
  }
}

describe('dungeon lab arena storage helpers', () => {
  const storage = new MemoryStorage();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true
    });
  });

  it('round-trips the default arena config through local storage', () => {
    const config = createDefaultDungeonLabArenaConfig();
    persistDungeonLabArenaConfig(config);

    const loaded = loadDungeonLabArenaConfig();
    expect(loaded).toEqual(config);
    expect(loaded.version).toBe('dungeon-lab-arena-v2');
    expect(loaded.actors[0]?.skillIds).toContain('BASIC_ATTACK');
  });

  it('serializes and parses arena configs through the shared import/export helpers', () => {
    const config = createDefaultDungeonLabArenaConfig();
    const raw = serializeDungeonLabArenaConfig(config);
    const parsed = parseDungeonLabArenaConfig(raw);

    expect(parsed).toEqual(config);
    expect(() => parseDungeonLabArenaConfig(JSON.stringify({ version: 'wrong-version' }))).toThrow(/DungeonLabArenaConfigV2/i);
  });

  it('persists retained artifacts and converts them into replay records with initState', () => {
    const config = createDefaultDungeonLabArenaConfig();
    const artifact = runDungeonLabArenaMatch(config, 'dungeon-lab-arena-web-artifact');

    persistDungeonLabArenaArtifacts([artifact]);
    const loaded = loadDungeonLabArenaArtifacts();
    expect(loaded).toHaveLength(1);

    const record = toDungeonLabReplayRecord(loaded[0]);
    expect(record.initState).toEqual(loaded[0].initialState);
    expect(record.replay.version).toBe(3);
    expect(record.replay.run.seed).toBe('dungeon-lab-arena-web-artifact');
  });

  it('degrades artifact persistence gracefully when local storage quota is exceeded', () => {
    const quotaStorage = new QuotaStorage(40_000);
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: quotaStorage },
      configurable: true
    });

    const artifact = runDungeonLabArenaMatch(createDefaultDungeonLabArenaConfig(), 'dungeon-lab-arena-quota');

    expect(() => persistDungeonLabArenaArtifacts([artifact, artifact])).not.toThrow();

    const loaded = loadDungeonLabArenaArtifacts();
    expect(loaded.length).toBeLessThanOrEqual(1);
    if (loaded[0]) {
      expect(loaded[0].actionLog.length).toBeGreaterThan(0);
      expect(loaded[0].checkpoints.length).toBeGreaterThan(0);
      expect(loaded[0].replayEnvelope.actions.length).toBe(loaded[0].actionLog.length);
    }
  });
});
