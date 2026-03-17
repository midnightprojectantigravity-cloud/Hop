import { describe, expect, it } from 'vitest';
import { resolveBoardCells } from '../components/GameBoard';

const hex = (q: number, r: number, s: number) => ({ q, r, s });

describe('resolveBoardCells', () => {
  it('prefers the tile map over room geometry when both exist', () => {
    const cells = resolveBoardCells({
      tiles: new Map([
        ['0,3', { position: hex(0, 3, -3) }],
        ['1,3', { position: hex(1, 3, -4) }]
      ]),
      rooms: [
        {
          hexes: [hex(4, 4, -8), hex(5, 4, -9)]
        }
      ],
      gridWidth: 8,
      gridHeight: 8,
      mapShape: 'rectangle'
    } as any);

    expect(cells).toEqual([hex(0, 3, -3), hex(1, 3, -4)]);
  });

  it('falls back to room geometry when the tile map is empty', () => {
    const cells = resolveBoardCells({
      tiles: new Map(),
      rooms: [
        {
          hexes: [hex(2, 2, -4), hex(3, 2, -5)]
        }
      ],
      gridWidth: 8,
      gridHeight: 8,
      mapShape: 'rectangle'
    } as any);

    expect(cells).toEqual([hex(2, 2, -4), hex(3, 2, -5)]);
  });
});
