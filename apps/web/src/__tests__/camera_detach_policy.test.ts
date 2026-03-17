import { describe, expect, it } from 'vitest';
import {
  hasMaterialCameraInsetChange,
  hasMaterialCameraViewportChange,
  shouldResetDetachedCamera
} from '../components/game-board/useBoardPresentationController';

describe('camera detach policy', () => {
  it('resets detached state after committed actions', () => {
    expect(shouldResetDetachedCamera({
      wasDetached: true,
      prevActionLogLength: 4,
      nextActionLogLength: 5
    })).toBe(true);
  });

  it('resets detached state on zoom mode changes and floor transitions', () => {
    expect(shouldResetDetachedCamera({
      wasDetached: true,
      prevZoomMode: 'tactical',
      nextZoomMode: 'action'
    })).toBe(true);

    expect(shouldResetDetachedCamera({
      wasDetached: true,
      prevFloor: 2,
      nextFloor: 3
    })).toBe(true);
  });

  it('treats ten percent viewport changes as material', () => {
    expect(hasMaterialCameraViewportChange(
      { width: 1000, height: 800 },
      { width: 1100, height: 800 }
    )).toBe(true);
    expect(hasMaterialCameraViewportChange(
      { width: 1000, height: 800 },
      { width: 1075, height: 800 }
    )).toBe(false);
  });

  it('treats large safe-inset shifts as material', () => {
    expect(hasMaterialCameraInsetChange(
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 0, right: 12, bottom: 0, left: 0 }
    )).toBe(true);
    expect(hasMaterialCameraInsetChange(
      { top: 0, right: 0, bottom: 0, left: 0 },
      { top: 0, right: 4, bottom: 0, left: 0 }
    )).toBe(false);
  });
});
