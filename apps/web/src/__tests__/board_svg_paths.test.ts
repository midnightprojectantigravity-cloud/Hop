import { describe, expect, it } from 'vitest';
import { buildTranslatedPolygonPath, parseSvgPointList } from '../components/game-board/board-svg-paths';

describe('board svg path helpers', () => {
  it('parses an SVG point string into numeric vertices', () => {
    expect(parseSvgPointList('0,0 1.5,2 -3,4')).toEqual([
      { x: 0, y: 0 },
      { x: 1.5, y: 2 },
      { x: -3, y: 4 },
    ]);
  });

  it('builds a combined translated polygon path', () => {
    const polygon = parseSvgPointList('0,0 2,0 1,1');
    const path = buildTranslatedPolygonPath([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ], polygon);

    expect(path).toBe('M10 20 L12 20 L11 21 Z M30 40 L32 40 L31 41 Z');
  });
});
