import { describe, expect, it } from 'vitest';
import { TILE_SIZE, createHex, hexToPixel, pointToKey } from '@hop/engine';
import {
  isWorldPointInsideHex,
  resolveBoardHexAtWorldPoint,
} from '../components/game-board/board-hit-testing';

const createLookup = (...hexes: ReturnType<typeof createHex>[]) =>
  new Map(hexes.map((hex) => [pointToKey(hex), hex]));

describe('board hit testing', () => {
  it('resolves the board tile at a hex center', () => {
    const target = createHex(2, 1);
    const lookup = createLookup(createHex(0, 0), target, createHex(1, 2));
    const worldPoint = hexToPixel(target, TILE_SIZE);

    expect(resolveBoardHexAtWorldPoint(worldPoint, lookup)).toEqual(target);
  });

  it('returns null for points that land in off-board space', () => {
    const lookup = createLookup(createHex(0, 0));
    const missingHexCenter = hexToPixel(createHex(1, 0), TILE_SIZE);

    expect(resolveBoardHexAtWorldPoint(missingHexCenter, lookup)).toBeNull();
  });

  it('treats points inside the visible hex footprint as hits', () => {
    const origin = createHex(0, 0);
    const center = hexToPixel(origin, TILE_SIZE);

    expect(isWorldPointInsideHex(center, origin)).toBe(true);
    expect(
      isWorldPointInsideHex(
        { x: center.x + TILE_SIZE * 1.1, y: center.y },
        origin,
      ),
    ).toBe(false);
  });
});
