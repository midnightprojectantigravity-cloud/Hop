import { useCallback, useEffect, useMemo, useRef } from 'react';
import { hexEquals, type Action, type GameState, type GridSize, type MapShape, type Point } from '@hop/engine';
import { buildReplayRecordFromGameState } from './use-run-recording';
import {
  resolveRunLostOverlayVisible,
  RUN_LOST_OVERLAY_PLAYER_DEATH_DELAY_MS,
} from './run-lost-overlay-visibility';
import {
  buildRunResumeContext,
  deriveQuickRestartStartRunPayload,
  writeRunResumeContext,
  type RunResumeContext
} from './run-resume-context';
import { DEFAULT_START_RUN_MAP_SHAPE } from './start-run-overrides';
import { emitUiMetric } from './ui-telemetry';
import { EMPTY_SYNAPSE_SELECTION, type SynapsePulse, type SynapseSelection } from './synapse';
import { canSelectSkillForTutorialStep, isTutorialAttackAction, isTutorialMovementAction } from './tutorial/tutorial-gates';
import type { TutorialStepId } from './tutorial/tutorial-state-machine';
import type { GameScreenActions } from './use-game-screen-model';

export interface RunController {
  actions: GameScreenActions;
  showRunLostOverlay: boolean;
  onRunStarted: () => void;
  handleLoadScenario: (state: GameState, instructions: string) => void;
}

export const useRunController = ({
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
  startRun,
  activeTutorialStepId,
  finishGuidedTutorialStep,
  dismissTutorialInstructions,
  showTutorialInstructions,
  selectedSkillId,
  setSelectedSkillId,
  showMovementRange,
  setShowMovementRange,
  setRunLostOverlayDelayElapsed,
  runLostOverlayDelayElapsed,
  setPendingAutoEnd,
  setOverdriveState,
  isSynapseMode,
  setIsSynapseMode,
  setSynapseSelection,
  setSynapsePulse,
  setIsBusy,
  toggleOverdrive
}: {
  gameState: GameState;
  isReplayMode: boolean;
  isInputLocked: boolean;
  isBusy: boolean;
  replayActive: boolean;
  setReplayActive: (active: boolean) => void;
  stepReplay: () => void;
  goToReplayIndex: (index: number) => void;
  resetReplayUi: () => void;
  startReplay: (record: NonNullable<ReturnType<typeof buildReplayRecordFromGameState>>) => void;
  dispatchWithTrace: (action: Action, source: string) => void;
  dispatchPlayerActionWithTurnPolicy: (action: Action, source: string) => void;
  armPostCommitLock: () => void;
  dispatchSensory: (payload: Parameters<typeof import('./sensory-dispatcher').dispatchSensoryEvent>[0]) => void;
  navigateTo: (path: string) => void;
  homePath: string;
  defeatLoopV2Enabled: boolean;
  runResumeContext: RunResumeContext | null;
  setRunResumeContext: (context: RunResumeContext) => void;
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
  activeTutorialStepId: TutorialStepId | null;
  finishGuidedTutorialStep: (stepId: 'movement' | 'attack' | 'wait') => void;
  dismissTutorialInstructions: () => void;
  showTutorialInstructions: (instructions: string | null) => void;
  selectedSkillId: string | null;
  setSelectedSkillId: (skillId: string | null) => void;
  showMovementRange: boolean;
  setShowMovementRange: (value: boolean) => void;
  setRunLostOverlayDelayElapsed: (value: boolean) => void;
  runLostOverlayDelayElapsed: boolean;
  setPendingAutoEnd: (value: null) => void;
  setOverdriveState: (value: 'idle') => void;
  isSynapseMode: boolean;
  setIsSynapseMode: (enabled: boolean) => void;
  setSynapseSelection: (value: SynapseSelection) => void;
  setSynapsePulse: (value: SynapsePulse) => void;
  setIsBusy: (busy: boolean) => void;
  toggleOverdrive: () => void;
}): RunController => {
  const runStartedAtRef = useRef<number | null>(null);
  const firstActionMeasuredRef = useRef(false);
  const defeatAtRef = useRef<number | null>(null);
  const runLostOverlayActionReadyRef = useRef(false);

  const clearSynapseContext = useCallback(() => {
    setSynapseSelection(EMPTY_SYNAPSE_SELECTION);
    setSynapsePulse(null);
  }, [setSynapsePulse, setSynapseSelection]);

  const setSynapseMode = useCallback((enabled: boolean) => {
    setIsSynapseMode(enabled);
    if (!enabled) {
      setSynapseSelection(EMPTY_SYNAPSE_SELECTION);
      setSynapsePulse(null);
    }
  }, [setIsSynapseMode, setSynapsePulse, setSynapseSelection]);

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

  const trackFirstActionMetric = useCallback((actionType: 'MOVE' | 'USE_SKILL' | 'WAIT') => {
    if (isReplayMode) return;
    if (firstActionMeasuredRef.current) return;
    if (runStartedAtRef.current === null) return;
    emitUiMetric('first_action_ms', Date.now() - runStartedAtRef.current, { actionType });
    firstActionMeasuredRef.current = true;
  }, [isReplayMode]);

  const handleSelectSkill = useCallback((skillId: string | null) => {
    if (isInputLocked) return;
    if (!canSelectSkillForTutorialStep(activeTutorialStepId, skillId)) {
      dispatchSensory({ id: 'ui-cancel', intensity: 1.0, priority: 'low', context: 'run' });
      return;
    }
    if (skillId && isSynapseMode) {
      setSynapseMode(false);
    }
    if (skillId) {
      dispatchSensory({ id: 'haptic-action-medium', intensity: 1.0, priority: 'low', context: 'run' });
      dispatchSensory({ id: 'ui-confirm', intensity: 1.0, priority: 'low', context: 'run' });
    }
    setSelectedSkillId(skillId);
  }, [activeTutorialStepId, dispatchSensory, isInputLocked, isSynapseMode, setSelectedSkillId, setSynapseMode]);

  const handleTileClick = useCallback((target: Point, passiveSkillId?: string) => {
    if (isInputLocked) return;
    if (isSynapseMode) {
      setSynapseSelection({ mode: 'tile', tile: target });
      return;
    }
    if (activeTutorialStepId === 'movement' && !isTutorialMovementAction({
      target,
      playerPosition: gameState.player.position,
      selectedSkillId,
      passiveSkillId
    })) {
      dispatchSensory({ id: 'ui-cancel', intensity: 1.0, priority: 'low', context: 'run' });
      return;
    }
    if (activeTutorialStepId === 'attack' && !isTutorialAttackAction({ selectedSkillId, passiveSkillId })) {
      dispatchSensory({ id: 'ui-cancel', intensity: 1.0, priority: 'low', context: 'run' });
      return;
    }
    if (activeTutorialStepId === 'wait') {
      dispatchSensory({ id: 'ui-cancel', intensity: 1.0, priority: 'low', context: 'run' });
      return;
    }
    if (selectedSkillId) {
      trackFirstActionMetric('USE_SKILL');
      dispatchSensory({ id: 'haptic-action-medium', intensity: 1.0, priority: 'low', context: 'run' });
      dispatchSensory({ id: 'combat-hit-light', intensity: 1.0, priority: 'low', context: 'run' });
      dispatchPlayerActionWithTurnPolicy({ type: 'USE_SKILL', payload: { skillId: selectedSkillId, target } }, 'player_use_skill');
      setSelectedSkillId(null);
      if (activeTutorialStepId === 'attack') {
        window.setTimeout(() => finishGuidedTutorialStep('attack'), 0);
      }
      return;
    }
    if (hexEquals(target, gameState.player.position)) {
      setShowMovementRange(!showMovementRange);
      return;
    }
    const resolvedPassiveSkillId = passiveSkillId || undefined;
    const isResolvedMovementSkill = resolvedPassiveSkillId === 'BASIC_MOVE' || resolvedPassiveSkillId === 'DASH';
    const metricActionType = !resolvedPassiveSkillId || isResolvedMovementSkill ? 'MOVE' : 'USE_SKILL';

    trackFirstActionMetric(metricActionType);
    dispatchSensory({ id: 'haptic-action-medium', intensity: 1.0, priority: 'low', context: 'run' });
    if (resolvedPassiveSkillId) {
      dispatchPlayerActionWithTurnPolicy(
        { type: 'USE_SKILL', payload: { skillId: resolvedPassiveSkillId, target } },
        isResolvedMovementSkill ? 'player_move_resolved' : 'player_passive_resolved'
      );
    } else {
      dispatchPlayerActionWithTurnPolicy({ type: 'MOVE', payload: target }, 'player_move');
    }
    setShowMovementRange(false);
    if (activeTutorialStepId === 'movement') {
      window.setTimeout(() => finishGuidedTutorialStep('movement'), 0);
    }
  }, [
    activeTutorialStepId,
    dispatchPlayerActionWithTurnPolicy,
    dispatchSensory,
    finishGuidedTutorialStep,
    gameState.player.position,
    isInputLocked,
    isSynapseMode,
    selectedSkillId,
    setSelectedSkillId,
    setShowMovementRange,
    setSynapseSelection,
    showMovementRange,
    trackFirstActionMetric
  ]);

  const handleSynapseInspectEntity = useCallback((actorId: string) => {
    if (!isSynapseMode) return;
    setSynapseSelection({ mode: 'entity', actorId });
    setSynapsePulse({ actorId, token: Date.now() });
  }, [isSynapseMode, setSynapsePulse, setSynapseSelection]);

  const handleSelectUpgrade = useCallback((upgrade: string) => {
    if (isReplayMode || isBusy) return;
    dispatchWithTrace({ type: 'SELECT_UPGRADE', payload: upgrade }, 'upgrade_select');
  }, [dispatchWithTrace, isBusy, isReplayMode]);

  const handleExitToHub = useCallback(() => {
    dispatchWithTrace({ type: 'EXIT_TO_HUB' }, 'exit_to_hub');
    setPendingAutoEnd(null);
    setOverdriveState('idle');
    setSelectedSkillId(null);
    setSynapseMode(false);
    resetReplayUi();
    navigateTo(homePath);
  }, [
    dispatchWithTrace,
    homePath,
    navigateTo,
    resetReplayUi,
    setOverdriveState,
    setPendingAutoEnd,
    setSelectedSkillId,
    setSynapseMode
  ]);

  const handleReset = useCallback(() => {
    dispatchSensory({ id: 'haptic-nav-light', intensity: 1.0, priority: 'low', context: 'run' });
    dispatchSensory({ id: 'ui-cancel', intensity: 1.0, priority: 'low', context: 'run' });
    dispatchWithTrace({ type: 'RESET' }, 'reset');
    setPendingAutoEnd(null);
    setOverdriveState('idle');
    setSelectedSkillId(null);
    setSynapseMode(false);
    resetReplayUi();
  }, [
    dispatchSensory,
    dispatchWithTrace,
    resetReplayUi,
    setOverdriveState,
    setPendingAutoEnd,
    setSelectedSkillId,
    setSynapseMode
  ]);

  const handleWait = useCallback(() => {
    if (isInputLocked) return;
    if (activeTutorialStepId && activeTutorialStepId !== 'wait') {
      dispatchSensory({ id: 'ui-cancel', intensity: 1.0, priority: 'low', context: 'run' });
      return;
    }
    if (isSynapseMode) {
      setSynapseSelection(EMPTY_SYNAPSE_SELECTION);
      return;
    }
    trackFirstActionMetric('WAIT');
    dispatchSensory({ id: 'haptic-action-medium', intensity: 1.0, priority: 'low', context: 'run' });
    dispatchSensory({ id: 'ui-confirm', intensity: 1.0, priority: 'low', context: 'run' });
    setPendingAutoEnd(null);
    setOverdriveState('idle');
    armPostCommitLock();
    dispatchWithTrace({ type: 'WAIT' }, 'player_wait');
    setSelectedSkillId(null);
    if (activeTutorialStepId === 'wait') {
      window.setTimeout(() => finishGuidedTutorialStep('wait'), 0);
    }
  }, [
    activeTutorialStepId,
    armPostCommitLock,
    dispatchSensory,
    dispatchWithTrace,
    finishGuidedTutorialStep,
    isInputLocked,
    isSynapseMode,
    setOverdriveState,
    setPendingAutoEnd,
    setSelectedSkillId,
    setSynapseSelection,
    trackFirstActionMetric
  ]);

  const stopReplay = useCallback(() => {
    dispatchSensory({ id: 'ui-parchment-slide', intensity: 1.0, priority: 'low', context: 'run' });
    handleExitToHub();
  }, [dispatchSensory, handleExitToHub]);

  const handleLoadScenario = useCallback((state: GameState, instructions: string) => {
    dispatchWithTrace({ type: 'LOAD_STATE', payload: state }, 'scenario_load');
    setPendingAutoEnd(null);
    setOverdriveState('idle');
    showTutorialInstructions(instructions);
    setSelectedSkillId(null);
    setSynapseMode(false);
  }, [dispatchWithTrace, setOverdriveState, setPendingAutoEnd, setSelectedSkillId, setSynapseMode, showTutorialInstructions]);

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
    dispatchSensory({ id: 'haptic-outcome-impact', intensity: 1.0, priority: 'high', context: 'run' });
    resetReplayUi();
    setSelectedSkillId(null);
    setSynapseMode(false);
    clearSynapseContext();
    void startRun({
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
    setSelectedSkillId,
    setSynapseMode,
    startRun
  ]);

  const handleViewReplay = useCallback(() => {
    const record = buildReplayRecordFromGameState(gameState);
    if (!record) return;
    dispatchSensory({ id: 'ui-parchment-slide', intensity: 1.0, priority: 'low', context: 'run' });
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
        dispatchSensory({ id: 'haptic-threat-heavy', intensity: 1.0, priority: 'high', context: 'run' });
        dispatchSensory({ id: 'run-defeat', intensity: 1.0, priority: 'high', context: 'run' });
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
    if (gameState.gameStatus !== 'won') return;
    dispatchSensory({ id: 'run-victory', intensity: 1.0, priority: 'high', context: 'run' });
  }, [dispatchSensory, gameState.gameStatus]);

  useEffect(() => {
    if (gameState.gameStatus !== 'lost') {
      setRunLostOverlayDelayElapsed(false);
      return;
    }
    if (gameState.player.hp > 0) {
      setRunLostOverlayDelayElapsed(true);
      return;
    }
    setRunLostOverlayDelayElapsed(false);
    const timer = window.setTimeout(() => {
      setRunLostOverlayDelayElapsed(true);
    }, RUN_LOST_OVERLAY_PLAYER_DEATH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [gameState.gameStatus, gameState.player.hp, setRunLostOverlayDelayElapsed]);

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
  }, [gameState.dailyRunDate, gameState.gameStatus, gameState.player.archetype, isReplayMode, runResumeContext, setRunResumeContext]);

  const showRunLostOverlay = resolveRunLostOverlayVisible({
    gameStatus: gameState.gameStatus,
    playerHp: gameState.player.hp,
    isBusy,
    delayElapsed: runLostOverlayDelayElapsed,
  });

  const actions = useMemo<GameScreenActions>(() => ({
    onSetBoardBusy: setIsBusy,
    onTileClick: handleTileClick,
    onReset: handleReset,
    onWait: handleWait,
    onExitToHub: handleExitToHub,
    onSelectSkill: handleSelectSkill,
    onSelectUpgrade: handleSelectUpgrade,
    onToggleSynapseMode: toggleSynapseMode,
    onSynapseInspectEntity: handleSynapseInspectEntity,
    onSynapseSelectSource: handleSynapseInspectEntity,
    onSynapseClearSelection: clearSynapseContext,
    onDismissTutorial: dismissTutorialInstructions,
    onToggleReplay: () => {
      dispatchSensory({ id: 'ui-parchment-slide', intensity: 1.0, priority: 'low', context: 'run' });
      setReplayActive(!replayActive);
    },
    onStepReplay: stepReplay,
    onJumpReplay: goToReplayIndex,
    onCloseReplay: stopReplay,
    onQuickRestart: handleQuickRestart,
    onViewReplay: handleViewReplay,
    onRunLostActionsReady: handleRunLostActionsReady,
    onSetColorMode: () => {},
    onSetVitalsMode: () => {},
    onToggleOverdrive: toggleOverdrive
  }), [
    clearSynapseContext,
    dismissTutorialInstructions,
    dispatchSensory,
    goToReplayIndex,
    handleExitToHub,
    handleQuickRestart,
    handleReset,
    handleRunLostActionsReady,
    handleSelectSkill,
    handleSelectUpgrade,
    handleSynapseInspectEntity,
    handleTileClick,
    handleViewReplay,
    handleWait,
    replayActive,
    setIsBusy,
    setReplayActive,
    stepReplay,
    stopReplay,
    toggleOverdrive,
    toggleSynapseMode
  ]);

  return {
    actions,
    showRunLostOverlay,
    handleLoadScenario,
    onRunStarted: () => {
      runStartedAtRef.current = Date.now();
      firstActionMeasuredRef.current = false;
      defeatAtRef.current = null;
    }
  };
};
