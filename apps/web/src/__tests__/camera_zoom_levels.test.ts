import { describe, expect, it } from 'vitest';
import { resolveBinaryZoomLevels } from '../visual/camera';

describe('binary camera zoom levels', () => {
  it('uses the 7 / 11 minimum local-context floors on ample maps', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 21,
      mapHeight: 21,
      movementRange: 1
    });

    expect(levels.action).toBe(7);
    expect(levels.tactical).toBe(11);
  });

  it('expands action and tactical floors from movement range', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 30,
      mapHeight: 30,
      movementRange: 4
    });

    expect(levels.action).toBe(11);
    expect(levels.tactical).toBe(15);
  });

  it('caps both presets by the smaller map axis when the map is tiny', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 5,
      mapHeight: 5,
      movementRange: 16
    });

    expect(levels.action).toBe(5);
    expect(levels.tactical).toBe(5);
  });
});
