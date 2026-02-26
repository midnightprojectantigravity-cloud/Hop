import { useCallback, useEffect, useMemo, useRef } from 'react';
import { isPlayerTurn } from '@hop/engine';
import type { Action, GameState } from '@hop/engine';
import { deriveTurnDriverState } from '../turn-driver';

type TurnTraceEntry = {
  id: number;
  t: number;
  event: string;
  turnNumber: number;
  phase: string;
  gameStatus: string;
  playerTurn: boolean;
  isBusy: boolean;
  postCommitInputLock: boolean;
  pendingStatus: string;
  pendingFrames: number;
  canPlayerInput: boolean;
  shouldAdvanceQueue: boolean;
  shouldResolvePending: boolean;
  actionLogLength: number;
  queueHead: string;
  details?: Record<string, unknown>;
};

interface UseTurnDriverTraceArgs {
  gameState: GameState;
  dispatch: (action: Action) => void;
  isReplayMode: boolean;
  isBusy: boolean;
  postCommitInputLock: boolean;
  dispatchWithTraceProxyRef?: React.MutableRefObject<(action: Action, source: string) => void>;
  summarizeActionPayload: (action: Action) => Record<string, unknown> | undefined;
}

export interface TurnTraceAppender {
  (event: string, details?: Record<string, unknown>): void;
}

export const useTurnDriverTrace = ({
  gameState,
  dispatch,
  isReplayMode,
  isBusy,
  postCommitInputLock,
  dispatchWithTraceProxyRef,
  summarizeActionPayload,
}: UseTurnDriverTraceArgs) => {
  const pendingFrameCount = gameState.pendingFrames?.length ?? 0;
  const turnDriver = useMemo(() => deriveTurnDriverState({
    gameStatus: gameState.gameStatus,
    isReplayMode,
    isBusy,
    postCommitInputLock,
    isPlayerTurn: isPlayerTurn(gameState),
    hasPendingStatus: Boolean(gameState.pendingStatus),
    pendingFrameCount
  }), [gameState.gameStatus, isReplayMode, isBusy, postCommitInputLock, gameState.pendingStatus, pendingFrameCount, gameState.initiativeQueue, gameState.player.id, gameState.enemies]);
  const isInputLocked = !turnDriver.canPlayerInput;

  const turnTraceRef = useRef<TurnTraceEntry[]>([]);
  const turnTraceSeqRef = useRef(0);
  const lastDriverSignatureRef = useRef('');
  const queueHead = gameState.initiativeQueue?.entries?.[
    Math.max(0, gameState.initiativeQueue.currentIndex ?? 0)
  ]?.actorId
    ?? gameState.initiativeQueue?.entries?.[0]?.actorId
    ?? 'none';

  const appendTurnTrace: TurnTraceAppender = useCallback((event: string, details?: Record<string, unknown>) => {
    const entry: TurnTraceEntry = {
      id: ++turnTraceSeqRef.current,
      t: Date.now(),
      event,
      turnNumber: gameState.turnNumber,
      phase: turnDriver.phase,
      gameStatus: gameState.gameStatus,
      playerTurn: isPlayerTurn(gameState),
      isBusy,
      postCommitInputLock,
      pendingStatus: gameState.pendingStatus?.status ?? 'none',
      pendingFrames: gameState.pendingFrames?.length ?? 0,
      canPlayerInput: turnDriver.canPlayerInput,
      shouldAdvanceQueue: turnDriver.shouldAdvanceQueue,
      shouldResolvePending: turnDriver.shouldResolvePending,
      actionLogLength: gameState.actionLog?.length ?? 0,
      queueHead,
      details
    };
    turnTraceRef.current.push(entry);
    if (turnTraceRef.current.length > 800) {
      turnTraceRef.current.splice(0, turnTraceRef.current.length - 800);
    }
  }, [
    gameState.turnNumber,
    gameState.gameStatus,
    gameState.pendingStatus,
    gameState.pendingFrames,
    gameState.actionLog,
    gameState.initiativeQueue,
    gameState.player.id,
    gameState.enemies,
    turnDriver.phase,
    turnDriver.canPlayerInput,
    turnDriver.shouldAdvanceQueue,
    turnDriver.shouldResolvePending,
    isBusy,
    postCommitInputLock,
    queueHead
  ]);

  const dispatchWithTrace = useCallback((action: Action, source: string) => {
    appendTurnTrace('DISPATCH', {
      source,
      actionType: action.type,
      payload: summarizeActionPayload(action)
    });
    dispatch(action);
  }, [appendTurnTrace, dispatch, summarizeActionPayload]);

  if (dispatchWithTraceProxyRef) {
    dispatchWithTraceProxyRef.current = dispatchWithTrace;
  }

  useEffect(() => {
    const signature = [
      turnDriver.phase,
      gameState.turnNumber,
      gameState.gameStatus,
      gameState.pendingStatus?.status ?? 'none',
      gameState.pendingFrames?.length ?? 0,
      isBusy ? 1 : 0,
      postCommitInputLock ? 1 : 0,
      queueHead
    ].join('|');
    if (signature !== lastDriverSignatureRef.current) {
      appendTurnTrace('TURN_STATE');
      lastDriverSignatureRef.current = signature;
    }
  }, [
    turnDriver.phase,
    gameState.turnNumber,
    gameState.gameStatus,
    gameState.pendingStatus,
    gameState.pendingFrames,
    isBusy,
    postCommitInputLock,
    queueHead,
    appendTurnTrace
  ]);

  useEffect(() => {
    (window as any).__HOP_TURN_TRACE = turnTraceRef.current;
    (window as any).__HOP_DUMP_TURN_TRACE = () => [...turnTraceRef.current];
    (window as any).__HOP_PRINT_TURN_TRACE = (limit: number = 80) => {
      const rows = turnTraceRef.current.slice(-Math.max(1, Math.floor(limit)));
      console.table(rows.map(r => ({
        id: r.id,
        event: r.event,
        turn: r.turnNumber,
        phase: r.phase,
        status: r.gameStatus,
        playerTurn: r.playerTurn,
        busy: r.isBusy,
        lock: r.postCommitInputLock,
        pending: `${r.pendingStatus}/${r.pendingFrames}`,
        queueHead: r.queueHead,
        actionLog: r.actionLogLength,
        details: r.details ? JSON.stringify(r.details) : ''
      })));
      return rows;
    };
    (window as any).__HOP_CLEAR_TURN_TRACE = () => {
      turnTraceRef.current.length = 0;
      turnTraceSeqRef.current = 0;
    };
    turnTraceRef.current.push({
      id: ++turnTraceSeqRef.current,
      t: Date.now(),
      event: 'TRACE_READY',
      turnNumber: 0,
      phase: 'INIT',
      gameStatus: 'init',
      playerTurn: false,
      isBusy: false,
      postCommitInputLock: false,
      pendingStatus: 'none',
      pendingFrames: 0,
      canPlayerInput: false,
      shouldAdvanceQueue: false,
      shouldResolvePending: false,
      actionLogLength: 0,
      queueHead: 'none'
    });
    return () => {
      delete (window as any).__HOP_DUMP_TURN_TRACE;
      delete (window as any).__HOP_PRINT_TURN_TRACE;
      delete (window as any).__HOP_CLEAR_TURN_TRACE;
    };
  }, []);

  return {
    turnDriver,
    isInputLocked,
    appendTurnTrace,
    dispatchWithTrace,
  };
};
