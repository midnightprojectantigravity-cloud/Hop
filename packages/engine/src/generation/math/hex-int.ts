import type { Point } from '../../types';

const divRoundNearest = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0;
    if (numerator >= 0) {
        return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
    }
    return -Math.floor((Math.abs(numerator) + Math.floor(denominator / 2)) / denominator);
};

const cubeRoundFromScaled = (
    qScaled: number,
    rScaled: number,
    sScaled: number,
    scale: number
): Point => {
    let q = divRoundNearest(qScaled, scale);
    let r = divRoundNearest(rScaled, scale);
    let s = divRoundNearest(sScaled, scale);

    const qDiff = Math.abs(q * scale - qScaled);
    const rDiff = Math.abs(r * scale - rScaled);
    const sDiff = Math.abs(s * scale - sScaled);

    if (qDiff > rDiff && qDiff > sDiff) {
        q = -r - s;
    } else if (rDiff > sDiff) {
        r = -q - s;
    } else {
        s = -q - r;
    }

    return { q, r, s };
};

export const toIntHex = (q: number, r: number): Point => ({ q, r, s: -q - r });

export const hexDistanceInt = (a: Point, b: Point): number => {
    return (
        Math.abs(a.q - b.q)
        + Math.abs((a.q + a.r) - (b.q + b.r))
        + Math.abs(a.r - b.r)
    ) / 2;
};

export const hexParity = (point: Point): 0 | 1 => ((point.q + point.r) & 1) as 0 | 1;

export const hexRaycastInt = (origin: Point, target: Point): Point[] => {
    const distance = hexDistanceInt(origin, target);
    if (distance === 0) return [{ q: origin.q, r: origin.r, s: origin.s }];

    const results: Point[] = [];
    const seen = new Set<string>();

    for (let step = 0; step <= distance; step++) {
        const qScaled = origin.q * (distance - step) + target.q * step;
        const rScaled = origin.r * (distance - step) + target.r * step;
        const sScaled = origin.s * (distance - step) + target.s * step;
        const point = cubeRoundFromScaled(qScaled, rScaled, sScaled, distance);
        const key = `${point.q},${point.r}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push(point);
    }

    return results;
};

export const hasClearLosInt = (
    origin: Point,
    target: Point,
    blockers: ReadonlySet<string>
): boolean => {
    const line = hexRaycastInt(origin, target);
    for (let i = 1; i < line.length - 1; i++) {
        if (blockers.has(`${line[i].q},${line[i].r}`)) return false;
    }
    return true;
};
