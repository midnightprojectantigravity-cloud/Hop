import { describe, expect, it } from 'vitest';
import { hasClearLosInt, hexDistanceInt, hexRaycastInt } from '../generation';

describe('generation hex-int', () => {
    it('computes exact axial manhattan distance on integer cube space', () => {
        expect(hexDistanceInt({ q: 0, r: 0, s: 0 }, { q: 3, r: 0, s: -3 })).toBe(3);
        expect(hexDistanceInt({ q: 1, r: 2, s: -3 }, { q: 4, r: 1, s: -5 })).toBe(3);
    });

    it('raycasts deterministically without float interpolation', () => {
        const line = hexRaycastInt(
            { q: 0, r: 0, s: 0 },
            { q: 3, r: 0, s: -3 }
        );

        expect(line.map(point => ({ ...point, s: Object.is(point.s, -0) ? 0 : point.s }))).toEqual([
            { q: 0, r: 0, s: 0 },
            { q: 1, r: 0, s: -1 },
            { q: 2, r: 0, s: -2 },
            { q: 3, r: 0, s: -3 }
        ]);
    });

    it('treats intermediate blockers as line-of-sight breaks', () => {
        const blockers = new Set<string>(['1,0']);
        expect(
            hasClearLosInt(
                { q: 0, r: 0, s: 0 },
                { q: 3, r: 0, s: -3 },
                blockers
            )
        ).toBe(false);
        expect(
            hasClearLosInt(
                { q: 0, r: 0, s: 0 },
                { q: 3, r: 0, s: -3 },
                new Set<string>()
            )
        ).toBe(true);
    });
});
