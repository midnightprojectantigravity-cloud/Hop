import { describe, expect, it } from 'vitest';
import {
  INITIAL_PENDING_FLOOR_WORLDGEN_STATE,
  reducePendingFloorWorldgenState,
} from '../app/pending-floor-worldgen-machine';

describe('pending floor worldgen machine', () => {
  it('enters waiting state for a new pending floor key', () => {
    const next = reducePendingFloorWorldgenState(INITIAL_PENDING_FLOOR_WORLDGEN_STATE, {
      type: 'SYNC_PENDING',
      active: true,
      key: 'floor-2'
    });

    expect(next).toEqual({
      phase: 'waiting_for_animation',
      key: 'floor-2'
    });
  });

  it('does not auto-reset a failed pending floor for the same key', () => {
    const failed = reducePendingFloorWorldgenState(INITIAL_PENDING_FLOOR_WORLDGEN_STATE, {
      type: 'COMPILE_FAILED',
      key: 'floor-2',
      error: 'compile failed'
    });
    const synced = reducePendingFloorWorldgenState(failed, {
      type: 'SYNC_PENDING',
      active: true,
      key: 'floor-2'
    });

    expect(synced).toEqual(failed);
  });

  it('allows an explicit retry transition after failure', () => {
    const failed = reducePendingFloorWorldgenState(INITIAL_PENDING_FLOOR_WORLDGEN_STATE, {
      type: 'COMPILE_FAILED',
      key: 'floor-2',
      error: 'compile failed'
    });
    const retried = reducePendingFloorWorldgenState(failed, {
      type: 'RETRY_REQUESTED',
      key: 'floor-2'
    });
    const compiling = reducePendingFloorWorldgenState(retried, {
      type: 'COMPILE_STARTED',
      key: 'floor-2'
    });

    expect(retried).toEqual({
      phase: 'waiting_for_animation',
      key: 'floor-2'
    });
    expect(compiling).toEqual({
      phase: 'compiling_floor',
      key: 'floor-2'
    });
  });

  it('resets to idle once the pending transition clears', () => {
    const applied = reducePendingFloorWorldgenState(INITIAL_PENDING_FLOOR_WORLDGEN_STATE, {
      type: 'COMPILE_SUCCEEDED',
      key: 'floor-2'
    });
    const cleared = reducePendingFloorWorldgenState(applied, {
      type: 'SYNC_PENDING',
      active: false
    });

    expect(cleared).toEqual(INITIAL_PENDING_FLOOR_WORLDGEN_STATE);
  });
});
