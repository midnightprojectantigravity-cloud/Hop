import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { isPlayerTurn } from '@hop/engine';
import type { Action, GameState } from '@hop/engine';
import type { TurnDriverState } from '../turn-driver';
import type { TurnTraceAppender } from './use-turn-driver-trace';

interface UseTurnFlowCoordinatorArgs {
  gameState: GameState;
  turnDriver: TurnDriverState;
  isBusy: boolean;
  isReplayMode: boolean;
  postCommitInputLock: boolean;
  setPostCommitInputLock: Dispatch<SetStateAction<boolean>>;
  appendTurnTrace: TurnTraceAppender;
  dispatchWithTrace: (action: Action, source: string) => void;
}

const getVisualEventsSignature = (events: Array<{ type: string; payload: any }> | undefined): string => {
  const arr = events || [];
  const last = arr.length > 0 ? arr[arr.length - 1] : undefined;
  return `${arr.length}:${last?.type ?? 'none'}`;
};

const getTimelineEventsSignature = (events: GameState['timelineEvents']): string => {
  const arr = events || [];
  const last = arr.length > 0 ? arr[arr.length - 1] : undefined;
  return `${arr.length}:${last?.id ?? 'none'}:${last?.phase ?? 'none'}`;
};

export const useTurnFlowCoordinator = ({
  gameState,
  turnDriver,
  isBusy,
  isReplayMode,
  postCommitInputLock,
  setPostCommitInputLock,
  appendTurnTrace,
  dispatchWithTrace,
}: UseTurnFlowCoordinatorArgs) => {
  const [postCommitTick, setPostCommitTick] = useState(0);

  const commitLockTurnRef = useRef<number | null>(null);
  const commitLockActionLenRef = useRef<number | null>(null);
  const postCommitLockedAtRef = useRef<number | null>(null);
  const postCommitWatchdogRef = useRef<number | null>(null);

  const lastProcessedEventsHash = useRef('');
  const lastProcessedTimelineHash = useRef('');
  const postCommitObservedBusyRef = useRef(false);
  const postCommitEventHashAtArmRef = useRef('');
  const postCommitTimelineHashAtArmRef = useRef('');
  const pendingObservedBusy = useRef(false);
  const pendingResolveStartedAtRef = useRef<number>(0);

  const POST_COMMIT_MIN_LOCK_MS = 220;
  const POST_COMMIT_BUSY_WAIT_TIMEOUT_MS = 900;

  const pendingFrameCount = gameState.pendingFrames?.length ?? 0;
  const currentEventsHash = getVisualEventsSignature(gameState.visualEvents);
  const currentTimelineHash = getTimelineEventsSignature(gameState.timelineEvents);
  const pendingInterceptSignature = `${gameState.pendingStatus?.status ?? 'none'}:${pendingFrameCount}`;

  const clearPostCommitLock = useCallback((reason: string = 'unknown') => {
    if (postCommitInputLock) {
      appendTurnTrace('LOCK_RELEASE', {
        reason,
        lockTurn: commitLockTurnRef.current,
        expectedActionLogLength: commitLockActionLenRef.current
      });
    }
    setPostCommitInputLock(false);
    commitLockTurnRef.current = null;
    commitLockActionLenRef.current = null;
    postCommitLockedAtRef.current = null;
    postCommitObservedBusyRef.current = false;
    postCommitEventHashAtArmRef.current = '';
    postCommitTimelineHashAtArmRef.current = '';
    if (postCommitWatchdogRef.current !== null) {
      window.clearTimeout(postCommitWatchdogRef.current);
      postCommitWatchdogRef.current = null;
    }
  }, [appendTurnTrace, postCommitInputLock, setPostCommitInputLock]);

  useEffect(() => {
    if (!turnDriver.shouldAdvanceQueue) return;
    appendTurnTrace('QUEUE_SCHEDULE', { delayMs: turnDriver.queueAdvanceDelayMs });

    // One-shot queue pump with explicit driver phase gate.
    const timer = window.setTimeout(() => {
      dispatchWithTrace({ type: 'ADVANCE_TURN' }, 'queue_pump');
    }, turnDriver.queueAdvanceDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    turnDriver.shouldAdvanceQueue,
    turnDriver.queueAdvanceDelayMs,
    gameState.turnNumber,
    gameState.initiativeQueue,
    gameState.player.id,
    gameState.enemies,
    dispatchWithTrace,
    appendTurnTrace
  ]);

  // Update processed hash when animations settle
  useEffect(() => {
    if (!isBusy) {
      lastProcessedEventsHash.current = currentEventsHash;
      lastProcessedTimelineHash.current = currentTimelineHash;
    }
  }, [isBusy, currentEventsHash, currentTimelineHash]);

  useEffect(() => {
    pendingObservedBusy.current = false;
    pendingResolveStartedAtRef.current = performance.now();
  }, [pendingInterceptSignature]);

  useEffect(() => {
    if ((gameState.pendingStatus || pendingFrameCount > 0) && isBusy) {
      pendingObservedBusy.current = true;
    }
  }, [gameState.pendingStatus, pendingFrameCount, isBusy]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    if (isBusy) {
      postCommitObservedBusyRef.current = true;
    }
  }, [postCommitInputLock, isBusy]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    const timer = window.setTimeout(() => {
      setPostCommitTick(v => v + 1);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [postCommitInputLock, postCommitTick]);

  // Auto-resolve pending transitions when animations settle
  useEffect(() => {
    const noPendingAnimations =
      !isBusy
      && (currentEventsHash === lastProcessedEventsHash.current)
      && (currentTimelineHash === lastProcessedTimelineHash.current);
    const hasBlockingTimeline = (gameState.timelineEvents || []).some(ev => ev.blocking);
    const blockingDurationMs = (gameState.timelineEvents || [])
      .filter(ev => ev.blocking)
      .reduce((sum, ev) => sum + (ev.suggestedDurationMs || 0), 0);
    const movementTraceBudgetMs = (gameState.visualEvents || []).reduce((maxMs, ev) => {
      if (ev.type !== 'kinetic_trace') return maxMs;
      const trace = ev.payload as { startDelayMs?: number; durationMs?: number } | undefined;
      if (!trace) return maxMs;
      const startDelayMs = Math.max(0, Number(trace.startDelayMs || 0));
      const durationMs = Math.max(0, Number(trace.durationMs || 0));
      return Math.max(maxMs, startDelayMs + durationMs);
    }, 0);
    const interactionBudgetMs = Math.max(blockingDurationMs, movementTraceBudgetMs);
    const requiredFallbackDelayMs = interactionBudgetMs > 0
      ? Math.max(160, Math.min(3200, interactionBudgetMs + 40))
      : 0;
    const elapsedPendingMs = Math.max(0, performance.now() - pendingResolveStartedAtRef.current);
    const canResolveByBusySignal = !hasBlockingTimeline || pendingObservedBusy.current;
    const canResolveByFallbackDelay = !hasBlockingTimeline || elapsedPendingMs >= requiredFallbackDelayMs;
    const readyForResolve = noPendingAnimations && (canResolveByBusySignal || canResolveByFallbackDelay);

    if (!turnDriver.shouldResolvePending) return;

    if (readyForResolve) {
      appendTurnTrace('PENDING_RESOLVE_READY', {
        noPendingAnimations,
        hasBlockingTimeline,
        movementTraceBudgetMs,
        elapsedPendingMs,
        requiredFallbackDelayMs
      });
      dispatchWithTrace({ type: 'RESOLVE_PENDING' }, 'pending_ready');
      return;
    }

    // Fail-safe: if the busy signal was missed, resolve once the blocking budget elapsed.
    if (!isBusy && hasBlockingTimeline && !pendingObservedBusy.current) {
      appendTurnTrace('PENDING_RESOLVE_WAIT', {
        movementTraceBudgetMs,
        elapsedPendingMs,
        requiredFallbackDelayMs
      });
      const remainingMs = Math.max(0, requiredFallbackDelayMs - elapsedPendingMs);
      const timer = window.setTimeout(() => {
        dispatchWithTrace({ type: 'RESOLVE_PENDING' }, 'pending_fallback_delay');
      }, remainingMs);
      return () => window.clearTimeout(timer);
    }
  }, [
    turnDriver.shouldResolvePending,
    gameState.timelineEvents,
    gameState.visualEvents,
    isBusy,
    currentEventsHash,
    currentTimelineHash,
    dispatchWithTrace,
    appendTurnTrace
  ]);

  useEffect(() => {
    if (!postCommitInputLock) return;

    if (isReplayMode || gameState.gameStatus !== 'playing') {
      clearPostCommitLock('mode_or_status_change');
      return;
    }

    // Intercept stack (shrine/stairs/win/loss) now owns flow control.
    // Post-commit lock is only for normal queue handoff back to player input.
    if (gameState.pendingStatus || (gameState.pendingFrames?.length ?? 0) > 0) {
      clearPostCommitLock('pending_intercept');
      return;
    }

    const lockTurn = commitLockTurnRef.current;
    const expectedActionLen = commitLockActionLenRef.current;
    const lockAgeMs = postCommitLockedAtRef.current !== null
      ? Math.max(0, performance.now() - postCommitLockedAtRef.current)
      : Number.POSITIVE_INFINITY;
    const turnAdvanced = lockTurn !== null ? gameState.turnNumber > lockTurn : false;
    const actionCommitted = expectedActionLen !== null ? (gameState.actionLog?.length ?? 0) >= expectedActionLen : false;
    const minimumLockSatisfied = lockAgeMs >= POST_COMMIT_MIN_LOCK_MS;
    const visualsChangedSinceArm =
      currentEventsHash !== postCommitEventHashAtArmRef.current
      || currentTimelineHash !== postCommitTimelineHashAtArmRef.current;
    const noActionProgressYet = !turnAdvanced && !actionCommitted;
    const waitForExpectedBusy =
      !postCommitObservedBusyRef.current
      && visualsChangedSinceArm
      && lockAgeMs < POST_COMMIT_BUSY_WAIT_TIMEOUT_MS;
    // IMPORTANT: Do not derive this from turnDriver.canPlayerInput because
    // turnDriver itself is lock-aware and would deadlock this release path.
    const queueResolved =
      gameState.gameStatus === 'playing'
      && !isReplayMode
      && !isBusy
      && !gameState.pendingStatus
      && (gameState.pendingFrames?.length ?? 0) === 0
      && isPlayerTurn(gameState);

    if (waitForExpectedBusy) {
      appendTurnTrace('LOCK_WAIT_FOR_BUSY', {
        lockAgeMs,
        visualsChangedSinceArm
      });
      return;
    }

    if (queueResolved && noActionProgressYet && lockAgeMs > 450) {
      clearPostCommitLock('no_progress_timeout');
      return;
    }

    if (queueResolved && minimumLockSatisfied && (turnAdvanced || actionCommitted || lockAgeMs > 1500)) {
      clearPostCommitLock(turnAdvanced ? 'turn_advanced' : actionCommitted ? 'action_committed' : 'age_fallback');
    }
  }, [
    postCommitInputLock,
    isReplayMode,
    gameState.gameStatus,
    gameState.turnNumber,
    gameState.pendingStatus,
    gameState.pendingFrames,
    gameState.initiativeQueue,
    gameState.actionLog,
    isBusy,
    gameState.player.id,
    gameState.enemies,
    appendTurnTrace,
    currentEventsHash,
    currentTimelineHash,
    postCommitTick,
    clearPostCommitLock
  ]);

  useEffect(() => {
    if (gameState.gameStatus !== 'playing' && postCommitInputLock) {
      clearPostCommitLock('not_playing');
    }
  }, [gameState.gameStatus, postCommitInputLock, clearPostCommitLock]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    if (postCommitWatchdogRef.current !== null) {
      window.clearTimeout(postCommitWatchdogRef.current);
    }
    // Fail-safe: if lock remains far beyond normal turn resolution, release lock
    // and emit a diagnostic so we never hard-freeze input.
    postCommitWatchdogRef.current = window.setTimeout(() => {
      if (postCommitInputLock) {
        const globalTrace = Array.isArray((window as any).__HOP_TURN_TRACE) ? (window as any).__HOP_TURN_TRACE : [];
        console.error('[HOP_INPUT_LOCK] Watchdog released stuck post-commit lock', {
          turnNumber: gameState.turnNumber,
          pendingStatus: gameState.pendingStatus?.status,
          pendingFrames: gameState.pendingFrames?.length ?? 0,
          playerTurn: isPlayerTurn(gameState),
          isBusy,
          actionLogLength: gameState.actionLog?.length ?? 0,
          traceTail: globalTrace.slice(-40)
        });
        appendTurnTrace('LOCK_WATCHDOG_RELEASE');
        clearPostCommitLock('watchdog');
      }
    }, 8000);

    return () => {
      if (postCommitWatchdogRef.current !== null) {
        window.clearTimeout(postCommitWatchdogRef.current);
        postCommitWatchdogRef.current = null;
      }
    };
  }, [
    postCommitInputLock,
    gameState.turnNumber,
    gameState.pendingStatus,
    gameState.actionLog,
    isBusy,
    gameState.initiativeQueue,
    gameState.player.id,
    gameState.enemies,
    appendTurnTrace,
    clearPostCommitLock
  ]);

  useEffect(() => {
    if (!postCommitInputLock) return;
    const timer = window.setTimeout(() => {
      appendTurnTrace('LOCK_STALL_SNAPSHOT', {
        lockAgeMs: postCommitLockedAtRef.current !== null
          ? Math.max(0, performance.now() - postCommitLockedAtRef.current)
          : null
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [postCommitInputLock, appendTurnTrace]);

  const armPostCommitLock = useCallback(() => {
    if (postCommitWatchdogRef.current !== null) {
      window.clearTimeout(postCommitWatchdogRef.current);
      postCommitWatchdogRef.current = null;
    }
    commitLockTurnRef.current = gameState.turnNumber;
    commitLockActionLenRef.current = (gameState.actionLog?.length ?? 0) + 1;
    postCommitLockedAtRef.current = performance.now();
    postCommitObservedBusyRef.current = false;
    postCommitEventHashAtArmRef.current = currentEventsHash;
    postCommitTimelineHashAtArmRef.current = currentTimelineHash;
    setPostCommitInputLock(true);
    appendTurnTrace('LOCK_ARM', {
      lockTurn: gameState.turnNumber,
      expectedActionLogLength: (gameState.actionLog?.length ?? 0) + 1,
      eventHashAtArm: currentEventsHash,
      timelineHashAtArm: currentTimelineHash
    });
  }, [
    gameState.turnNumber,
    gameState.actionLog,
    currentEventsHash,
    currentTimelineHash,
    setPostCommitInputLock,
    appendTurnTrace
  ]);

  return {
    armPostCommitLock,
  };
};
