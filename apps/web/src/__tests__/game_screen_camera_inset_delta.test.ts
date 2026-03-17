import { describe, expect, it } from 'vitest';
import { hasMaterialCameraInsetDelta } from '../app/GameScreen';

describe('game screen camera inset delta', () => {
  it('ignores inset changes below the larger pixel or ratio threshold', () => {
    expect(hasMaterialCameraInsetDelta(
      { right: 10 },
      { right: 25 },
      { width: 1000, height: 800 },
    )).toBe(false);
  });

  it('treats larger inset changes as material', () => {
    expect(hasMaterialCameraInsetDelta(
      { right: 10 },
      { right: 31 },
      { width: 1000, height: 800 },
    )).toBe(true);
    expect(hasMaterialCameraInsetDelta(
      { top: 0 },
      { top: 14 },
      { width: 500, height: 400 },
    )).toBe(true);
  });
});
