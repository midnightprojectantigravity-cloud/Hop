import { describe, expect, it } from 'vitest';
import { resolveBinaryZoomLevels } from '../visual/camera';

describe('binary camera zoom levels', () => {
  it('caps tactical/action by the smaller map axis when LoS is unavailable', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 9,
      mapHeight: 11,
      movementRange: 1
    });

    expect(levels.tactical).toBe(9);
    expect(levels.action).toBe(7);
  });

  it('binds tactical zoom to LoS but still caps by smaller map axis', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 11,
      mapHeight: 13,
      movementRange: 4,
      losRange: 6
    });

    expect(levels.tactical).toBe(11);
    expect(levels.action).toBe(11);
  });

  it('never lets action exceed tactical when smaller-axis cap is tighter than movement/LoS', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 5,
      mapHeight: 5,
      movementRange: 16,
      losRange: 3
    });

    expect(levels.tactical).toBe(5);
    expect(levels.action).toBe(5);
  });

  it('uses movement range plus 1-hex buffer with 7-diameter minimum', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 21,
      mapHeight: 21,
      movementRange: 2,
      losRange: 10
    });

    expect(levels.action).toBe(7);
  });
});
