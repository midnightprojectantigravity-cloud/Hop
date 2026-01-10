import { describe, it, expect } from 'vitest';
import { createHex, hexDistance, getNeighbors } from '@hop/engine/hex';

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
});
