
import { useRef, useState, useCallback } from 'react';
import { hexEquals } from '@hop/engine';
import type { Point, Action, GameState } from '@hop/engine';
import { BiomeSandbox } from './components/BiomeSandbox';
import { useAssetManifest } from './app/use-asset-manifest';
import { useDebugPerfLogger } from './app/use-debug-perf-logger';
import { useDebugQueryBridge } from './app/use-debug-query-bridge';
import { useFloorIntro } from './app/use-floor-intro';
import { usePersistedGameState } from './app/use-persisted-game-state';
import { useReplayController } from './app/use-replay-controller';
import { useRunRecording } from './app/use-run-recording';
import { useSimulationFeedback } from './app/use-simulation-feedback';
import { useTurnFlowCoordinator } from './app/use-turn-flow-coordinator';
import { useTurnDriverTrace } from './app/use-turn-driver-trace';
import { useAppRouting } from './app/use-app-routing';
import { HubScreen } from './app/HubScreen';
import { GameScreen } from './app/GameScreen';

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
  const {
    hubPath,
    arcadePath,
    biomesPath,
    isArcadeRoute,
    isBiomesRoute,
    navigateTo
  } = useAppRouting();

  // packages/web/src/App.tsx

  const [gameState, dispatch] = usePersistedGameState();

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

  const handleSelectSkill = (skillId: string | null) => {
    if (isInputLocked) return;
    setSelectedSkillId(skillId);
  };

  const handleTileClick = (target: Point) => {
    if (isInputLocked) return;
    if (selectedSkillId) {
      armPostCommitLock();
      dispatchWithTrace({ type: 'USE_SKILL', payload: { skillId: selectedSkillId, target } }, 'player_use_skill');
      setSelectedSkillId(null);
      return;
    }
    if (hexEquals(target, gameState.player.position)) {
      setShowMovementRange(!showMovementRange);
      return;
    }
    armPostCommitLock();
    dispatchWithTrace({ type: 'MOVE', payload: target }, 'player_move');
    setShowMovementRange(false);
  };

  const handleSelectUpgrade = (upgrade: string) => {
    if (isReplayMode || isBusy) return;
    dispatchWithTrace({ type: 'SELECT_UPGRADE', payload: upgrade }, 'upgrade_select');
  };

  const handleReset = () => { dispatchWithTrace({ type: 'RESET' }, 'reset'); setSelectedSkillId(null); resetReplayUi(); };
  const handleWait = () => {
    if (isInputLocked) return;
    armPostCommitLock();
    dispatchWithTrace({ type: 'WAIT' }, 'player_wait');
    setSelectedSkillId(null);
  };

  const stopReplay = () => {
    handleExitToHub();
  };

  const handleLoadScenario = (state: GameState, instructions: string) => { dispatchWithTrace({ type: 'LOAD_STATE', payload: state }, 'scenario_load'); setTutorialInstructions(instructions); setSelectedSkillId(null); };

  const handleExitToHub = () => { dispatchWithTrace({ type: 'EXIT_TO_HUB' }, 'exit_to_hub'); setSelectedSkillId(null); resetReplayUi(); navigateTo(hubPath); };

  const handleStartRun = (mode: 'normal' | 'daily') => {
    const id = gameState.selectedLoadoutId;
    if (!id) { console.warn('Start Run called without a selected loadout.'); return; }
    dispatchWithTrace({ type: 'START_RUN', payload: { loadoutId: id, mode } }, 'hub_start_run');
  };

  const handleStartArcadeRun = (loadoutId: string) => {
    dispatchWithTrace({ type: 'START_RUN', payload: { loadoutId, mode: 'daily' } }, 'arcade_start_run');
    navigateTo(hubPath);
  };

  if (isBiomesRoute) {
    return (
      <BiomeSandbox
        assetManifest={assetManifest}
        onBack={() => navigateTo(hubPath)}
      />
    );
  }

  if (gameState.gameStatus === 'hub') {
    return (
      <HubScreen
        gameState={gameState}
        isArcadeRoute={isArcadeRoute}
        hubPath={hubPath}
        arcadePath={arcadePath}
        biomesPath={biomesPath}
        replayError={replayError}
        tutorialInstructions={tutorialInstructions}
        navigateTo={navigateTo}
        onStartArcadeRun={handleStartArcadeRun}
        onSelectLoadout={(l) => {
          dispatchWithTrace({ type: 'APPLY_LOADOUT', payload: l }, 'hub_select_loadout');
        }}
        onStartRun={handleStartRun}
        onLoadScenario={handleLoadScenario}
        onStartReplay={startReplay}
        onDismissTutorial={() => setTutorialInstructions(null)}
      />
    );
  }
  return (
    <GameScreen
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
      onSetBoardBusy={setIsBusy}
      onTileClick={handleTileClick}
      onSimulationEvents={handleSimulationEvents}
      onMirrorSnapshot={handleUiMirrorSnapshot}
      onReset={handleReset}
      onWait={handleWait}
      onExitToHub={handleExitToHub}
      onSelectSkill={handleSelectSkill}
      onSelectUpgrade={handleSelectUpgrade}
      onDismissTutorial={() => setTutorialInstructions(null)}
      onToggleReplay={() => setReplayActive(!replayActive)}
      onStepReplay={stepReplay}
      onCloseReplay={stopReplay}
    />
  );
}

export default App;

