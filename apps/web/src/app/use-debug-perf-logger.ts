import { useEffect } from 'react';
import {
  ensureDebugPerfObservers,
  flushDebugPerfSnapshot,
  recordDebugPerfFrameSample,
  resolveDebugPerfConfig,
} from './perf/debug-perf-runtime';

export const useDebugPerfLogger = (deps: ReadonlyArray<unknown>) => {
  useEffect(() => {
    const config = resolveDebugPerfConfig();
    if (!config.enabled || typeof window === 'undefined') return;
    ensureDebugPerfObservers();
    let raf = 0;
    let last = performance.now();
    const tick = (ts: number) => {
      const dt = ts - last;
      last = ts;
      recordDebugPerfFrameSample(dt);
      const snapshot = flushDebugPerfSnapshot();
      if (snapshot) {
        const fps = snapshot.avgFrameMs > 0 ? 1000 / snapshot.avgFrameMs : 0;
        console.log('[HOP_PERF]', {
          fps: Number(fps.toFixed(1)),
          ...snapshot,
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      const snapshot = flushDebugPerfSnapshot(true);
      if (snapshot) {
        const fps = snapshot.avgFrameMs > 0 ? 1000 / snapshot.avgFrameMs : 0;
        console.log('[HOP_PERF]', {
          fps: Number(fps.toFixed(1)),
          ...snapshot,
        });
      }
    };
  }, deps);
};
