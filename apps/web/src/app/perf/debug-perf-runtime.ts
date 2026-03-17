export type BoardPerfScenario =
  | 'idle_board'
  | 'hover_sweep'
  | 'dense_combat'
  | 'desktop_overlay_transition';

export interface BoardPerfSnapshot {
  reportedAt: string;
  scenario: BoardPerfScenario | null;
  avgFrameMs: number;
  p95FrameMs: number;
  longTaskCount: number;
  reactCommitCount: number;
  boardCommitCount: number;
  actorNodeLookupCount: number;
  eventDigestBuildCount: number;
  frameSampleCount: number;
}

type DebugPerfWindowConfig = {
  enabled?: boolean;
  scenario?: BoardPerfScenario | null;
  reportIntervalMs?: number;
};

type DebugPerfConfig = {
  enabled: boolean;
  scenario: BoardPerfScenario | null;
  reportIntervalMs: number;
};

type DebugPerfCounters = {
  longTaskCount: number;
  reactCommitCount: number;
  boardCommitCount: number;
  actorNodeLookupCount: number;
  eventDigestBuildCount: number;
};

type DebugPerfRuntimeState = {
  counters: DebugPerfCounters;
  frameSamples: number[];
  lastSnapshotAtMs: number;
  observersInstalled: boolean;
};

declare global {
  interface Window {
    __HOP_DEBUG_PERF?: boolean | DebugPerfWindowConfig;
    __HOP_DEBUG_PERF_HISTORY__?: BoardPerfSnapshot[];
    __HOP_DEBUG_PERF_RUNTIME__?: DebugPerfRuntimeState;
    __HOP_DEBUG_PERF_SNAPSHOT__?: BoardPerfSnapshot;
  }
}

const DEFAULT_REPORT_INTERVAL_MS = 2_000;
const MAX_FRAME_SAMPLES = 600;

const EMPTY_COUNTERS = (): DebugPerfCounters => ({
  longTaskCount: 0,
  reactCommitCount: 0,
  boardCommitCount: 0,
  actorNodeLookupCount: 0,
  eventDigestBuildCount: 0,
});

const round = (value: number): number => Number(value.toFixed(2));

const normalizeScenario = (value: string | null | undefined): BoardPerfScenario | null => {
  switch (value) {
    case 'idle_board':
    case 'hover_sweep':
    case 'dense_combat':
    case 'desktop_overlay_transition':
      return value;
    default:
      return null;
  }
};

const readWindowConfig = (): DebugPerfWindowConfig | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.__HOP_DEBUG_PERF;
  if (typeof raw === 'boolean') {
    return raw ? { enabled: true } : { enabled: false };
  }
  if (raw && typeof raw === 'object') {
    return raw;
  }
  return null;
};

export const resolveDebugPerfConfig = (): DebugPerfConfig => {
  if (typeof window === 'undefined') {
    return {
      enabled: false,
      scenario: null,
      reportIntervalMs: DEFAULT_REPORT_INTERVAL_MS,
    };
  }

  const params = new URLSearchParams(window.location.search);
  const queryEnabled = params.get('perf') === '1';
  const queryScenario = normalizeScenario(params.get('scenario'));
  const windowConfig = readWindowConfig();
  const enabled = Boolean(queryEnabled || windowConfig?.enabled);

  return {
    enabled,
    scenario: queryScenario ?? normalizeScenario(windowConfig?.scenario ?? null),
    reportIntervalMs: Math.max(
      500,
      Math.round(Number(windowConfig?.reportIntervalMs || DEFAULT_REPORT_INTERVAL_MS)),
    ),
  };
};

const getRuntimeState = (): DebugPerfRuntimeState | null => {
  if (typeof window === 'undefined') return null;
  if (!window.__HOP_DEBUG_PERF_RUNTIME__) {
    window.__HOP_DEBUG_PERF_RUNTIME__ = {
      counters: EMPTY_COUNTERS(),
      frameSamples: [],
      lastSnapshotAtMs: performance.now(),
      observersInstalled: false,
    };
  }
  return window.__HOP_DEBUG_PERF_RUNTIME__;
};

export const recordDebugPerfCounter = (
  counter: keyof DebugPerfCounters,
  amount: number = 1,
): void => {
  const config = resolveDebugPerfConfig();
  if (!config.enabled) return;
  const runtime = getRuntimeState();
  if (!runtime) return;
  runtime.counters[counter] += amount;
};

export const recordDebugPerfReactCommit = (id: string): void => {
  recordDebugPerfCounter('reactCommitCount');
  if (id.startsWith('board:')) {
    recordDebugPerfCounter('boardCommitCount');
  }
};

export const recordDebugPerfFrameSample = (frameMs: number): void => {
  const config = resolveDebugPerfConfig();
  if (!config.enabled) return;
  const runtime = getRuntimeState();
  if (!runtime) return;
  runtime.frameSamples.push(frameMs);
  if (runtime.frameSamples.length > MAX_FRAME_SAMPLES) {
    runtime.frameSamples.splice(0, runtime.frameSamples.length - MAX_FRAME_SAMPLES);
  }
};

export const recordDebugPerfPerformanceEntry = (entryType: string): void => {
  if (entryType === 'longtask') {
    recordDebugPerfCounter('longTaskCount');
  }
};

export const ensureDebugPerfObservers = (): void => {
  const config = resolveDebugPerfConfig();
  if (!config.enabled || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
    return;
  }
  const runtime = getRuntimeState();
  if (!runtime || runtime.observersInstalled) return;
  runtime.observersInstalled = true;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        recordDebugPerfPerformanceEntry(entry.entryType);
      }
    });
    observer.observe({ entryTypes: ['longtask', 'measure'] as any });
  } catch {
    // Unsupported entry types should not break the app.
  }
};

export const flushDebugPerfSnapshot = (force: boolean = false): BoardPerfSnapshot | null => {
  const config = resolveDebugPerfConfig();
  if (!config.enabled) return null;
  const runtime = getRuntimeState();
  if (!runtime) return null;

  const nowMs = performance.now();
  if (!force && (nowMs - runtime.lastSnapshotAtMs) < config.reportIntervalMs) {
    return null;
  }

  const frameSamples = runtime.frameSamples.slice().sort((a, b) => a - b);
  const avgFrameMs = frameSamples.length > 0
    ? frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length
    : 0;
  const p95FrameMs = frameSamples.length > 0
    ? frameSamples[Math.min(frameSamples.length - 1, Math.floor(frameSamples.length * 0.95))]
    : 0;

  const snapshot: BoardPerfSnapshot = {
    reportedAt: new Date().toISOString(),
    scenario: config.scenario,
    avgFrameMs: round(avgFrameMs),
    p95FrameMs: round(p95FrameMs),
    longTaskCount: runtime.counters.longTaskCount,
    reactCommitCount: runtime.counters.reactCommitCount,
    boardCommitCount: runtime.counters.boardCommitCount,
    actorNodeLookupCount: runtime.counters.actorNodeLookupCount,
    eventDigestBuildCount: runtime.counters.eventDigestBuildCount,
    frameSampleCount: frameSamples.length,
  };

  runtime.counters = EMPTY_COUNTERS();
  runtime.frameSamples = [];
  runtime.lastSnapshotAtMs = nowMs;
  window.__HOP_DEBUG_PERF_SNAPSHOT__ = snapshot;
  window.__HOP_DEBUG_PERF_HISTORY__ = [...(window.__HOP_DEBUG_PERF_HISTORY__ || []), snapshot].slice(-30);
  return snapshot;
};
