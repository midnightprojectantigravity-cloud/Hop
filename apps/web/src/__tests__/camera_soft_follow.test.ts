import { describe, expect, it } from 'vitest';
import { resolveSoftFollowCenter } from '../visual/camera';

describe('camera soft follow', () => {
  it('stays still when desired center is inside dead-zone', () => {
    const center = resolveSoftFollowCenter({
      currentCenter: { x: 0, y: 0 },
      desiredCenter: { x: 10, y: 0 },
      visibleWorldSize: { width: 100, height: 100 },
      bounds: { x: -100, y: -100, width: 200, height: 200 },
      deadZoneRatio: 0.2,
      followStrength: 0.5,
      maxStepRatio: 0.2
    });

    expect(center).toEqual({ x: 0, y: 0 });
  });

  it('moves toward desired center with capped step', () => {
    const center = resolveSoftFollowCenter({
      currentCenter: { x: 0, y: 0 },
      desiredCenter: { x: 80, y: 0 },
      visibleWorldSize: { width: 100, height: 100 },
      bounds: { x: -200, y: -200, width: 400, height: 400 },
      deadZoneRatio: 0.2,
      followStrength: 0.5,
      maxStepRatio: 0.12
    });

    expect(center.x).toBeCloseTo(12, 5);
    expect(center.y).toBeCloseTo(0, 5);
  });

  it('clamps soft follow center inside map bounds', () => {
    const center = resolveSoftFollowCenter({
      currentCenter: { x: 0, y: 0 },
      desiredCenter: { x: 500, y: 500 },
      visibleWorldSize: { width: 100, height: 100 },
      bounds: { x: 0, y: 0, width: 120, height: 120 },
      deadZoneRatio: 0.05,
      followStrength: 1,
      maxStepRatio: 1
    });

    expect(center.x).toBeLessThanOrEqual(70);
    expect(center.y).toBeLessThanOrEqual(70);
    expect(center.x).toBeGreaterThanOrEqual(50);
    expect(center.y).toBeGreaterThanOrEqual(50);
  });
});
