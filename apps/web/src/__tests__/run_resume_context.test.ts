import { describe, expect, it } from 'vitest';
import {
  RUN_RESUME_CONTEXT_STORAGE_KEY,
  buildRunResumeContext,
  deriveQuickRestartStartRunPayload,
  readRunResumeContext,
  writeRunResumeContext
} from '../app/run-resume-context';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.has(key) ? (this.values.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('run resume context', () => {
  it('persists and restores last run context', () => {
    const storage = new MemoryStorage();
    const context = buildRunResumeContext({
      loadoutId: 'VANGUARD',
      mode: 'daily',
      dailyDate: '2026-03-03'
    });

    writeRunResumeContext(context, storage);

    expect(storage.getItem(RUN_RESUME_CONTEXT_STORAGE_KEY)).toBeTruthy();
    expect(readRunResumeContext(storage)).toEqual(context);
  });

  it('derives quick restart payload for normal mode with a fresh seed', () => {
    const payload = deriveQuickRestartStartRunPayload({
      context: {
        lastLoadoutId: 'VANGUARD',
        lastRunMode: 'normal'
      },
      seedFactory: () => 'seed-123'
    });

    expect(payload).toEqual({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      seed: 'seed-123'
    });
  });

  it('derives quick restart payload for daily mode with deterministic date', () => {
    const payload = deriveQuickRestartStartRunPayload({
      context: {
        lastLoadoutId: 'SKIRMISHER',
        lastRunMode: 'daily',
        lastDailyDate: '2026-03-03'
      },
      seedFactory: () => 'should-not-be-used'
    });

    expect(payload).toEqual({
      loadoutId: 'SKIRMISHER',
      mode: 'daily',
      date: '2026-03-03'
    });
  });
});
