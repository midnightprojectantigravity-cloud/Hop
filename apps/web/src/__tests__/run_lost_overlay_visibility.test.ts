import { describe, expect, it } from 'vitest';
import { resolveRunLostOverlayVisible } from '../app/run-lost-overlay-visibility';

describe('run lost overlay visibility', () => {
  it('stays hidden while the board is still busy', () => {
    expect(resolveRunLostOverlayVisible({
      gameStatus: 'lost',
      playerHp: 0,
      isBusy: true,
      delayElapsed: true
    })).toBe(false);
  });

  it('waits for the death delay when the player died', () => {
    expect(resolveRunLostOverlayVisible({
      gameStatus: 'lost',
      playerHp: 0,
      isBusy: false,
      delayElapsed: false
    })).toBe(false);
  });

  it('shows once the lethal beat has completed', () => {
    expect(resolveRunLostOverlayVisible({
      gameStatus: 'lost',
      playerHp: 0,
      isBusy: false,
      delayElapsed: true
    })).toBe(true);
  });

  it('shows immediately for non-lethal lost states', () => {
    expect(resolveRunLostOverlayVisible({
      gameStatus: 'lost',
      playerHp: 3,
      isBusy: false,
      delayElapsed: false
    })).toBe(true);
  });
});
