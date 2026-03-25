import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Action, GameState } from '@hop/engine';
import { buildTransitionCompileContext } from './worldgen-transport';
import type { WorldgenWorkerState } from './use-worldgen-worker';
import {
  INITIAL_PENDING_FLOOR_WORLDGEN_STATE,
  reducePendingFloorWorldgenState,
  type PendingFloorWorldgenState,
} from './pending-floor-worldgen-machine';

interface UsePendingFloorWorldgenArgs {
  gameState: GameState;
  worldgenWorker: WorldgenWorkerState;
  worldgenDebugEnabled: boolean;
  dispatchWithTrace: (action: Action, source: string) => void;
  ensureWorldgenReady: (reason: 'pending_floor') => Promise<void>;
  reportWorldgenUiError: (kind: 'init' | 'start_run' | 'stairs', message: string) => void;
  clearWorldgenUiError: () => void;
}

interface UsePendingFloorWorldgenResult {
  state: PendingFloorWorldgenState;
  pendingKey?: string;
  progressLabel?: string;
  resolvePendingFloor: () => void | Promise<void>;
  retryPendingFloor: () => void;
}

export const usePendingFloorWorldgen = ({
  gameState,
  worldgenWorker,
  worldgenDebugEnabled,
  dispatchWithTrace,
  ensureWorldgenReady,
  reportWorldgenUiError,
  clearWorldgenUiError
}: UsePendingFloorWorldgenArgs): UsePendingFloorWorldgenResult => {
  const [state, dispatchState] = useReducer(
    reducePendingFloorWorldgenState,
    INITIAL_PENDING_FLOOR_WORLDGEN_STATE
  );
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const pendingKey = useMemo(() => (
    `${gameState.floor}:${gameState.turnNumber}:${gameState.pendingStatus?.status ?? 'none'}:${gameState.pendingFrames?.length ?? 0}`
  ), [
    gameState.floor,
    gameState.turnNumber,
    gameState.pendingFrames?.length,
    gameState.pendingStatus?.status
  ]);

  const isPendingFloorTransition = gameState.pendingStatus?.status === 'playing';

  useEffect(() => {
    if (!isPendingFloorTransition) {
      dispatchState({ type: 'SYNC_PENDING', active: false });
      return;
    }
    dispatchState({ type: 'SYNC_PENDING', active: true, key: pendingKey });
  }, [isPendingFloorTransition, pendingKey]);

  const compilePendingFloor = useCallback(async (key: string) => {
    const current = stateRef.current;
    if (
      current.key === key
      && (current.phase === 'compiling_floor' || current.phase === 'applied')
    ) {
      return;
    }
    if (gameState.pendingStatus?.status !== 'playing') {
      dispatchWithTrace({ type: 'RESOLVE_PENDING' }, 'pending_ready');
      return;
    }
    if (!gameState.generationState) {
      const message = 'Worldgen generation state unavailable for stairs transition';
      dispatchState({ type: 'COMPILE_FAILED', key, error: message });
      reportWorldgenUiError('stairs', message);
      return;
    }

    dispatchState({ type: 'COMPILE_STARTED', key });
    const initialized = await ensureWorldgenReady('pending_floor').then(() => true).catch((error: Error) => {
      const message = error.message || 'Worldgen runtime unavailable for stairs transition';
      dispatchState({ type: 'COMPILE_FAILED', key, error: message });
      reportWorldgenUiError('init', message);
      return null;
    });
    if (!initialized) return;

    const context = buildTransitionCompileContext(gameState, worldgenDebugEnabled);
    const artifact = await worldgenWorker.compilePendingFloor(context).catch((error: Error) => {
      const message = error.message || 'Worldgen stairs transition failed';
      dispatchState({ type: 'COMPILE_FAILED', key, error: message });
      reportWorldgenUiError('stairs', message);
      return null;
    });
    if (!artifact) return;

    dispatchState({ type: 'COMPILE_SUCCEEDED', key });
    clearWorldgenUiError();
    dispatchWithTrace({ type: 'APPLY_WORLDGEN_ARTIFACT', payload: artifact }, 'pending_floor_worker');
  }, [
    clearWorldgenUiError,
    dispatchWithTrace,
    ensureWorldgenReady,
    gameState,
    reportWorldgenUiError,
    worldgenDebugEnabled,
    worldgenWorker
  ]);

  const resolvePendingFloor = useCallback(() => {
    const current = stateRef.current;
    if (gameState.pendingStatus?.status !== 'playing') {
      dispatchWithTrace({ type: 'RESOLVE_PENDING' }, 'pending_ready');
      return;
    }
    if (current.phase !== 'waiting_for_animation' || current.key !== pendingKey) {
      return;
    }
    void compilePendingFloor(pendingKey);
  }, [compilePendingFloor, dispatchWithTrace, gameState.pendingStatus?.status, pendingKey]);

  const retryPendingFloor = useCallback(() => {
    const current = stateRef.current;
    if (gameState.pendingStatus?.status !== 'playing') return;
    if (current.phase !== 'compile_failed' || current.key !== pendingKey) return;
    dispatchState({ type: 'RETRY_REQUESTED', key: pendingKey });
    void compilePendingFloor(pendingKey);
  }, [compilePendingFloor, gameState.pendingStatus?.status, pendingKey]);

  const progressLabel = worldgenWorker.phase === 'initializing'
    ? 'Warming worldgen runtime...'
    : worldgenWorker.progress
      ? `Compiling: ${worldgenWorker.progress.pass} (${worldgenWorker.progress.percent}%)`
      : state.phase === 'waiting_for_animation' && isPendingFloorTransition
        ? 'Compiling: waiting_for_animation'
        : undefined;

  return {
    state,
    pendingKey,
    progressLabel,
    resolvePendingFloor,
    retryPendingFloor
  };
};
