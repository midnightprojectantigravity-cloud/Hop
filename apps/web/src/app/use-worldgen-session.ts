import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Action, GameState, GridSize, MapShape } from '@hop/engine';
import { usePendingFloorWorldgen } from './use-pending-floor-worldgen';
import {
  buildStartRunPayload,
  DEFAULT_START_RUN_MAP_SIZE,
  DEFAULT_START_RUN_MAP_SHAPE
} from './start-run-overrides';
import { buildStartRunCompileContext } from './worldgen-transport';
import {
  buildRunResumeContext,
  writeRunResumeContext,
  type RunResumeContext
} from './run-resume-context';
import { emitUiMetric } from './ui-telemetry';
import type { WorldgenWorkerState } from './use-worldgen-worker';
import type { WorldgenUiError } from './route-shell-shared';

export const resolveArcadeSplashStartRunRequest = () => ({
  loadoutId: 'VANGUARD',
  mode: 'daily' as const,
  source: 'arcade_start_run'
});

export interface WorldgenSessionController {
  worldgenUiError: WorldgenUiError | null;
  worldgenProgressLabel?: string;
  worldgenStatusLine?: string;
  worldgenInitialized: boolean;
  worldgenWarmState: 'idle' | 'warming' | 'ready' | 'error';
  pendingFloorWorldgen: ReturnType<typeof usePendingFloorWorldgen>;
  ensureWorldgenReady: (reason: 'start_run' | 'arcade_gate' | 'pending_floor') => Promise<void>;
  startRun: (params: {
    loadoutId: string;
    mode: 'normal' | 'daily';
    source: string;
    seed?: string;
    date?: string;
    mapSize?: GridSize;
    mapShape?: MapShape;
    mapSizeInputMode?: 'usable' | 'grid';
  }) => Promise<void>;
  clearWorldgenUiError: () => void;
  reportWorldgenUiError: (kind: WorldgenUiError['kind'], message: string) => void;
  arcadeSplashWaitingForReady: boolean;
  showArcadeDelayedPulse: boolean;
  handleEnterArcadeSplash: () => void;
  handleOpenHubFromArcadeSplash: () => void;
}

export const useWorldgenSession = ({
  gameState,
  worldgenWorker,
  worldgenDebugEnabled,
  dispatchWithTrace,
  setRunResumeContext,
  dispatchSensory,
  navigateTo,
  hubPath,
  isArcadeRoute,
  onRunStarted
}: {
  gameState: GameState;
  worldgenWorker: WorldgenWorkerState;
  worldgenDebugEnabled: boolean;
  dispatchWithTrace: (action: Action, source: string) => void;
  setRunResumeContext: (context: RunResumeContext) => void;
  dispatchSensory: (payload: Parameters<typeof import('./sensory-dispatcher').dispatchSensoryEvent>[0]) => void;
  navigateTo: (path: string) => void;
  hubPath: string;
  isArcadeRoute: boolean;
  onRunStarted?: () => void;
}): WorldgenSessionController => {
  const delayedPulseMetricSentRef = useRef(false);
  const [worldgenUiError, setWorldgenUiError] = useState<WorldgenUiError | null>(null);
  const [arcadeSplashWaitingForReady, setArcadeSplashWaitingForReady] = useState(false);
  const [showArcadeDelayedPulse, setShowArcadeDelayedPulse] = useState(false);

  const clearWorldgenUiError = useCallback(() => {
    setWorldgenUiError(null);
  }, []);

  const reportWorldgenUiError = useCallback((kind: WorldgenUiError['kind'], message: string) => {
    setWorldgenUiError({ kind, message });
  }, []);

  const worldgenWarmState = useMemo<WorldgenSessionController['worldgenWarmState']>(() => {
    if (worldgenWorker.phase === 'error') return 'error';
    if (worldgenWorker.phase === 'initializing') return 'warming';
    if (worldgenWorker.initialized) return 'ready';
    return 'idle';
  }, [worldgenWorker.initialized, worldgenWorker.phase]);

  const ensureWorldgenReady = useCallback(async (reason: 'start_run' | 'arcade_gate' | 'pending_floor') => {
    if (worldgenWarmState === 'ready') {
      return;
    }

    clearWorldgenUiError();

    try {
      await worldgenWorker.ensureReady();
      clearWorldgenUiError();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Worldgen runtime failed to initialize';
      console.error('[HOP_WORLDGEN_RUNTIME]', message, {
        reason,
        contractVersion: worldgenWorker.contractVersion,
        runtimeApiVersion: worldgenWorker.runtimeApiVersion
      });
      reportWorldgenUiError('init', message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [
    clearWorldgenUiError,
    reportWorldgenUiError,
    worldgenWarmState,
    worldgenWorker
  ]);

  const pendingFloorWorldgen = usePendingFloorWorldgen({
    gameState,
    worldgenWorker,
    worldgenDebugEnabled,
    dispatchWithTrace,
    ensureWorldgenReady: () => ensureWorldgenReady('pending_floor'),
    reportWorldgenUiError,
    clearWorldgenUiError
  });

  const compileProgressLabel = worldgenWorker.progress
    ? `Compiling: ${worldgenWorker.progress.pass} (${worldgenWorker.progress.percent}%)`
    : undefined;

  const worldgenProgressLabel = pendingFloorWorldgen.progressLabel
    || (worldgenWorker.phase === 'initializing' ? 'Warming worldgen runtime...' : compileProgressLabel);

  const worldgenStatusLine = worldgenWorker.phase === 'initializing'
    ? 'Warming worldgen runtime...'
    : worldgenProgressLabel
      || (worldgenWarmState === 'ready'
        ? 'Worldgen runtime ready'
        : 'Worldgen runtime standing by');

  useEffect(() => {
    if (!worldgenWorker.error || worldgenWarmState !== 'error') return;
    setWorldgenUiError((previous) => previous ?? {
      kind: 'init',
      message: worldgenWorker.error || 'Worldgen runtime failed to initialize'
    });
  }, [worldgenWarmState, worldgenWorker.error]);

  useEffect(() => {
    if (isArcadeRoute && gameState.gameStatus === 'hub') return;
    setArcadeSplashWaitingForReady(false);
    setShowArcadeDelayedPulse(false);
  }, [gameState.gameStatus, isArcadeRoute]);

  useEffect(() => {
    if (!arcadeSplashWaitingForReady || worldgenWarmState === 'ready') {
      setShowArcadeDelayedPulse(false);
      return;
    }
    const pulseTimeout = window.setTimeout(() => {
      setShowArcadeDelayedPulse(true);
      if (!delayedPulseMetricSentRef.current) {
        emitUiMetric('splash_delayed_ready_pulse_shown', 1, { thresholdMs: 1500 });
        delayedPulseMetricSentRef.current = true;
      }
    }, 1500);
    return () => window.clearTimeout(pulseTimeout);
  }, [arcadeSplashWaitingForReady, worldgenWarmState]);

  const startRun = useCallback(async (params: {
    loadoutId: string;
    mode: 'normal' | 'daily';
    source: string;
    seed?: string;
    date?: string;
    mapSize?: GridSize;
    mapShape?: MapShape;
    mapSizeInputMode?: 'usable' | 'grid';
  }) => {
    const initialized = await ensureWorldgenReady('start_run').then(() => true).catch(() => null);
    if (!initialized) {
      return;
    }

    const payload = buildStartRunPayload({
      loadoutId: params.loadoutId,
      mode: params.mode,
      seed: params.seed,
      date: params.date,
      mapSize: params.mapSize || DEFAULT_START_RUN_MAP_SIZE,
      mapShape: params.mapShape || DEFAULT_START_RUN_MAP_SHAPE,
      mapSizeInputMode: params.mapSizeInputMode || 'usable'
    });
    const context = buildStartRunCompileContext({
      loadoutId: params.loadoutId,
      mode: params.mode,
      seed: payload.seed,
      date: payload.date,
      mapSize: payload.mapSize,
      mapShape: payload.mapShape,
      generationSpec: payload.generationSpec,
      includeDebug: worldgenDebugEnabled
    });
    const artifact = await worldgenWorker.compileRunStart(context).catch((error: Error) => {
      console.error('[HOP_WORLDGEN_START_FAILED]', error, {
        contractVersion: worldgenWorker.contractVersion,
        runtimeApiVersion: worldgenWorker.runtimeApiVersion
      });
      reportWorldgenUiError('start_run', error.message || 'Worldgen start failed');
      return null;
    });
    if (!artifact) return;

    clearWorldgenUiError();
    dispatchSensory({
      id: 'run-floor-transition',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    dispatchWithTrace({ type: 'APPLY_WORLDGEN_ARTIFACT', payload: artifact }, params.source);
    const nextContext = buildRunResumeContext({
      loadoutId: params.loadoutId,
      mode: params.mode,
      dailyDate: params.mode === 'daily' ? params.date : undefined
    });
    setRunResumeContext(nextContext);
    writeRunResumeContext(nextContext);
    onRunStarted?.();
  }, [
    clearWorldgenUiError,
    dispatchSensory,
    dispatchWithTrace,
    ensureWorldgenReady,
    onRunStarted,
    reportWorldgenUiError,
    setRunResumeContext,
    worldgenDebugEnabled,
    worldgenWarmState,
    worldgenWorker
  ]);

  const handleEnterArcadeSplash = useCallback(() => {
    dispatchSensory({
      id: 'ui-danger-drum',
      intensity: 1.0,
      priority: 'high',
      context: 'hub'
    });
    clearWorldgenUiError();
    setArcadeSplashWaitingForReady(true);
    setShowArcadeDelayedPulse(false);
    const startRunRequest = resolveArcadeSplashStartRunRequest();
    void startRun(startRunRequest)
      .then(() => {
        setShowArcadeDelayedPulse(false);
      })
      .catch(() => {
        // startRun reports worldgen errors through session state.
      })
      .finally(() => {
        setArcadeSplashWaitingForReady(false);
      });
  }, [clearWorldgenUiError, dispatchSensory, startRun]);

  const handleOpenHubFromArcadeSplash = useCallback(() => {
    setArcadeSplashWaitingForReady(false);
    setShowArcadeDelayedPulse(false);
    navigateTo(hubPath);
  }, [hubPath, navigateTo]);

  return useMemo(() => ({
    worldgenUiError,
    worldgenProgressLabel,
    worldgenStatusLine,
    worldgenInitialized: worldgenWorker.initialized,
    worldgenWarmState,
    pendingFloorWorldgen,
    ensureWorldgenReady,
    startRun,
    clearWorldgenUiError,
    reportWorldgenUiError,
    arcadeSplashWaitingForReady,
    showArcadeDelayedPulse,
    handleEnterArcadeSplash,
    handleOpenHubFromArcadeSplash
  }), [
    arcadeSplashWaitingForReady,
    clearWorldgenUiError,
    ensureWorldgenReady,
    handleEnterArcadeSplash,
    handleOpenHubFromArcadeSplash,
    pendingFloorWorldgen,
    reportWorldgenUiError,
    showArcadeDelayedPulse,
    startRun,
    worldgenProgressLabel,
    worldgenStatusLine,
    worldgenUiError,
    worldgenWarmState,
    worldgenWorker.initialized
  ]);
};
