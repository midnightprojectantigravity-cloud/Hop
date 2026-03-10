import { describe, expect, it } from 'vitest';
import { resolveBinaryZoomLevels } from '../visual/camera';

describe('binary camera zoom levels', () => {
  it('uses map-wide tactical bounds and minimum action width', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 9,
      mapHeight: 11,
      movementRange: 1
    });

    expect(levels.tactical).toBe(23);
    expect(levels.action).toBe(9);
  });

  it('expands action view with movement range', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 11,
      mapHeight: 13,
      movementRange: 4
    });

    expect(levels.tactical).toBe(27);
    expect(levels.action).toBe(11);
  });

  it('never lets action exceed tactical', () => {
    const levels = resolveBinaryZoomLevels({
      mapWidth: 5,
      mapHeight: 5,
      movementRange: 16
    });

    expect(levels.tactical).toBe(15);
    expect(levels.action).toBe(15);
  });
});
