import { describe, it, expect } from 'vitest';
import { createHex, hexDistance, getNeighbors, getGridCells } from '../game/hex';

describe('hex utilities', () => {
  it('distance between same hex is zero and neighbors distance 1', () => {
    const center = createHex(0, 0);
    expect(hexDistance(center, center)).toBe(0);
    const neigh = getNeighbors(center);
    expect(neigh.length).toBe(6);
    for (const n of neigh) {
      expect(hexDistance(center, n)).toBe(1);
    }
  });

  it('grid cell counts match expected formula', () => {
    // formula: 1 + 3*r*(r+1)
    const r = 2;
    const cells = getGridCells(r);
    const expected = 1 + 3 * r * (r + 1);
    expect(cells.length).toBe(expected);
  });
});
