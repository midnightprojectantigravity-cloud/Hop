import { useEffect } from 'react';

export const useDebugPerfLogger = (deps: ReadonlyArray<unknown>) => {
  useEffect(() => {
    const enabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_PERF);
    if (!enabled) return;
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let totalMs = 0;
    let windowStart = last;
    const tick = (ts: number) => {
      const dt = ts - last;
      last = ts;
      frames++;
      totalMs += dt;
      if (ts - windowStart >= 2000) {
        const avgMs = totalMs / Math.max(1, frames);
        const fps = 1000 / Math.max(1, avgMs);
        console.log('[HOP_PERF]', { fps: Number(fps.toFixed(1)), avgFrameMs: Number(avgMs.toFixed(2)), frames });
        windowStart = ts;
        frames = 0;
        totalMs = 0;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, deps);
};
