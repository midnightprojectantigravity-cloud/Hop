import { useRef, useState, useCallback, useEffect, Suspense, useMemo } from 'react';
import { hexEquals } from '@hop/engine';
import type { Point, Action, GameState, GridSize, MapShape } from '@hop/engine';
import { useAssetManifest } from './app/use-asset-manifest';
import { useDebugPerfLogger } from './app/use-debug-perf-logger';
import { useDebugQueryBridge } from './app/use-debug-query-bridge';
import { useFloorIntro } from './app/use-floor-intro';
import { usePersistedGameState } from './app/use-persisted-game-state';
import { useWorldgenWorker } from './app/use-worldgen-worker';
import { usePendingFloorWorldgen } from './app/use-pending-floor-worldgen';
import {
  buildStartRunCompileContext,
} from './app/worldgen-transport';
import { useReplayController } from './app/use-replay-controller';
import { buildReplayRecordFromGameState, useRunRecording } from './app/use-run-recording';
import { useSimulationFeedback } from './app/use-simulation-feedback';
import { useTurnFlowCoordinator } from './app/use-turn-flow-coordinator';
import { useTurnDriverTrace } from './app/use-turn-driver-trace';
import { useAppRouting } from './app/use-app-routing';
import {
  buildStartRunPayload,
  DEFAULT_START_RUN_MAP_SIZE,
  DEFAULT_START_RUN_MAP_SHAPE
} from './app/start-run-overrides';
import { getUiCapabilityRollout, setUiCapabilityRollout } from './app/capability-rollout';
import { emitUiMetric } from './app/ui-telemetry';
import { useUiPreferences } from './app/ui-preferences';
import { readUiFeatureFlags } from './app/ui-feature-flags';
import { dispatchSensoryEvent } from './app/sensory-dispatcher';
import {
  LazyBiomeSandbox,
  LazyGameScreen,
  LazyHubScreen,
  LazyLeaderboardScreen,
  LazySettingsScreen,
  LazyThemeManagerScreen,
  LazyTutorialReplayScreen,
  prefetchBiomeSandbox,
  prefetchGameScreen,
  prefetchHubScreen,
  prefetchLeaderboardScreen,
  prefetchThemeManagerScreen,
  prefetchSettingsScreen,
  prefetchTutorialReplayScreen
} from './app/lazy-screens';
import {
  buildRunResumeContext,
  deriveQuickRestartStartRunPayload,
  readRunResumeContext,
  writeRunResumeContext,
  type RunResumeContext
} from './app/run-resume-context';
import {
  EMPTY_SYNAPSE_SELECTION,
  type SynapsePulse,
  type SynapseSelection,
} from './app/synapse';
import splashPlaceholderImage from './assets/ui/splash-placeholder.jpg';

const AppScreenFallback = ({ label }: { label: string }) => (
  <div className="surface-app-material w-screen h-screen flex items-center justify-center bg-[var(--surface-app)] text-[var(--text-muted)] text-xs font-black uppercase tracking-[0.28em]">
    {label}
  </div>
);

const summarizeActionPayload = (action: Action): Record<string, unknown> | undefined => {
  const payload = (action as any).payload;
  if (!payload || typeof payload !== 'object') return undefined;

  if ('q' in payload && 'r' in payload) {
    return {
      q: Number((payload as any).q ?? 0),
      r: Number((payload as any).r ?? 0),
      s: Number((payload as any).s ?? 0)
    };
  }

  if ((action as any).type === 'USE_SKILL') {
    const p = payload as any;
    return {
      skillId: p.skillId ?? 'unknown',
      target: p.target ? { q: p.target.q, r: p.target.r, s: p.target.s } : null
    };
  }

  if ((action as any).type === 'START_RUN') {
    return {
      loadoutId: (payload as any).loadoutId ?? 'unknown',
      mode: (payload as any).mode ?? 'normal'
    };
  }

  if ((action as any).type === 'LOAD_STATE') {
    const state = payload as any;
    return {
      floor: state?.floor ?? 0,
      gameStatus: state?.gameStatus ?? 'unknown',
      turnNumber: state?.turnNumber ?? 0,
      queueLength: Array.isArray(state?.initiativeQueue) ? state.initiativeQueue.length : 0
    };
  }

  return {};
};

const ArcadeSplashGate = ({
  canEnter,
  waitingForReady,
  showDelayedPulse,
  statusLine,
  error,
  onEnterArcade,
  onOpenHub
}: {
  canEnter: boolean;
  waitingForReady: boolean;
  showDelayedPulse: boolean;
  statusLine?: string;
  error?: string;
  onEnterArcade: () => void;
  onOpenHub: () => void;
}) => {
  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[var(--surface-app)] text-[var(--text-inverse)]">
      <div
        className="absolute inset-0 bg-center bg-cover arcade-splash-layer"
        style={{
          backgroundImage: `url('${splashPlaceholderImage}')`
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/70" />
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 lg:p-12">
        <div className="max-w-xl rounded-3xl border border-white/20 bg-black/45 backdrop-blur-md p-6 sm:p-8">
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-[var(--font-heading)]">
            Hop Arcade
          </h1>
          <p className="mt-2 text-xs sm:text-sm uppercase tracking-[0.24em] text-amber-100/80">
            Daily Draft Entrance
          </p>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onEnterArcade}
              disabled={waitingForReady && !canEnter}
              className={`min-h-12 rounded-2xl border text-xs font-black uppercase tracking-[0.2em] ${
                waitingForReady && !canEnter
                  ? 'border-white/20 bg-white/10 text-white/60'
                  : 'border-amber-300/50 bg-amber-100/20 text-amber-50 hover:bg-amber-100/28'
              }`}
            >
              {waitingForReady && !canEnter ? 'Preparing...' : 'Tap To Enter'}
            </button>
            <button
              type="button"
              onClick={onOpenHub}
              className="min-h-12 rounded-2xl border border-white/30 bg-white/10 text-xs font-black uppercase tracking-[0.2em] hover:bg-white/15"
            >
              Hub
            </button>
          </div>
          {waitingForReady && (
            <div
              className={`mt-4 rounded-xl border border-white/20 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] ${
                showDelayedPulse ? 'arcade-ready-pulse' : ''
              }`}
            >
              {statusLine || 'Initializing engine...'}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-red-300/40 bg-red-950/50 px-3 py-3 text-[11px] text-red-100">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-200">Worldgen Error</div>
              <div className="mt-1 leading-relaxed">{error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

type WorldgenUiError = {
  kind: 'boot' | 'start_run' | 'stairs';
  message: string;
};

const WorldgenErrorOverlay = ({
  error,
  progressLabel,
  onDismiss,
  onRetry,
  onExitToHub
}: {
  error: WorldgenUiError | null;
  progressLabel?: string;
  onDismiss: () => void;
  onRetry?: () => void;
  onExitToHub?: () => void;
}) => {
  if (!error) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 px-4">
      <div className="w-full max-w-md rounded-3xl border border-red-300/30 bg-[var(--surface-panel)] p-5 text-[var(--text-primary)] shadow-2xl">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400">Worldgen Blocked</div>
        <div className="mt-3 text-sm leading-relaxed">{error.message}</div>
        {progressLabel && (
          <div className="mt-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {progressLabel}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-xl bg-[var(--accent-brass)] px-4 text-xs font-black uppercase tracking-[0.16em] text-[var(--text-inverse)]"
            >
              Retry
            </button>
          )}
          {onExitToHub && (
            <button
              type="button"
              onClick={onExitToHub}
              className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-panel-muted)] px-4 text-xs font-black uppercase tracking-[0.16em]"
            >
              Exit To Hub
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-11 rounded-xl border border-[var(--border-subtle)] bg-transparent px-4 text-xs font-black uppercase tracking-[0.16em]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

function App() {
  const { preferences: uiPreferences, patchPreferences: patchUiPreferences } = useUiPreferences();
  const {
    pathname,
    hubPath,
    arcadePath,
    biomesPath,
    themeLabPath,
    settingsPath,
    leaderboardPath,
    tutorialsPath,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isSettingsRoute,
    isLeaderboardRoute,
    isTutorialsRoute,
    navigateTo
  } = useAppRouting();
  const featureFlags = useMemo(() => readUiFeatureFlags(), []);
  const mobileDockV2Enabled = featureFlags.ui_mobile_dock_v2;
  const defeatLoopV2Enabled = featureFlags.ui_defeat_loop_v2;
  const sensoryDispatcherEnabled = featureFlags.ui_sensory_dispatcher_v1;
  const dedicatedHubRoutesEnabled = featureFlags.ui_dedicated_hub_routes_v1;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.uiMaterial = 'v2';
  }, []);

  const [gameState, dispatch] = usePersistedGameState();
  const worldgenWorker = useWorldgenWorker();
  const [worldgenUiError, setWorldgenUiError] = useState<WorldgenUiError | null>(null);
  const [runResumeContext, setRunResumeContext] = useState<RunResumeContext | null>(() => readRunResumeContext());
  const hubLoadoutSelectionAtRef = useRef<number | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const firstActionMeasuredRef = useRef(false);
  const defeatAtRef = useRef<number | null>(null);
  const runLostOverlayActionReadyRef = useRef(false);
  const bootStartedAtRef = useRef(Date.now());
  const bootMetricSentRef = useRef(false);
  const delayedPulseMetricSentRef = useRef(false);
  const [engineReady, setEngineReady] = useState(false);
  const [arcadeSplashEntered, setArcadeSplashEntered] = useState(false);
  const [arcadeSplashWaitingForReady, setArcadeSplashWaitingForReady] = useState(false);
  const [showArcadeDelayedPulse, setShowArcadeDelayedPulse] = useState(false);
  const worldgenDebugEnabled = useMemo(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('worldgenDebug') === '1';
  }, []);
  const worldgenRuntimeReady = engineReady && worldgenWorker.ready;

  const isDebugQueryEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_QUERY);
  const assetManifest = useAssetManifest();
  useDebugQueryBridge(gameState, isDebugQueryEnabled);

  const dispatchWithTraceProxyRef = useRef<(action: Action, source: string) => void>(() => { });
  const dispatchReplayAction = useCallback((action: Action, source: string) => {
    dispatchWithTraceProxyRef.current(action, source);
  }, []);
  const {
    isReplayMode,
    replayActions,
    replayActive,
    replayError,
    replayIndexRef,
    setReplayActive,
    resetReplayUi,
    startReplay,
    stepReplay,
    goToReplayIndex
  } = useReplayController({ dispatchWithTrace: dispatchReplayAction });
  useDebugPerfLogger([gameState.gameStatus, isReplayMode]);

  const replayMarkerIndices = useMemo(() => {
    if (replayActions.length === 0) return [0];
    const markerSet = new Set<number>();
    markerSet.add(0);
    replayActions.forEach((action, index) => {
      const type = (action as any)?.type;
      if (
        type === 'USE_SKILL'
        || type === 'MOVE'
        || type === 'ADVANCE_TURN'
        || type === 'RESOLVE_PENDING'
        || type === 'SELECT_UPGRADE'
      ) {
        markerSet.add(index + 1);
      }
    });
    markerSet.add(replayActions.length);
    const ordered = Array.from(markerSet).sort((a, b) => a - b);
    if (ordered.length <= 12) return ordered;
    const stride = Math.ceil(ordered.length / 12);
    const sampled = ordered.filter((_, index) => index % stride === 0);
    if (sampled[sampled.length - 1] !== replayActions.length) {
      sampled.push(replayActions.length);
    }
    return sampled;
  }, [replayActions]);

  const dispatchSensory = useCallback((payload: Parameters<typeof dispatchSensoryEvent>[0]) => {
    if (!sensoryDispatcherEnabled) return;
    dispatchSensoryEvent(payload);
  }, [sensoryDispatcherEnabled]);
  const clearWorldgenUiError = useCallback(() => {
    setWorldgenUiError(null);
  }, []);
  const reportWorldgenUiError = useCallback((kind: WorldgenUiError['kind'], message: string) => {
    setWorldgenUiError({ kind, message });
  }, []);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [showMovementRange, setShowMovementRange] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [postCommitInputLock, setPostCommitInputLock] = useState(false);
  const [isSynapseMode, setIsSynapseMode] = useState(false);
  const [synapseSelection, setSynapseSelection] = useState<SynapseSelection>(EMPTY_SYNAPSE_SELECTION);
  const [synapsePulse, setSynapsePulse] = useState<SynapsePulse>(null);
  const initialCapabilityRolloutRef = useRef(getUiCapabilityRollout());
  const [hubCapabilityPassivesEnabled, setHubCapabilityPassivesEnabled] = useState(
    initialCapabilityRolloutRef.current.capabilityPassivesEnabled
  );
  const [hubMovementRuntimeEnabled, setHubMovementRuntimeEnabled] = useState(
    initialCapabilityRolloutRef.current.movementRuntimeEnabled
  );
  const [hubMapShape, setHubMapShape] = useState<MapShape>(DEFAULT_START_RUN_MAP_SHAPE);
  const [hubMapSize, setHubMapSize] = useState<GridSize>(() => ({ ...DEFAULT_START_RUN_MAP_SIZE }));
  const {
    turnDriver,
    isInputLocked,
    appendTurnTrace,
    dispatchWithTrace
  } = useTurnDriverTrace({
    gameState,
    dispatch,
    isReplayMode,
    isBusy,
    postCommitInputLock,
    dispatchWithTraceProxyRef,
    summarizeActionPayload
  });

  const {
    mobileToasts,
    handleSimulationEvents,
    handleUiMirrorSnapshot
  } = useSimulationFeedback({ gameState, appendTurnTrace });
  const pendingFloorWorldgen = usePendingFloorWorldgen({
    gameState,
    worldgenWorker,
    worldgenDebugEnabled,
    dispatchWithTrace,
    reportWorldgenUiError,
    clearWorldgenUiError
  });
  const worldgenProgressLabel = pendingFloorWorldgen.progressLabel || (
    worldgenWorker.progress
      ? `Compiling: ${worldgenWorker.progress.pass} (${worldgenWorker.progress.percent}%)`
      : undefined
  );
  const { armPostCommitLock } = useTurnFlowCoordinator({
    gameState,
    turnDriver,
    isBusy,
    isReplayMode,
    postCommitInputLock,
    setPostCommitInputLock,
    appendTurnTrace,
    dispatchWithTrace,
    resolvePendingFloor: pendingFloorWorldgen.resolvePendingFloor
  });

  const [tutorialInstructions, setTutorialInstructions] = useState<string | null>(null);
  const floorIntro = useFloorIntro(gameState);
  useRunRecording(gameState, isReplayMode);

  useEffect(() => {
    if (engineReady) return;
    if (!assetManifest) return;
    setEngineReady(true);
    if (!bootMetricSentRef.current) {
      emitUiMetric('boot_ready_ms', Date.now() - bootStartedAtRef.current, {
        hasAssetManifest: true
      });
      bootMetricSentRef.current = true;
    }
  }, [assetManifest, engineReady]);

  useEffect(() => {
    if (!worldgenWorker.error) return;
    console.error('[HOP_WORLDGEN_WORKER]', worldgenWorker.error, {
      registryVersion: worldgenWorker.registryVersion,
      specSchemaVersion: worldgenWorker.specSchemaVersion
    });
    if (!worldgenWorker.ready) {
      setWorldgenUiError((previous) => previous ?? {
        kind: 'boot',
        message: worldgenWorker.error || 'Worldgen worker failed to initialize'
      });
    }
  }, [worldgenWorker.error, worldgenWorker.ready, worldgenWorker.registryVersion, worldgenWorker.specSchemaVersion]);

  useEffect(() => {
    if (!isArcadeRoute || gameState.gameStatus !== 'hub') return;
    if (!arcadeSplashEntered && !arcadeSplashWaitingForReady) return;
    if (worldgenRuntimeReady) return;
    setArcadeSplashEntered(false);
    setArcadeSplashWaitingForReady(false);
    setShowArcadeDelayedPulse(false);
  }, [
    arcadeSplashEntered,
    arcadeSplashWaitingForReady,
    worldgenRuntimeReady,
    gameState.gameStatus,
    isArcadeRoute
  ]);

  useEffect(() => {
    if (!arcadeSplashWaitingForReady || worldgenRuntimeReady) {
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
  }, [arcadeSplashWaitingForReady, worldgenRuntimeReady]);

  useEffect(() => {
    if (!arcadeSplashWaitingForReady || !worldgenRuntimeReady) return;
    setArcadeSplashEntered(true);
    setArcadeSplashWaitingForReady(false);
    setShowArcadeDelayedPulse(false);
  }, [arcadeSplashWaitingForReady, worldgenRuntimeReady]);

  useEffect(() => {
    const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '');
    const normalizedHubPath = hubPath.toLowerCase().replace(/\/+$/, '');
    const isKnownRoute =
      normalizedPath === normalizedHubPath
      || isArcadeRoute
      || isBiomesRoute
      || isThemeLabRoute
      || (dedicatedHubRoutesEnabled && isSettingsRoute)
      || (dedicatedHubRoutesEnabled && isLeaderboardRoute)
      || (dedicatedHubRoutesEnabled && isTutorialsRoute);
    if (isKnownRoute) return;
    console.warn('[HOP_UI] Unknown route, redirecting to hub', { pathname });
    navigateTo(hubPath);
  }, [
    hubPath,
    dedicatedHubRoutesEnabled,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isLeaderboardRoute,
    isSettingsRoute,
    isTutorialsRoute,
    navigateTo,
    pathname
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const runPrefetch = () => {
      if (cancelled) return;

      if (isBiomesRoute) {
        void prefetchHubScreen();
        void prefetchGameScreen();
        void prefetchThemeManagerScreen();
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      if (isThemeLabRoute) {
        void prefetchHubScreen();
        void prefetchGameScreen();
        void prefetchBiomeSandbox();
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      if (isSettingsRoute) {
        void prefetchHubScreen();
        void prefetchLeaderboardScreen();
        void prefetchTutorialReplayScreen();
        return;
      }

      if (isLeaderboardRoute) {
        void prefetchHubScreen();
        void prefetchSettingsScreen();
        void prefetchTutorialReplayScreen();
        return;
      }

      if (isTutorialsRoute) {
        void prefetchHubScreen();
        void prefetchSettingsScreen();
        void prefetchLeaderboardScreen();
        return;
      }

      if (gameState.gameStatus === 'hub') {
        void prefetchGameScreen();
        void prefetchThemeManagerScreen();
        if (!isArcadeRoute) {
          void prefetchBiomeSandbox();
        }
        if (dedicatedHubRoutesEnabled) {
          void prefetchSettingsScreen();
          void prefetchLeaderboardScreen();
          void prefetchTutorialReplayScreen();
        }
        return;
      }

      void prefetchHubScreen();
      if (dedicatedHubRoutesEnabled) {
        void prefetchSettingsScreen();
        void prefetchLeaderboardScreen();
        void prefetchTutorialReplayScreen();
      }
      void prefetchThemeManagerScreen();
      if (!isArcadeRoute && gameState.gameStatus !== 'lost') {
        void prefetchBiomeSandbox();
      }
    };

    if (typeof (window as any).requestIdleCallback === 'function') {
      const idleHandle = (window as any).requestIdleCallback(runPrefetch, { timeout: 700 });
      return () => {
        cancelled = true;
        if (typeof (window as any).cancelIdleCallback === 'function') {
          (window as any).cancelIdleCallback(idleHandle);
        }
      };
    }

    const timeoutHandle = window.setTimeout(runPrefetch, 80);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
    };
  }, [
    dedicatedHubRoutesEnabled,
    gameState.gameStatus,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isLeaderboardRoute,
    isSettingsRoute,
    isTutorialsRoute
  ]);

  const clearSynapseContext = useCallback(() => {
    setSynapseSelection(EMPTY_SYNAPSE_SELECTION);
    setSynapsePulse(null);
  }, []);

  const setSynapseMode = useCallback((enabled: boolean) => {
    setIsSynapseMode(enabled);
    if (!enabled) {
      setSynapseSelection(EMPTY_SYNAPSE_SELECTION);
      setSynapsePulse(null);
    }
  }, []);

  const toggleSynapseMode = useCallback(() => {
    setSynapseMode(!isSynapseMode);
  }, [isSynapseMode, setSynapseMode]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing' && isSynapseMode) {
      setSynapseMode(false);
    }
  }, [gameState.gameStatus, isSynapseMode, setSynapseMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (gameState.gameStatus !== 'playing') return;
      if (event.code === 'KeyI') {
        event.preventDefault();
        toggleSynapseMode();
        return;
      }
      if (event.code === 'Escape' && isSynapseMode) {
        event.preventDefault();
        setSynapseMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gameState.gameStatus, isSynapseMode, setSynapseMode, toggleSynapseMode]);

  const handleSelectSkill = (skillId: string | null) => {
    if (isInputLocked) return;
    if (skillId && isSynapseMode) {
      setSynapseMode(false);
    }
    if (skillId) {
      dispatchSensory({
        id: 'haptic-action-medium',
        intensity: 1.0,
        priority: 'low',
        context: 'run'
      });
      dispatchSensory({
        id: 'ui-synapse-chime',
        intensity: 1.0,
        priority: 'low',
        context: 'run'
      });
    }
    setSelectedSkillId(skillId);
  };

  const trackFirstActionMetric = useCallback((actionType: 'MOVE' | 'USE_SKILL' | 'WAIT') => {
    if (isReplayMode) return;
    if (firstActionMeasuredRef.current) return;
    if (runStartedAtRef.current === null) return;
    const elapsed = Date.now() - runStartedAtRef.current;
    emitUiMetric('first_action_ms', elapsed, { actionType });
    firstActionMeasuredRef.current = true;
  }, [isReplayMode]);

  const handleTileClick = (target: Point) => {
    if (isInputLocked) return;
    if (isSynapseMode) {
      setSynapseSelection({ mode: 'tile', tile: target });
      return;
    }
    if (selectedSkillId) {
      trackFirstActionMetric('USE_SKILL');
      dispatchSensory({
        id: 'haptic-action-medium',
        intensity: 1.0,
        priority: 'low',
        context: 'run'
      });
      armPostCommitLock();
      dispatchWithTrace({ type: 'USE_SKILL', payload: { skillId: selectedSkillId, target } }, 'player_use_skill');
      setSelectedSkillId(null);
      return;
    }
    if (hexEquals(target, gameState.player.position)) {
      setShowMovementRange(!showMovementRange);
      return;
    }
    trackFirstActionMetric('MOVE');
    dispatchSensory({
      id: 'haptic-action-medium',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    armPostCommitLock();
    dispatchWithTrace({ type: 'MOVE', payload: target }, 'player_move');
    setShowMovementRange(false);
  };

  const handleSynapseInspectEntity = useCallback((actorId: string) => {
    if (!isSynapseMode) return;
    setSynapseSelection({ mode: 'entity', actorId });
    setSynapsePulse({ actorId, token: Date.now() });
  }, [isSynapseMode]);

  const handleSelectUpgrade = (upgrade: string) => {
    if (isReplayMode || isBusy) return;
    dispatchWithTrace({ type: 'SELECT_UPGRADE', payload: upgrade }, 'upgrade_select');
  };

  const handleReset = () => {
    dispatchSensory({
      id: 'haptic-nav-light',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    dispatchWithTrace({ type: 'RESET' }, 'reset');
    setSelectedSkillId(null);
    setSynapseMode(false);
    resetReplayUi();
  };
  const handleWait = () => {
    if (isInputLocked) return;
    if (isSynapseMode) {
      setSynapseSelection(EMPTY_SYNAPSE_SELECTION);
      return;
    }
    trackFirstActionMetric('WAIT');
    dispatchSensory({
      id: 'haptic-action-medium',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    armPostCommitLock();
    dispatchWithTrace({ type: 'WAIT' }, 'player_wait');
    setSelectedSkillId(null);
  };

  const stopReplay = () => {
    dispatchSensory({
      id: 'ui-parchment-slide',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    handleExitToHub();
  };

  const handleLoadScenario = (state: GameState, instructions: string) => {
    dispatchWithTrace({ type: 'LOAD_STATE', payload: state }, 'scenario_load');
    setTutorialInstructions(instructions);
    setSelectedSkillId(null);
    setSynapseMode(false);
  };

  const handleExitToHub = () => {
    dispatchWithTrace({ type: 'EXIT_TO_HUB' }, 'exit_to_hub');
    setSelectedSkillId(null);
    setSynapseMode(false);
    resetReplayUi();
    navigateTo(hubPath);
  };

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
    if (!worldgenWorker.ready) {
      const message = worldgenWorker.error || 'Worldgen worker unavailable';
      console.error('[HOP_WORLDGEN_START_BLOCKED]', message);
      reportWorldgenUiError('start_run', message);
      return;
    }
    const payload = buildStartRunPayload({
      loadoutId: params.loadoutId,
      mode: params.mode,
      seed: params.seed,
      date: params.date,
      mapSize: params.mapSize || DEFAULT_START_RUN_MAP_SIZE,
      mapShape: params.mapShape || DEFAULT_START_RUN_MAP_SHAPE,
      mapSizeInputMode: params.mapSizeInputMode || 'usable',
      capabilityPassivesEnabled: hubCapabilityPassivesEnabled,
      movementRuntimeEnabled: hubMovementRuntimeEnabled
    });
    const context = buildStartRunCompileContext({
      loadoutId: params.loadoutId,
      mode: params.mode,
      seed: payload.seed,
      date: payload.date,
      mapSize: payload.mapSize,
      mapShape: payload.mapShape,
      rulesetOverrides: payload.rulesetOverrides as Record<string, unknown> | undefined,
      generationSpec: payload.generationSpec,
      includeDebug: worldgenDebugEnabled
    });
    const artifact = await worldgenWorker.compileRunStart(context).catch((error: Error) => {
      console.error('[HOP_WORLDGEN_START_FAILED]', error);
      reportWorldgenUiError('start_run', error.message || 'Worldgen start failed');
      return null;
    });
    if (!artifact) return;
    clearWorldgenUiError();
    dispatchWithTrace({ type: 'APPLY_WORLDGEN_ARTIFACT', payload: artifact }, params.source);
    const nextContext = buildRunResumeContext({
      loadoutId: params.loadoutId,
      mode: params.mode,
      dailyDate: params.mode === 'daily' ? params.date : undefined
    });
    setRunResumeContext(nextContext);
    writeRunResumeContext(nextContext);
    runStartedAtRef.current = Date.now();
    firstActionMeasuredRef.current = false;
    defeatAtRef.current = null;
  }, [
    clearWorldgenUiError,
    dispatchWithTrace,
    hubCapabilityPassivesEnabled,
    hubMovementRuntimeEnabled,
    reportWorldgenUiError,
    worldgenDebugEnabled,
    worldgenWorker
  ]);

  const handleCapabilityPassivesEnabledChange = useCallback((enabled: boolean) => {
    setHubCapabilityPassivesEnabled(enabled);
    setUiCapabilityRollout({ capabilityPassivesEnabled: enabled });
  }, []);

  const handleMovementRuntimeEnabledChange = useCallback((enabled: boolean) => {
    setHubMovementRuntimeEnabled(enabled);
    setUiCapabilityRollout({ movementRuntimeEnabled: enabled });
  }, []);

  const handleStartRun = (mode: 'normal' | 'daily') => {
    const id = gameState.selectedLoadoutId;
    if (!id) { console.warn('Start Run called without a selected loadout.'); return; }
    if (hubLoadoutSelectionAtRef.current !== null) {
      emitUiMetric('hub_select_to_start_ms', Date.now() - hubLoadoutSelectionAtRef.current, {
        mode,
        loadoutId: id
      });
      hubLoadoutSelectionAtRef.current = null;
    }
    startRun({
      loadoutId: id,
      mode,
      ...(mode === 'normal' ? {
        mapSize: hubMapSize,
        mapShape: hubMapShape,
        mapSizeInputMode: 'usable' as const
      } : {}),
      source: 'hub_start_run'
    });
  };

  const handleStartArcadeRun = (loadoutId: string) => {
    dispatchSensory({
      id: 'ui-brass-clink',
      intensity: 1.0,
      priority: 'low',
      context: 'hub'
    });
    startRun({
      loadoutId,
      mode: 'daily',
      source: 'arcade_start_run'
    });
    navigateTo(hubPath);
  };

  const handleEnterArcadeSplash = useCallback(() => {
    dispatchSensory({
      id: 'ui-danger-drum',
      intensity: 1.0,
      priority: 'high',
      context: 'hub'
    });
    if (worldgenRuntimeReady) {
      setArcadeSplashEntered(true);
      setArcadeSplashWaitingForReady(false);
      setShowArcadeDelayedPulse(false);
      return;
    }
    setArcadeSplashWaitingForReady(true);
  }, [dispatchSensory, worldgenRuntimeReady]);

  const handleOpenHubFromArcadeSplash = useCallback(() => {
    setArcadeSplashEntered(false);
    setArcadeSplashWaitingForReady(false);
    setShowArcadeDelayedPulse(false);
    navigateTo(hubPath);
  }, [hubPath, navigateTo]);

  const handleQuickRestart = useCallback(() => {
    const restartPayload = deriveQuickRestartStartRunPayload({
      context: runResumeContext,
      fallbackLoadoutId: gameState.player.archetype || gameState.selectedLoadoutId,
      fallbackDailyDate: gameState.dailyRunDate,
      seedFactory: () => String(Date.now())
    });

    if (!restartPayload) {
      handleExitToHub();
      return;
    }

    if (defeatAtRef.current !== null) {
      emitUiMetric('defeat_to_restart_ms', Date.now() - defeatAtRef.current, {
        mode: restartPayload.mode,
        loadoutId: restartPayload.loadoutId
      });
    }

    dispatchSensory({
      id: 'haptic-outcome-impact',
      intensity: 1.0,
      priority: 'high',
      context: 'run'
    });

    resetReplayUi();
    setSelectedSkillId(null);
    setSynapseMode(false);
    clearSynapseContext();
    startRun({
      loadoutId: restartPayload.loadoutId,
      mode: restartPayload.mode,
      seed: restartPayload.seed,
      date: restartPayload.date,
      mapSize: { width: gameState.gridWidth, height: gameState.gridHeight },
      mapShape: gameState.mapShape || DEFAULT_START_RUN_MAP_SHAPE,
      mapSizeInputMode: 'grid',
      source: 'quick_restart'
    });
  }, [
    clearSynapseContext,
    dispatchSensory,
    gameState.dailyRunDate,
    gameState.gridHeight,
    gameState.gridWidth,
    gameState.mapShape,
    gameState.player.archetype,
    gameState.selectedLoadoutId,
    handleExitToHub,
    resetReplayUi,
    runResumeContext,
    setSynapseMode,
    startRun
  ]);

  const handleViewReplay = useCallback(() => {
    const record = buildReplayRecordFromGameState(gameState);
    if (!record) return;
    dispatchSensory({
      id: 'ui-parchment-slide',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    startReplay(record);
  }, [dispatchSensory, gameState, startReplay]);

  const handleRunLostActionsReady = useCallback(() => {
    if (!defeatLoopV2Enabled) return;
    if (runLostOverlayActionReadyRef.current) return;
    if (defeatAtRef.current === null) return;
    runLostOverlayActionReadyRef.current = true;
    emitUiMetric('run_lost_overlay_to_action_ms', Date.now() - defeatAtRef.current);
  }, [defeatLoopV2Enabled]);

  useEffect(() => {
    if (gameState.gameStatus === 'lost') {
      if (defeatAtRef.current === null) {
        defeatAtRef.current = Date.now();
        dispatchSensory({
          id: 'haptic-threat-heavy',
          intensity: 1.0,
          priority: 'high',
          context: 'run'
        });
      }
      return;
    }
    if (gameState.gameStatus === 'hub') {
      defeatAtRef.current = null;
      runLostOverlayActionReadyRef.current = false;
      runStartedAtRef.current = null;
      firstActionMeasuredRef.current = false;
      return;
    }
    if (gameState.gameStatus === 'playing') {
      defeatAtRef.current = null;
      runLostOverlayActionReadyRef.current = false;
    }
  }, [dispatchSensory, gameState.gameStatus]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing' || isReplayMode) return;
    const loadoutId = gameState.player.archetype || runResumeContext?.lastLoadoutId;
    if (!loadoutId) return;
    const next = buildRunResumeContext({
      loadoutId,
      mode: gameState.dailyRunDate ? 'daily' : 'normal',
      dailyDate: gameState.dailyRunDate
    });
    if (
      runResumeContext?.lastLoadoutId === next.lastLoadoutId
      && runResumeContext?.lastRunMode === next.lastRunMode
      && runResumeContext?.lastDailyDate === next.lastDailyDate
    ) {
      return;
    }
    setRunResumeContext(next);
    writeRunResumeContext(next);
  }, [gameState.dailyRunDate, gameState.gameStatus, gameState.player.archetype, isReplayMode, runResumeContext]);

  if (isBiomesRoute) {
    return (
      <Suspense fallback={<AppScreenFallback label="Loading Sandbox..." />}>
        <LazyBiomeSandbox
          assetManifest={assetManifest}
          onBack={() => navigateTo(hubPath)}
        />
      </Suspense>
    );
  }

  if (isThemeLabRoute) {
    return (
      <Suspense fallback={<AppScreenFallback label="Loading Theme Lab..." />}>
        <LazyThemeManagerScreen
          uiPreferences={uiPreferences}
          onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
          onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
          onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
          onBack={() => navigateTo(hubPath)}
        />
      </Suspense>
    );
  }

  if (gameState.gameStatus === 'hub') {
    if (dedicatedHubRoutesEnabled && isSettingsRoute) {
      return (
        <Suspense fallback={<AppScreenFallback label="Loading Settings..." />}>
          <LazySettingsScreen
            uiPreferences={uiPreferences}
            onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
            onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
            onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      );
    }

    if (dedicatedHubRoutesEnabled && isLeaderboardRoute) {
      return (
        <Suspense fallback={<AppScreenFallback label="Loading Leaderboard..." />}>
          <LazyLeaderboardScreen
            gameState={gameState}
            onStartReplay={(record) => {
              dispatchSensory({
                id: 'ui-parchment-slide',
                intensity: 1.0,
                priority: 'low',
                context: 'hub'
              });
              startReplay(record);
            }}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      );
    }

    if (dedicatedHubRoutesEnabled && isTutorialsRoute) {
      return (
        <Suspense fallback={<AppScreenFallback label="Loading Tutorials..." />}>
          <LazyTutorialReplayScreen
            onLoadScenario={handleLoadScenario}
            onBack={() => navigateTo(hubPath)}
          />
        </Suspense>
      );
    }

    if (isArcadeRoute && !arcadeSplashEntered) {
      return (
        <>
          <ArcadeSplashGate
            canEnter={worldgenRuntimeReady}
            waitingForReady={arcadeSplashWaitingForReady}
            showDelayedPulse={showArcadeDelayedPulse}
            statusLine={worldgenProgressLabel}
            error={worldgenWorker.ready ? undefined : (worldgenUiError?.message || worldgenWorker.error)}
            onEnterArcade={handleEnterArcadeSplash}
            onOpenHub={handleOpenHubFromArcadeSplash}
          />
          <WorldgenErrorOverlay
            error={worldgenUiError}
            progressLabel={worldgenProgressLabel}
            onDismiss={clearWorldgenUiError}
          />
        </>
      );
    }

    return (
      <>
        <Suspense fallback={<AppScreenFallback label="Loading Hub..." />}>
          <LazyHubScreen
            gameState={gameState}
            isArcadeRoute={isArcadeRoute}
            hubPath={hubPath}
            arcadePath={arcadePath}
            biomesPath={biomesPath}
            themeLabPath={themeLabPath}
            settingsPath={settingsPath}
            leaderboardPath={leaderboardPath}
            tutorialsPath={tutorialsPath}
            replayError={replayError}
            tutorialInstructions={tutorialInstructions}
            uiPreferences={uiPreferences}
            dedicatedRoutesEnabled={dedicatedHubRoutesEnabled}
            navigateTo={navigateTo}
            onStartArcadeRun={handleStartArcadeRun}
            onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
            onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
            onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
            capabilityPassivesEnabled={hubCapabilityPassivesEnabled}
            onCapabilityPassivesEnabledChange={handleCapabilityPassivesEnabledChange}
            movementRuntimeEnabled={hubMovementRuntimeEnabled}
            onMovementRuntimeEnabledChange={handleMovementRuntimeEnabledChange}
            mapShape={hubMapShape}
            onMapShapeChange={setHubMapShape}
            mapSize={hubMapSize}
            onMapSizeChange={setHubMapSize}
            onSelectLoadout={(l) => {
              hubLoadoutSelectionAtRef.current = Date.now();
              dispatchWithTrace({ type: 'APPLY_LOADOUT', payload: l }, 'hub_select_loadout');
            }}
            onStartRun={handleStartRun}
            onLoadScenario={handleLoadScenario}
            onStartReplay={(record) => {
              dispatchSensory({
                id: 'ui-parchment-slide',
                intensity: 1.0,
                priority: 'low',
                context: 'hub'
              });
              startReplay(record);
            }}
            onDismissTutorial={() => setTutorialInstructions(null)}
          />
        </Suspense>
        <WorldgenErrorOverlay
          error={worldgenUiError}
          progressLabel={worldgenProgressLabel}
          onDismiss={clearWorldgenUiError}
        />
      </>
    );
  }
  return (
    <>
      <Suspense fallback={<AppScreenFallback label="Loading Run..." />}>
        <LazyGameScreen
          gameState={gameState}
          selectedSkillId={selectedSkillId}
          showMovementRange={showMovementRange}
          isInputLocked={isInputLocked}
          isReplayMode={isReplayMode}
          replayActionsLength={replayActions.length}
          replayIndex={replayIndexRef.current}
          replayActive={replayActive}
          mobileToasts={mobileToasts}
          tutorialInstructions={tutorialInstructions}
          floorIntro={floorIntro}
          assetManifest={assetManifest}
          uiPreferences={uiPreferences}
          onSetBoardBusy={setIsBusy}
          onTileClick={handleTileClick}
          onSimulationEvents={handleSimulationEvents}
          onMirrorSnapshot={handleUiMirrorSnapshot}
          onReset={handleReset}
          onWait={handleWait}
          onExitToHub={handleExitToHub}
          onSelectSkill={handleSelectSkill}
          onSelectUpgrade={handleSelectUpgrade}
          isSynapseMode={isSynapseMode}
          synapseSelection={synapseSelection}
          synapsePulse={synapsePulse}
          onToggleSynapseMode={toggleSynapseMode}
          onSynapseInspectEntity={handleSynapseInspectEntity}
          onSynapseSelectSource={handleSynapseInspectEntity}
          onSynapseClearSelection={clearSynapseContext}
          onDismissTutorial={() => setTutorialInstructions(null)}
          onToggleReplay={() => {
            dispatchSensory({
              id: 'ui-parchment-slide',
              intensity: 1.0,
              priority: 'low',
              context: 'run'
            });
            setReplayActive(!replayActive);
          }}
          onStepReplay={stepReplay}
          onJumpReplay={goToReplayIndex}
          replayMarkerIndices={replayMarkerIndices}
          onCloseReplay={stopReplay}
          onQuickRestart={handleQuickRestart}
          onViewReplay={handleViewReplay}
          onRunLostActionsReady={handleRunLostActionsReady}
          onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
          mobileDockV2Enabled={mobileDockV2Enabled}
          replayChronicleEnabled={defeatLoopV2Enabled}
        />
      </Suspense>
        <WorldgenErrorOverlay
          error={worldgenUiError}
          progressLabel={worldgenProgressLabel}
          onDismiss={clearWorldgenUiError}
          onRetry={worldgenUiError?.kind === 'stairs' ? pendingFloorWorldgen.retryPendingFloor : undefined}
          onExitToHub={worldgenUiError?.kind === 'stairs' ? handleExitToHub : undefined}
        />
    </>
  );
}

export default App;

