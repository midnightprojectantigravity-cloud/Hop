import { describe, expect, it } from 'vitest';
import { deriveTurnDriverState } from '../turn-driver';

describe('turn driver state machine', () => {
  it('opens input only in player control window', () => {
    const state = deriveTurnDriverState({
      gameStatus: 'playing',
      isReplayMode: false,
      isBusy: false,
      postCommitInputLock: false,
      isPlayerTurn: true,
      hasPendingStatus: false,
      pendingFrameCount: 0
    });
    expect(state.phase).toBe('INPUT_OPEN');
    expect(state.canPlayerInput).toBe(true);
    expect(state.shouldAdvanceQueue).toBe(false);
  });

  it('blocks queue advance while pending intercept exists', () => {
    const state = deriveTurnDriverState({
      gameStatus: 'playing',
      isReplayMode: false,
      isBusy: false,
      postCommitInputLock: false,
      isPlayerTurn: false,
      hasPendingStatus: true,
      pendingFrameCount: 1
    });
    expect(state.phase).toBe('INTERCEPT_READY');
    expect(state.shouldAdvanceQueue).toBe(false);
    expect(state.shouldResolvePending).toBe(true);
  });

  it('enters playback while busy and never unlocks input', () => {
    const state = deriveTurnDriverState({
      gameStatus: 'playing',
      isReplayMode: false,
      isBusy: true,
      postCommitInputLock: false,
      isPlayerTurn: true,
      hasPendingStatus: false,
      pendingFrameCount: 0
    });
    expect(state.phase).toBe('PLAYBACK');
    expect(state.canPlayerInput).toBe(false);
  });

  it('keeps queue advancing when post-commit lock is active during non-player turn', () => {
    const state = deriveTurnDriverState({
      gameStatus: 'playing',
      isReplayMode: false,
      isBusy: false,
      postCommitInputLock: true,
      isPlayerTurn: false,
      hasPendingStatus: false,
      pendingFrameCount: 0
    });
    expect(state.phase).toBe('POST_COMMIT_QUEUE');
    expect(state.canPlayerInput).toBe(false);
    expect(state.shouldAdvanceQueue).toBe(true);
  });
});
