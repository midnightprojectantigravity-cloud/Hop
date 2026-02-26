
import { useRef, useState, useEffect, useCallback } from 'react';
import { hexEquals, validateReplayActions } from '@hop/engine';
import type { Point, Action, GameState } from '@hop/engine';
import type { ReplayRecord } from './components/ReplayManager';
import { BiomeSandbox } from './components/BiomeSandbox';
import { buildReplayDiagnostics } from './app/replay-diagnostics';
import { useAssetManifest } from './app/use-asset-manifest';
import { useDebugPerfLogger } from './app/use-debug-perf-logger';
import { useDebugQueryBridge } from './app/use-debug-query-bridge';
import { usePersistedGameState } from './app/use-persisted-game-state';
import { useReplayController } from './app/use-replay-controller';
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
  const lastRecordedRunRef = useRef<string | null>(null);
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
  const [floorIntro, setFloorIntro] = useState<{ floor: number; theme: string } | null>(null);

  // Trigger floor intro on floor change
  const lastFloorRef = useRef(gameState.floor);
  useEffect(() => {
    if (gameState.gameStatus === 'playing' && gameState.floor !== lastFloorRef.current) {
      setFloorIntro({ floor: gameState.floor, theme: gameState.theme || 'Inferno' });
      lastFloorRef.current = gameState.floor;
      const timer = setTimeout(() => setFloorIntro(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.floor, gameState.gameStatus, gameState.theme]);

  // Also trigger intro on initial start
  useEffect(() => {
    if (gameState.gameStatus === 'playing' && gameState.floor === 1 && !lastFloorRef.current) {
      setFloorIntro({ floor: 1, theme: gameState.theme || 'Inferno' });
      lastFloorRef.current = 1;
      const timer = setTimeout(() => setFloorIntro(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [gameState.gameStatus]);

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

  // Auto-record runs on win/loss
  useEffect(() => {
    if (isReplayMode) return;
    if ((gameState.gameStatus === 'won' || gameState.gameStatus === 'lost') && lastRecordedRunRef.current !== gameState.initialSeed) {
      lastRecordedRunRef.current = gameState.initialSeed || 'default';
      // Record to local storage
      const seed = gameState.initialSeed ?? gameState.rngSeed ?? '0';
      const score = gameState.completedRun?.score || (gameState.player.hp || 0) + (gameState.floor || 0) * 100;
      const replayValidation = validateReplayActions(gameState.actionLog || []);
      if (!replayValidation.valid) {
        console.error('[HOP_REPLAY] Refusing to persist replay with invalid action log', {
          errors: replayValidation.errors
        });
        return;
      }
      const diagnostics = buildReplayDiagnostics(replayValidation.actions, gameState.floor || 0);
      const rec: ReplayRecord = {
        id: `run-${Date.now()}`,
        seed,
        loadoutId: gameState.player.archetype,
        actions: replayValidation.actions,
        score,
        floor: gameState.floor,
        date: new Date().toISOString(),
        replayVersion: 2,
        diagnostics
      };

      const raw = localStorage.getItem('hop_replays_v1');
      const list = raw ? JSON.parse(raw) as ReplayRecord[] : [];
      const next = [rec, ...list].slice(0, 100);
      localStorage.setItem('hop_replays_v1', JSON.stringify(next));

      // Also update leaderboard if top 5
      const rawLB = localStorage.getItem('hop_leaderboard_v1');
      let lb = rawLB ? JSON.parse(rawLB) as any[] : [];
      lb.push({
        id: rec.id,
        name: 'Player',
        score: rec.score,
        floor: rec.floor,
        date: rec.date,
        seed: rec.seed,
        loadoutId: rec.loadoutId,
        actions: rec.actions,
        replayVersion: rec.replayVersion,
        diagnostics: rec.diagnostics
      });
      lb.sort((a, b) => b.score - a.score);
      lb = lb.slice(0, 5);
      localStorage.setItem('hop_leaderboard_v1', JSON.stringify(lb));
    }
    if (gameState.gameStatus === 'hub') {
      lastRecordedRunRef.current = null;
    }
  }, [gameState.gameStatus, isReplayMode, gameState.initialSeed]);

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

