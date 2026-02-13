export type TurnDriverPhase =
  | 'IDLE'
  | 'REPLAY'
  | 'INTERCEPT_ANIMATING'
  | 'INTERCEPT_READY'
  | 'PLAYBACK'
  | 'POST_COMMIT_LOCK'
  | 'POST_COMMIT_QUEUE'
  | 'INPUT_OPEN'
  | 'QUEUE_ADVANCE';

export interface TurnDriverInput {
  gameStatus: 'hub' | 'playing' | 'won' | 'lost' | 'choosing_upgrade';
  isReplayMode: boolean;
  isBusy: boolean;
  postCommitInputLock: boolean;
  isPlayerTurn: boolean;
  hasPendingStatus: boolean;
  pendingFrameCount: number;
}

export interface TurnDriverState {
  phase: TurnDriverPhase;
  canPlayerInput: boolean;
  shouldAdvanceQueue: boolean;
  shouldResolvePending: boolean;
  queueAdvanceDelayMs: number;
}

export const deriveTurnDriverState = (input: TurnDriverInput): TurnDriverState => {
  const {
    gameStatus,
    isReplayMode,
    isBusy,
    postCommitInputLock,
    isPlayerTurn,
    hasPendingStatus,
    pendingFrameCount
  } = input;

  const hasPendingIntercept = hasPendingStatus || pendingFrameCount > 0;

  let phase: TurnDriverPhase = 'IDLE';
  if (isReplayMode) {
    phase = 'REPLAY';
  } else if (gameStatus !== 'playing') {
    phase = 'IDLE';
  } else if (hasPendingIntercept) {
    phase = isBusy ? 'INTERCEPT_ANIMATING' : 'INTERCEPT_READY';
  } else if (isBusy) {
    phase = 'PLAYBACK';
  } else if (postCommitInputLock && isPlayerTurn) {
    // Keep input locked while waiting for the committed player action to fully settle.
    phase = 'POST_COMMIT_LOCK';
  } else if (postCommitInputLock && !isPlayerTurn) {
    // Critical: queue must still advance through enemy turns while player input is locked.
    phase = 'POST_COMMIT_QUEUE';
  } else if (isPlayerTurn) {
    phase = 'INPUT_OPEN';
  } else {
    phase = 'QUEUE_ADVANCE';
  }

  return {
    phase,
    canPlayerInput: phase === 'INPUT_OPEN',
    shouldAdvanceQueue: phase === 'QUEUE_ADVANCE' || phase === 'POST_COMMIT_QUEUE',
    shouldResolvePending: phase === 'INTERCEPT_READY',
    queueAdvanceDelayMs: 380
  };
};
