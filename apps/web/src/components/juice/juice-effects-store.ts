import type { JuiceEffect } from './juice-types';
import { getEffectLifetimeMs } from './juice-manager-utils';

export interface JuiceEffectsSnapshot {
  effects: ReadonlyArray<JuiceEffect>;
  nowMs: number;
}

export interface JuiceEffectsStore {
  getSnapshot: () => JuiceEffectsSnapshot;
  subscribe: (listener: () => void) => () => void;
  enqueueEffects: (effects: ReadonlyArray<JuiceEffect>) => void;
  reset: () => void;
  dispose: () => void;
}

const pruneExpiredEffects = (
  effects: ReadonlyArray<JuiceEffect>,
  nowMs: number,
): JuiceEffect[] => effects.filter((effect) => nowMs < (effect.startTime + getEffectLifetimeMs(effect)));

const resolveNextBoundaryDelayMs = (
  effects: ReadonlyArray<JuiceEffect>,
  nowMs: number,
): number => {
  let nextBoundaryMs = Number.POSITIVE_INFINITY;

  for (const effect of effects) {
    if (effect.startTime > nowMs) {
      nextBoundaryMs = Math.min(nextBoundaryMs, effect.startTime - nowMs);
    }

    const expiryMs = effect.startTime + getEffectLifetimeMs(effect);
    if (expiryMs > nowMs) {
      nextBoundaryMs = Math.min(nextBoundaryMs, expiryMs - nowMs);
    }
  }

  return nextBoundaryMs;
};

export const createJuiceEffectsStore = (): JuiceEffectsStore => {
  let snapshot: JuiceEffectsSnapshot = {
    effects: [],
    nowMs: Date.now(),
  };
  let boundaryTimerId: number | null = null;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  const cancelBoundaryTimer = () => {
    if (boundaryTimerId === null || typeof window === 'undefined') return;
    window.clearTimeout(boundaryTimerId);
    boundaryTimerId = null;
  };

  const commitSnapshot = (nowMs: number, effects: ReadonlyArray<JuiceEffect>) => {
    snapshot = {
      nowMs,
      effects: pruneExpiredEffects(effects, nowMs),
    };
  };

  const scheduleNextBoundary = () => {
    cancelBoundaryTimer();
    if (typeof window === 'undefined') return;

    const delayMs = resolveNextBoundaryDelayMs(snapshot.effects, snapshot.nowMs);
    if (!Number.isFinite(delayMs)) return;

    boundaryTimerId = window.setTimeout(() => {
      boundaryTimerId = null;
      commitSnapshot(Date.now(), snapshot.effects);
      notify();
      scheduleNextBoundary();
    }, Math.max(0, Math.floor(delayMs)));
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    enqueueEffects: (effects) => {
      if (effects.length === 0) return;
      const nowMs = Date.now();
      commitSnapshot(nowMs, [...snapshot.effects, ...effects]);
      notify();
      scheduleNextBoundary();
    },
    reset: () => {
      const hadEffects = snapshot.effects.length > 0;
      cancelBoundaryTimer();
      snapshot = {
        effects: [],
        nowMs: Date.now(),
      };
      if (hadEffects) {
        notify();
      }
    },
    dispose: () => {
      cancelBoundaryTimer();
      snapshot = {
        effects: [],
        nowMs: Date.now(),
      };
    },
  };
};
