import { describe, expect, it } from 'vitest';
import { generateInitialState } from '@hop/engine';
import type { ReplayRecord } from '../components/ReplayManager';
import { parseManualReplayEnvelope } from '../components/ReplayManager';
import {
  buildReplayRecordFromGameState,
  LEADERBOARD_STORAGE_KEY,
  persistReplayRecord,
  REPLAY_STORAGE_KEY
} from '../app/use-run-recording';
import { validateReplayRecordForPlayback } from '../app/use-replay-controller';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('replay v3 contract', () => {
  it('recorder builds ReplayEnvelopeV3 and writes new v3 storage keys', () => {
    const state = {
      ...generateInitialState(1, 'web-replay-v3-seed'),
      gameStatus: 'won' as const
    };
    const record = buildReplayRecordFromGameState(state);
    expect(record).toBeTruthy();
    expect(record?.replay.version).toBe(3);

    const storage = new MemoryStorage();
    persistReplayRecord(record as ReplayRecord, storage);

    const replayRaw = storage.getItem(REPLAY_STORAGE_KEY);
    const leaderboardRaw = storage.getItem(LEADERBOARD_STORAGE_KEY);
    expect(replayRaw).toBeTruthy();
    expect(leaderboardRaw).toBeTruthy();

    const parsedReplay = JSON.parse(replayRaw as string);
    expect(parsedReplay[0].replay.version).toBe(3);
  });

  it('replay controller rejects non-v3 envelopes', () => {
    const invalidRecord = {
      id: 'legacy',
      replay: {
        version: 2,
        run: { seed: 'legacy' },
        actions: [{ type: 'WAIT' }],
        meta: { recordedAt: '2026-03-03T00:00:00.000Z' }
      },
      score: 0,
      floor: 1,
      date: '2026-03-03T00:00:00.000Z'
    } as any;

    const result = validateReplayRecordForPlayback(invalidRecord);
    expect(result.ok).toBe(false);
    expect((result.error || '').toLowerCase()).toContain('version');
  });

  it('manual replay parser accepts v3 and rejects non-v3 payloads', () => {
    const state = {
      ...generateInitialState(1, 'manual-replay-v3-seed'),
      gameStatus: 'won' as const
    };
    const built = buildReplayRecordFromGameState(state) as ReplayRecord;
    const accepted = parseManualReplayEnvelope(JSON.stringify(built.replay));
    expect(accepted.record).toBeTruthy();
    expect(accepted.record?.replay.version).toBe(3);

    const rejected = parseManualReplayEnvelope(JSON.stringify({ seed: 'legacy', actions: [{ type: 'WAIT' }] }));
    expect(rejected.record).toBeUndefined();
    expect((rejected.error || '').toLowerCase()).toContain('replayenvelopev3');
  });
});
