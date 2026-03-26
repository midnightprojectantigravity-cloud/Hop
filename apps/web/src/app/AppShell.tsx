import { useRef, useState, useCallback, useEffect } from 'react';
import type { Action } from '@hop/engine';
import { ENGINE_CONTRACT_VERSION } from '../../../../packages/engine/src/contract-version';
import { useAssetManifest } from './use-asset-manifest';
import { useDebugPerfLogger } from './use-debug-perf-logger';
import { useDebugQueryBridge } from './use-debug-query-bridge';
import { useFloorIntro } from './use-floor-intro';
import { usePersistedGameState } from './use-persisted-game-state';
import { useWorldgenWorker } from './use-worldgen-worker';
import { useSimulationFeedback } from './use-simulation-feedback';
import { useTurnFlowCoordinator } from './use-turn-flow-coordinator';
import { useTurnDriverTrace } from './use-turn-driver-trace';
import { setUiCapabilityRollout } from './capability-rollout';
import { emitUiMetric } from './ui-telemetry';
import { dispatchSensoryEvent } from './sensory-dispatcher';
import { resolveMeaningfulActionType, shouldArmAutoEndForAction } from './turn-flow-policy';
import { readRunResumeContext, type RunResumeContext } from './run-resume-context';
import { buildReplayRecordFromGameState, useRunRecording } from './use-run-recording';
import { useAppSession } from './use-app-session';
import { useGameScreenModel } from './use-game-screen-model';
import { useHubSession } from './use-hub-session';
import { useReplaySession } from './use-replay-session';
import { isReplayStepBlocked } from './use-replay-controller';
import { useRunSession } from './use-run-session';
import { useBootSession } from './use-boot-session';
import { useTutorialSession } from './use-tutorial-session';
import { useWorldgenSession } from './use-worldgen-session';
import { useRunController } from './use-run-controller';
import { useRoutePrefetch } from './use-route-prefetch';
import { UtilityRouteShell } from './UtilityRouteShell';
import { HubRouteShell } from './HubRouteShell';
import { RunRouteShell } from './RunRouteShell';
import { AppBootOverlay } from './AppBootOverlay';
import splashPlaceholderImage from '../assets/ui/splash-placeholder.webp';

const summarizeActionPayload = (action: Action): Record<string, unknown> | undefined => {
  const payload = (action as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object') return undefined;

  const record = payload as Record<string, unknown>;

  if ('q' in record && 'r' in record) {
    return {
      q: Number(record.q ?? 0),
      r: Number(record.r ?? 0),
      s: Number(record.s ?? 0)
    };
  }

  if ((action as { type?: string }).type === 'USE_SKILL') {
    return {
      skillId: record.skillId ?? 'unknown',
      target: record.target && typeof record.target === 'object'
        ? {
            q: (record.target as Record<string, unknown>).q,
            r: (record.target as Record<string, unknown>).r,
            s: (record.target as Record<string, unknown>).s
          }
        : null
    };
  }

  if ((action as { type?: string }).type === 'START_RUN') {
    return {
      loadoutId: record.loadoutId ?? 'unknown',
      mode: record.mode ?? 'normal'
    };
  }

  if ((action as { type?: string }).type === 'LOAD_STATE') {
    return {
      floor: record.floor ?? 0,
      gameStatus: record.gameStatus ?? 'unknown',
      turnNumber: record.turnNumber ?? 0,
      queueLength: Array.isArray(record.initiativeQueue) ? record.initiativeQueue.length : 0
    };
  }

  return {};
};

export function AppShell() {
  const {
    uiPreferences,
    patchUiPreferences,
    pathname,
    homePath,
    hubPath,
    biomesPath,
    themeLabPath,
    settingsPath,
    leaderboardPath,
    tutorialsPath,
    isHubRoute,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isSettingsRoute,
    isLeaderboardRoute,
    isTutorialsRoute,
    navigateTo,
    featureFlags
  } = useAppSession();
  const mobileDockV2Enabled = featureFlags.ui_mobile_dock_v2;
  const defeatLoopV2Enabled = featureFlags.ui_defeat_loop_v2;
  const sensoryDispatcherEnabled = featureFlags.ui_sensory_dispatcher_v1;
  const dedicatedHubRoutesEnabled = featureFlags.ui_dedicated_hub_routes_v1;
  const strictTargetPathParityV1Enabled = featureFlags.strict_target_path_parity_v1 || import.meta.env.MODE === 'test';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.uiMaterial = 'v2';
  }, []);

  useEffect(() => {
    if (typeof ENGINE_CONTRACT_VERSION !== 'string' || ENGINE_CONTRACT_VERSION.length === 0) {
      throw new Error('Missing @hop/engine contract version.');
    }
  }, []);

  const [gameState, dispatch] = usePersistedGameState();
  const assetManifest = useAssetManifest();
  const worldgenWorker = useWorldgenWorker();
  const [runResumeContext, setRunResumeContext] = useState<RunResumeContext | null>(() => readRunResumeContext());
  const hubLoadoutSelectionAtRef = useRef<number | null>(null);

  const isDebugQueryEnabled = typeof window !== 'undefined' && Boolean((window as Window & {
    __HOP_DEBUG_QUERY?: unknown;
  }).__HOP_DEBUG_QUERY);
  useDebugQueryBridge(gameState, isDebugQueryEnabled);

  const worldgenDebugEnabled = typeof window !== 'undefined'
    && import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('worldgenDebug') === '1';

  const dispatchWithTraceProxyRef = useRef<(action: Action, source: string) => void>(() => {});
  const replayStepBlockedRef = useRef(false);
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
    goToReplayIndex,
    replayMarkerIndices
  } = useReplaySession({
    dispatchReplayAction,
    isReplayStepBlocked: () => replayStepBlockedRef.current
  });

  useDebugPerfLogger([gameState.gameStatus, isReplayMode]);

  const dispatchSensory = useCallback((payload: Parameters<typeof dispatchSensoryEvent>[0]) => {
    if (!sensoryDispatcherEnabled) return;
    dispatchSensoryEvent(payload);
  }, [sensoryDispatcherEnabled]);

  const {
    selectedSkillId,
    setSelectedSkillId,
    showMovementRange,
    setShowMovementRange,
    isBusy,
    setIsBusy,
    runLostOverlayDelayElapsed,
    setRunLostOverlayDelayElapsed,
    postCommitInputLock,
    setPostCommitInputLock,
    overdriveState,
    setOverdriveState,
    pendingAutoEnd,
    setPendingAutoEnd,
    isSynapseMode,
    setIsSynapseMode,
    synapseSelection,
    setSynapseSelection,
    synapsePulse,
    setSynapsePulse
  } = useRunSession();

  const {
    hubCapabilityPassivesEnabled,
    setHubCapabilityPassivesEnabled,
    hubMovementRuntimeEnabled,
    setHubMovementRuntimeEnabled,
    hubMapShape,
    setHubMapShape,
    hubMapSize,
    setHubMapSize
  } = useHubSession();

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

  const { mobileToasts, handleSimulationEvents, handleUiMirrorSnapshot } = useSimulationFeedback({
    gameState,
    appendTurnTrace
  });

  const floorIntro = useFloorIntro(gameState);
  useRunRecording(gameState, isReplayMode);

  const bootSession = useBootSession({
    assetManifestReady: Boolean(assetManifest),
    motionMode: uiPreferences.motionMode,
    dispatchSensory: (payload) => dispatchSensory(payload)
  });

  const tutorialSession = useTutorialSession({
    gameStatus: gameState.gameStatus,
    homePath,
    navigateTo,
    dispatchWithTrace
  });

  useEffect(() => {
    setOverdriveState('idle');
    setPendingAutoEnd(null);
  }, [gameState.turnNumber, setOverdriveState, setPendingAutoEnd]);

  useEffect(() => {
    if (uiPreferences.turnFlowMode === 'protected_single') return;
    setOverdriveState('idle');
    setPendingAutoEnd(null);
  }, [setOverdriveState, setPendingAutoEnd, uiPreferences.turnFlowMode]);

  useEffect(() => {
    if (gameState.gameStatus === 'playing' && !isReplayMode) return;
    setOverdriveState('idle');
    setPendingAutoEnd(null);
  }, [gameState.gameStatus, isReplayMode, setOverdriveState, setPendingAutoEnd]);

  useEffect(() => {
    if (!gameState.pendingStatus && (gameState.pendingFrames?.length ?? 0) === 0) return;
    setOverdriveState('idle');
    setPendingAutoEnd(null);
  }, [gameState.pendingFrames, gameState.pendingStatus, setOverdriveState, setPendingAutoEnd]);

  const toggleOverdrive = useCallback(() => {
    if (uiPreferences.turnFlowMode !== 'protected_single') return;
    setPendingAutoEnd(null);
    setOverdriveState((current) => current === 'armed' ? 'idle' : 'armed');
  }, [setOverdriveState, setPendingAutoEnd, uiPreferences.turnFlowMode]);

  const runStartedProxyRef = useRef<() => void>(() => {});

  const worldgenSession = useWorldgenSession({
    gameState,
    worldgenWorker,
    worldgenDebugEnabled,
    dispatchWithTrace,
    hubCapabilityPassivesEnabled,
    hubMovementRuntimeEnabled,
    setRunResumeContext,
    dispatchSensory,
    navigateTo,
    hubPath,
    isArcadeRoute,
    onRunStarted: () => runStartedProxyRef.current()
  });
  replayStepBlockedRef.current = isReplayStepBlocked({
    isBusy,
    pendingFloorPhase: worldgenSession.pendingFloorWorldgen.state.phase
  });

  const turnFlowCoordinator = useTurnFlowCoordinator({
    gameState,
    turnDriver,
    isBusy,
    isReplayMode,
    postCommitInputLock,
    setPostCommitInputLock,
    pendingAutoEnd,
    setPendingAutoEnd,
    appendTurnTrace,
    dispatchWithTrace,
    resolvePendingFloor: worldgenSession.pendingFloorWorldgen.resolvePendingFloor
  });
  const { armPostCommitLock } = turnFlowCoordinator;

  const dispatchPlayerActionWithTurnPolicy = useCallback((action: Action, source: string) => {
    const meaningfulActionType = resolveMeaningfulActionType(action);
    if (shouldArmAutoEndForAction({
      turnFlowMode: uiPreferences.turnFlowMode,
      overdriveState,
      action
    }) && meaningfulActionType) {
      setPendingAutoEnd({
        armedOnTurn: gameState.turnNumber,
        expectedActionLogLength: (gameState.actionLog?.length ?? 0) + 1,
        sourceActionType: meaningfulActionType
      });
    } else if (meaningfulActionType) {
      setPendingAutoEnd(null);
    }

    armPostCommitLock();
    dispatchWithTrace(action, source);
  }, [
    armPostCommitLock,
    dispatchWithTrace,
    gameState.actionLog,
    gameState.turnNumber,
    overdriveState,
    setPendingAutoEnd,
    uiPreferences.turnFlowMode
  ]);

  const runController = useRunController({
    gameState,
    isReplayMode,
    isInputLocked,
    isBusy,
    replayActive,
    setReplayActive,
    stepReplay,
    goToReplayIndex,
    resetReplayUi,
    startReplay,
    dispatchWithTrace,
    dispatchPlayerActionWithTurnPolicy,
    armPostCommitLock,
    dispatchSensory,
    navigateTo,
    homePath,
    defeatLoopV2Enabled,
    runResumeContext,
    setRunResumeContext,
    startRun: worldgenSession.startRun,
    activeTutorialStepId: tutorialSession.activeTutorialStepId,
    finishGuidedTutorialStep: tutorialSession.finishGuidedTutorialStep,
    dismissTutorialInstructions: tutorialSession.dismissTutorialInstructions,
    showTutorialInstructions: tutorialSession.showTutorialInstructions,
    selectedSkillId,
    setSelectedSkillId,
    showMovementRange,
    setShowMovementRange,
    setRunLostOverlayDelayElapsed,
    runLostOverlayDelayElapsed,
    setPendingAutoEnd: () => setPendingAutoEnd(null),
    setOverdriveState: () => setOverdriveState('idle'),
    isSynapseMode,
    setIsSynapseMode,
    setSynapseSelection,
    setSynapsePulse,
    setIsBusy,
    toggleOverdrive
  });

  runStartedProxyRef.current = runController.onRunStarted;

  useRoutePrefetch({
    dedicatedHubRoutesEnabled,
    gameStatus: gameState.gameStatus,
    isArcadeRoute,
    isBiomesRoute,
    isThemeLabRoute,
    isLeaderboardRoute,
    isSettingsRoute,
    isTutorialsRoute
  });

  useEffect(() => {
    const normalizedPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const normalizedHomePath = homePath.toLowerCase().replace(/\/+$/, '') || '/';
    const normalizedHubPath = hubPath.toLowerCase().replace(/\/+$/, '') || '/';
    const isKnownRoute =
      normalizedPath === normalizedHomePath
      || normalizedPath === normalizedHubPath
      || isHubRoute
      || isArcadeRoute
      || isBiomesRoute
      || isThemeLabRoute
      || (dedicatedHubRoutesEnabled && isSettingsRoute)
      || (dedicatedHubRoutesEnabled && isLeaderboardRoute)
      || (dedicatedHubRoutesEnabled && isTutorialsRoute);
    if (isKnownRoute) return;
    console.warn('[HOP_UI] Unknown route, redirecting to home', { pathname });
    navigateTo(homePath);
  }, [
    dedicatedHubRoutesEnabled,
    homePath,
    hubPath,
    isHubRoute,
    isArcadeRoute,
    isBiomesRoute,
    isLeaderboardRoute,
    isSettingsRoute,
    isThemeLabRoute,
    isTutorialsRoute,
    navigateTo,
    pathname
  ]);

  const handleCapabilityPassivesEnabledChange = useCallback((enabled: boolean) => {
    setHubCapabilityPassivesEnabled(enabled);
    setUiCapabilityRollout({ capabilityPassivesEnabled: enabled });
  }, [setHubCapabilityPassivesEnabled]);

  const handleMovementRuntimeEnabledChange = useCallback((enabled: boolean) => {
    setHubMovementRuntimeEnabled(enabled);
    setUiCapabilityRollout({ movementRuntimeEnabled: enabled });
  }, [setHubMovementRuntimeEnabled]);

  const handleStartRun = useCallback((mode: 'normal' | 'daily') => {
    const loadoutId = gameState.selectedLoadoutId;
    if (!loadoutId) {
      console.warn('Start Run called without a selected loadout.');
      return;
    }
    if (hubLoadoutSelectionAtRef.current !== null) {
      emitUiMetric('hub_select_to_start_ms', Date.now() - hubLoadoutSelectionAtRef.current, {
        mode,
        loadoutId
      });
      hubLoadoutSelectionAtRef.current = null;
    }
    void worldgenSession.startRun({
      loadoutId,
      mode,
      ...(mode === 'normal' ? {
        mapSize: hubMapSize,
        mapShape: hubMapShape,
        mapSizeInputMode: 'usable' as const
      } : {}),
      source: 'hub_start_run'
    });
  }, [gameState.selectedLoadoutId, hubMapShape, hubMapSize, worldgenSession]);

  const handleHubReplayStart = useCallback((record: ReturnType<typeof buildReplayRecordFromGameState>) => {
    if (!record) return;
    dispatchSensory({
      id: 'ui-parchment-slide',
      intensity: 1.0,
      priority: 'low',
      context: 'hub'
    });
    startReplay(record);
  }, [dispatchSensory, startReplay]);

  const bootOverlay = bootSession.showBootOverlay
    ? (
      <AppBootOverlay
        bootState={bootSession.bootState}
        motionMode={uiPreferences.motionMode}
        splashImage={splashPlaceholderImage}
      />
    )
    : null;

  const gameScreenModel = useGameScreenModel({
    run: {
      gameState,
      selectedSkillId,
      showMovementRange,
      isInputLocked,
      isReplayMode,
      replayActionsLength: replayActions.length,
      replayIndex: replayIndexRef.current,
      replayActive,
      mobileToasts,
      tutorialInstructions: tutorialSession.tutorialInstructions,
      floorIntro,
      assetManifest,
      isSynapseMode,
      synapseSelection,
      synapsePulse,
      showRunLostOverlay: runController.showRunLostOverlay
    },
    ui: {
      uiPreferences,
      turnFlowMode: uiPreferences.turnFlowMode,
      overdriveArmed: overdriveState === 'armed',
      replayMarkerIndices,
      mobileDockV2Enabled,
      replayChronicleEnabled: defeatLoopV2Enabled,
      strictTargetPathParityV1Enabled
    },
    actions: {
      ...runController.actions,
      onSimulationEvents: handleSimulationEvents,
      onMirrorSnapshot: handleUiMirrorSnapshot,
      onSetColorMode: (colorMode) => patchUiPreferences({ colorMode }),
      onSetVitalsMode: (vitalsMode) => patchUiPreferences({ vitalsMode })
    }
  });

  if (isBiomesRoute || isThemeLabRoute) {
    return (
      <>
        {bootOverlay}
        <UtilityRouteShell
          assetManifest={assetManifest}
          uiPreferences={uiPreferences}
          isBiomesRoute={isBiomesRoute}
          isThemeLabRoute={isThemeLabRoute}
          hubPath={hubPath}
          navigateTo={navigateTo}
          patchUiPreferences={patchUiPreferences}
        />
      </>
    );
  }

  if (gameState.gameStatus === 'hub') {
    return (
      <>
        {bootOverlay}
        <HubRouteShell
          gameState={gameState}
          homePath={homePath}
          isHubRoute={isHubRoute}
          isArcadeRoute={isArcadeRoute}
          isSettingsRoute={isSettingsRoute}
          isLeaderboardRoute={isLeaderboardRoute}
          isTutorialsRoute={isTutorialsRoute}
          hubPath={hubPath}
          biomesPath={biomesPath}
          themeLabPath={themeLabPath}
          settingsPath={settingsPath}
          leaderboardPath={leaderboardPath}
          tutorialsPath={tutorialsPath}
          replayError={replayError}
          tutorialInstructions={tutorialSession.tutorialInstructions}
          uiPreferences={uiPreferences}
          dedicatedRoutesEnabled={dedicatedHubRoutesEnabled}
          navigateTo={navigateTo}
          patchUiPreferences={patchUiPreferences}
          capabilityPassivesEnabled={hubCapabilityPassivesEnabled}
          onCapabilityPassivesEnabledChange={handleCapabilityPassivesEnabledChange}
          movementRuntimeEnabled={hubMovementRuntimeEnabled}
          onMovementRuntimeEnabledChange={handleMovementRuntimeEnabledChange}
          mapShape={hubMapShape}
          onMapShapeChange={setHubMapShape}
          mapSize={hubMapSize}
          onMapSizeChange={setHubMapSize}
          onSelectLoadout={(loadout) => {
            hubLoadoutSelectionAtRef.current = Date.now();
            dispatchWithTrace({ type: 'APPLY_LOADOUT', payload: loadout }, 'hub_select_loadout');
          }}
          onStartRun={handleStartRun}
          onLoadScenario={runController.handleLoadScenario}
          onStartReplay={handleHubReplayStart}
          onDismissTutorial={tutorialSession.dismissTutorialInstructions}
          onStartGuidedTutorial={tutorialSession.startGuidedTutorial}
          tutorialProgress={tutorialSession.tutorialProgress}
          activeTutorialSession={tutorialSession.activeTutorialSession}
          onResetTutorialProgress={tutorialSession.resetGuidedTutorialProgress}
          onSkipTutorial={tutorialSession.skipGuidedTutorial}
          worldgenUiError={worldgenSession.worldgenUiError}
          worldgenProgressLabel={worldgenSession.worldgenProgressLabel}
          worldgenStatusLine={worldgenSession.worldgenStatusLine}
          onDismissWorldgenError={worldgenSession.clearWorldgenUiError}
          worldgenInitialized={worldgenSession.worldgenInitialized}
          worldgenWarmState={worldgenSession.worldgenWarmState}
          arcadeSplashWaitingForReady={worldgenSession.arcadeSplashWaitingForReady}
          showArcadeDelayedPulse={worldgenSession.showArcadeDelayedPulse}
          onEnterArcadeSplash={worldgenSession.handleEnterArcadeSplash}
          onOpenHubFromArcadeSplash={worldgenSession.handleOpenHubFromArcadeSplash}
        />
      </>
    );
  }

  return (
    <>
      {bootOverlay}
      <RunRouteShell
        motionMode={uiPreferences.motionMode}
        gameState={gameState}
        gameScreenModel={gameScreenModel}
        activeTutorialStep={tutorialSession.activeTutorialStep as {
          id: 'movement' | 'attack' | 'wait';
          title: string;
          body: string;
          allowedActionLabel: string;
        } | null}
        activeTutorialSession={tutorialSession.activeTutorialSession}
        onSkipTutorial={tutorialSession.skipGuidedTutorial}
        worldgenUiError={worldgenSession.worldgenUiError}
        worldgenProgressLabel={worldgenSession.worldgenProgressLabel}
        onDismissWorldgenError={worldgenSession.clearWorldgenUiError}
        onRetryPendingFloor={worldgenSession.pendingFloorWorldgen.retryPendingFloor}
        onExitToHub={runController.actions.onExitToHub}
      />
    </>
  );
}

export default AppShell;
