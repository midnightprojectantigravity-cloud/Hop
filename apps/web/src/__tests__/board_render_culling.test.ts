import { describe, expect, it } from 'vitest';
import type { CameraRect } from '../visual/camera';
import {
  filterVisibleByHexPosition,
  isHexPositionVisibleInViewBox,
} from '../components/game-board/board-render-culling';

describe('board render culling', () => {
  const viewBox: CameraRect = {
    x: 100,
    y: 100,
    width: 240,
    height: 240,
  };

  it('keeps nearby hexes and excludes far offscreen hexes', () => {
    const near = { q: 4, r: 4, s: -8 };
    const far = { q: 14, r: 14, s: -28 };

    expect(isHexPositionVisibleInViewBox(near, viewBox)).toBe(true);
    expect(isHexPositionVisibleInViewBox(far, viewBox)).toBe(false);
  });

  it('filters positioned records by camera window', () => {
    const items = [
      { id: 'near', position: { q: 4, r: 4, s: -8 } },
      { id: 'edge', position: { q: 6, r: 3, s: -9 } },
      { id: 'far', position: { q: 14, r: 14, s: -28 } },
    ];

    expect(filterVisibleByHexPosition(items, (item) => item.position, viewBox).map((item) => item.id)).toEqual([
      'near',
      'edge',
    ]);
  });
});
