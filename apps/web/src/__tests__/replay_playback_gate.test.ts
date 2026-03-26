import { describe, expect, it } from 'vitest';
import { isReplayStepBlocked } from '../app/use-replay-controller';
import { shouldAutoResolveReplayPendingFloor } from '../app/use-turn-flow-coordinator';

describe('replay playback gates', () => {
  it('blocks replay stepping while the board is busy or pending floor worldgen is in flight', () => {
    expect(isReplayStepBlocked({ isBusy: true, pendingFloorPhase: 'idle' })).toBe(true);
    expect(isReplayStepBlocked({ isBusy: false, pendingFloorPhase: 'waiting_for_animation' })).toBe(true);
    expect(isReplayStepBlocked({ isBusy: false, pendingFloorPhase: 'compiling_floor' })).toBe(true);
    expect(isReplayStepBlocked({ isBusy: false, pendingFloorPhase: 'compile_failed' })).toBe(true);
    expect(isReplayStepBlocked({ isBusy: false, pendingFloorPhase: 'applied' })).toBe(false);
    expect(isReplayStepBlocked({ isBusy: false, pendingFloorPhase: 'idle' })).toBe(false);
  });

  it('auto-resolves replay floor transitions without auto-resolving other pending intercepts', () => {
    expect(shouldAutoResolveReplayPendingFloor({
      isReplayMode: true,
      pendingStatus: { status: 'playing' },
      hasResolvePendingFloor: true
    })).toBe(true);

    expect(shouldAutoResolveReplayPendingFloor({
      isReplayMode: false,
      pendingStatus: { status: 'playing' },
      hasResolvePendingFloor: true
    })).toBe(false);

    expect(shouldAutoResolveReplayPendingFloor({
      isReplayMode: true,
      pendingStatus: { status: 'choosing_upgrade', shrineOptions: ['EXTRA_HP'] },
      hasResolvePendingFloor: true
    })).toBe(false);

    expect(shouldAutoResolveReplayPendingFloor({
      isReplayMode: true,
      pendingStatus: { status: 'playing' },
      hasResolvePendingFloor: false
    })).toBe(false);
  });
});
