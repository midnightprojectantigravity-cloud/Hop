import { useRef, useState, useCallback, useEffect, Suspense } from 'react';
import { hexEquals } from '@hop/engine';
import type { Point, Action, GameState } from '@hop/engine';
import { useAssetManifest } from './app/use-asset-manifest';
import { useDebugPerfLogger } from './app/use-debug-perf-logger';
import { useDebugQueryBridge } from './app/use-debug-query-bridge';
import { useFloorIntro } from './app/use-floor-intro';
import { usePersistedGameState } from './app/use-persisted-game-state';
import { useReplayController } from './app/use-replay-controller';
import { buildReplayRecordFromGameState, useRunRecording } from './app/use-run-recording';
import { useSimulationFeedback } from './app/use-simulation-feedback';
import { useTurnFlowCoordinator } from './app/use-turn-flow-coordinator';
import { useTurnDriverTrace } from './app/use-turn-driver-trace';
import { useAppRouting } from './app/use-app-routing';
import { buildStartRunPayload } from './app/start-run-overrides';
import { getUiCapabilityRollout, setUiCapabilityRollout } from './app/capability-rollout';
import { emitUiMetric } from './app/ui-telemetry';
import { useUiPreferences } from './app/ui-preferences';
import {
  LazyBiomeSandbox,
  LazyGameScreen,
  LazyHubScreen,
  prefetchBiomeSandbox,
  prefetchGameScreen,
  prefetchHubScreen
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

const AppScreenFallback = ({ label }: { label: string }) => (
  <div className="w-screen h-screen flex items-center justify-center bg-[var(--surface-app)] text-[var(--text-muted)] text-xs font-black uppercase tracking-[0.28em]">
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

function App() {
  const { preferences: uiPreferences, patchPreferences: patchUiPreferences } = useUiPreferences();
  const {
    hubPath,
    arcadePath,
    biomesPath,
    isArcadeRoute,
    isBiomesRoute,
    navigateTo
  } = useAppRouting();

  const [gameState, dispatch] = usePersistedGameState();
  const [runResumeContext, setRunResumeContext] = useState<RunResumeContext | null>(() => readRunResumeContext());
  const hubLoadoutSelectionAtRef = useRef<number | null>(null);
  const runStartedAtRef = useRef<number | null>(null);
  const firstActionMeasuredRef = useRef(false);
  const defeatAtRef = useRef<number | null>(null);

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
    stepReplay
  } = useReplayController({ dispatchWithTrace: dispatchReplayAction });
  useDebugPerfLogger([gameState.gameStatus, isReplayMode]);

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
  const { armPostCommitLock } = useTurnFlowCoordinator({
    gameState,
    turnDriver,
    isBusy,
    isReplayMode,
    postCommitInputLock,
    setPostCommitInputLock,
    appendTurnTrace,
    dispatchWithTrace
  });

  const [tutorialInstructions, setTutorialInstructions] = useState<string | null>(null);
  const floorIntro = useFloorIntro(gameState);
  useRunRecording(gameState, isReplayMode);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let cancelled = false;

    const runPrefetch = () => {
      if (cancelled) return;

      if (isBiomesRoute) {
        void prefetchHubScreen();
        void prefetchGameScreen();
        return;
      }

      if (gameState.gameStatus === 'hub') {
        void prefetchGameScreen();
        if (!isArcadeRoute) {
          void prefetchBiomeSandbox();
        }
        return;
      }

      void prefetchHubScreen();
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
  }, [gameState.gameStatus, isArcadeRoute, isBiomesRoute]);

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
    armPostCommitLock();
    dispatchWithTrace({ type: 'WAIT' }, 'player_wait');
    setSelectedSkillId(null);
  };

  const stopReplay = () => {
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

  const startRun = useCallback((params: {
    loadoutId: string;
    mode: 'normal' | 'daily';
    source: string;
    seed?: string;
    date?: string;
  }) => {
    const payload = buildStartRunPayload({
      loadoutId: params.loadoutId,
      mode: params.mode,
      seed: params.seed,
      date: params.date,
      capabilityPassivesEnabled: hubCapabilityPassivesEnabled,
      movementRuntimeEnabled: hubMovementRuntimeEnabled
    });
    dispatchWithTrace({ type: 'START_RUN', payload }, params.source);
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
  }, [dispatchWithTrace, hubCapabilityPassivesEnabled, hubMovementRuntimeEnabled]);

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
      source: 'hub_start_run'
    });
  };

  const handleStartArcadeRun = (loadoutId: string) => {
    startRun({
      loadoutId,
      mode: 'daily',
      source: 'arcade_start_run'
    });
    navigateTo(hubPath);
  };

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

    resetReplayUi();
    setSelectedSkillId(null);
    setSynapseMode(false);
    clearSynapseContext();
    startRun({
      loadoutId: restartPayload.loadoutId,
      mode: restartPayload.mode,
      seed: restartPayload.seed,
      date: restartPayload.date,
      source: 'quick_restart'
    });
  }, [
    clearSynapseContext,
    gameState.dailyRunDate,
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
    startReplay(record);
  }, [gameState, startReplay]);

  useEffect(() => {
    if (gameState.gameStatus === 'lost') {
      if (defeatAtRef.current === null) defeatAtRef.current = Date.now();
      return;
    }
    if (gameState.gameStatus === 'hub') {
      defeatAtRef.current = null;
      runStartedAtRef.current = null;
      firstActionMeasuredRef.current = false;
      return;
    }
    if (gameState.gameStatus === 'playing') {
      defeatAtRef.current = null;
    }
  }, [gameState.gameStatus]);

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

  if (gameState.gameStatus === 'hub') {
    return (
      <Suspense fallback={<AppScreenFallback label="Loading Hub..." />}>
        <LazyHubScreen
          gameState={gameState}
          isArcadeRoute={isArcadeRoute}
          hubPath={hubPath}
          arcadePath={arcadePath}
          biomesPath={biomesPath}
          replayError={replayError}
          tutorialInstructions={tutorialInstructions}
          uiPreferences={uiPreferences}
          navigateTo={navigateTo}
          onStartArcadeRun={handleStartArcadeRun}
          onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
          onSetMotionMode={(motionMode) => patchUiPreferences({ motionMode })}
          onSetHudDensity={(hudDensity) => patchUiPreferences({ hudDensity })}
          capabilityPassivesEnabled={hubCapabilityPassivesEnabled}
          onCapabilityPassivesEnabledChange={handleCapabilityPassivesEnabledChange}
          movementRuntimeEnabled={hubMovementRuntimeEnabled}
          onMovementRuntimeEnabledChange={handleMovementRuntimeEnabledChange}
          onSelectLoadout={(l) => {
            hubLoadoutSelectionAtRef.current = Date.now();
            dispatchWithTrace({ type: 'APPLY_LOADOUT', payload: l }, 'hub_select_loadout');
          }}
          onStartRun={handleStartRun}
          onLoadScenario={handleLoadScenario}
          onStartReplay={startReplay}
          onDismissTutorial={() => setTutorialInstructions(null)}
        />
      </Suspense>
    );
  }
  return (
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
        onToggleReplay={() => setReplayActive(!replayActive)}
        onStepReplay={stepReplay}
        onCloseReplay={stopReplay}
        onQuickRestart={handleQuickRestart}
        onViewReplay={handleViewReplay}
        onSetColorMode={(colorMode) => patchUiPreferences({ colorMode })}
      />
    </Suspense>
  );
}

export default App;

