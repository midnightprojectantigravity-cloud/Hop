import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createJuiceEffectsStore } from '../components/juice/juice-effects-store';

const hex = (q: number, r: number, s: number) => ({ q, r, s });

describe('juice effects store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(500);
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('notifies only when queued effects cross real start and expiry boundaries', () => {
    const store = createJuiceEffectsStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.enqueueEffects([{
      id: 'fx-1',
      type: 'impact',
      position: hex(0, 0, 0),
      startTime: 600,
      ttlMs: 120,
    }]);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot().nowMs).toBe(500);
    expect(store.getSnapshot().effects).toHaveLength(1);

    vi.advanceTimersByTime(99);
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().nowMs).toBe(600);
    expect(store.getSnapshot().effects).toHaveLength(1);

    vi.advanceTimersByTime(119);
    expect(listener).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1);
    expect(listener).toHaveBeenCalledTimes(3);
    expect(store.getSnapshot().nowMs).toBe(720);
    expect(store.getSnapshot().effects).toHaveLength(0);

    unsubscribe();
  });

  it('cancels pending boundaries when reset is called', () => {
    const store = createJuiceEffectsStore();
    const listener = vi.fn();

    store.subscribe(listener);
    store.enqueueEffects([{
      id: 'fx-2',
      type: 'combat_text',
      position: hex(1, 0, -1),
      startTime: 700,
      ttlMs: 300,
      payload: { text: '-2' },
    }]);

    expect(listener).toHaveBeenCalledTimes(1);

    store.reset();
    expect(store.getSnapshot().effects).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1_000);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
