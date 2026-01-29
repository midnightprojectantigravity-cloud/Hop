/**
 * HEX GEOMETRY ENGINE
 * Axiomatic hex math implementation. Pure functions only.
 */
import type { Point } from './types';

export const createHex = (q: number, r: number): Point => ({ q, r, s: -q - r });

/**
 * Single source of truth for coordinate keys.
 * ALWAYS uses axial coordinates (q, r).
 */
export const getHexKey = (pos: Point): string => `${pos.q},${pos.r}`;
export const pointToKey = getHexKey;

export const hexEquals = (a: Point, b: Point): boolean => a.q === b.q && a.r === b.r && a.s === b.s;

export const hexAdd = (a: Point, b: Point): Point => createHex(a.q + b.q, a.r + b.r);

export const hexSubtract = (a: Point, b: Point): Point => createHex(a.q - b.q, a.r - b.r);
export const hexNegate = (a: Point): Point => createHex(-a.q, -a.r);

export const hexDistance = (a: Point, b: Point): number => {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
};

export const hexToPixel = (hex: Point, size: number): { x: number; y: number } => {
    const x = size * (3 / 2 * hex.q);
    const y = size * Math.sqrt(3) * (hex.r + hex.q / 2);
    return { x, y };
};

export interface Cube { q: number; r: number; s: number; }

export const axialToCube = (hex: Point): Cube => ({ q: hex.q, r: hex.r, s: hex.s ?? -hex.q - hex.r });

export const cubeToAxial = (cube: Cube): Point => createHex(cube.q, cube.r);

export const cubeRound = (frac: Cube): Cube => {
    let q = Math.round(frac.q);
    let r = Math.round(frac.r);
    let s = Math.round(frac.s);

    const qDiff = Math.abs(q - frac.q);
    const rDiff = Math.abs(r - frac.r);
    const sDiff = Math.abs(s - frac.s);

    if (qDiff > rDiff && qDiff > sDiff) {
        q = -r - s;
    } else if (rDiff > sDiff) {
        r = -q - s;
    } else {
        s = -q - r;
    }

    return { q, r, s };
};

export const DIRECTIONS = [
    createHex(1, 0), createHex(1, -1), createHex(0, -1),
    createHex(-1, 0), createHex(-1, 1), createHex(0, 1)
];

export const getNeighbors = (hex: Point): Point[] => DIRECTIONS.map(d => hexAdd(hex, d));

export const hexDirection = (dir: number): Point => DIRECTIONS[((dir % 6) + 6) % 6];

export const hexLerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Precise line drawing using cube interpolation.
 * Essential for straight-line skill validation (Grapple, Spear).
 */
export const getHexLine = (start: Point, end: Point): Point[] => {
    const dist = hexDistance(start, end);
    const results: Point[] = [];
    const a = axialToCube(start);
    const b = axialToCube(end);

    for (let i = 0; i <= dist; i++) {
        const t = dist === 0 ? 0 : i / dist;
        const currentCube = {
            q: hexLerp(a.q + 1e-6, b.q + 1e-6, t),
            r: hexLerp(a.r + 1e-6, b.r + 1e-6, t),
            s: hexLerp(a.s + 1e-6, b.s + 1e-6, t)
        };
        results.push(cubeToAxial(cubeRound(currentCube)));
    }
    return results;
};

/**
 * Returns tiles strictly between p1 and p2. 
 * Re-implemented using the precise getHexLine to ensure hazard detection sync.
 */
export const getPathBetween = (p1: Point, p2: Point): Point[] => {
    const line = getHexLine(p1, p2);
    if (line.length <= 2) return [];
    return line.slice(1, -1);
};

export const getDirectionFromTo = (start: Point, end: Point): number => {
    const dist = hexDistance(start, end);
    if (dist === 0) return -1;
    const diff = hexSubtract(end, start);

    // Normalize and check for strict axial alignment
    const dq = diff.q / dist;
    const dr = diff.r / dist;
    const ds = (0 - diff.q - diff.r) / dist;

    return DIRECTIONS.findIndex(d =>
        Math.abs(d.q - dq) < 0.01 &&
        Math.abs(d.r - dr) < 0.01 &&
        Math.abs(d.s - ds) < 0.01
    );
};

export function scaleVector(dirIdx: number, mag: number): Point {
    const dir = hexDirection(dirIdx);
    return { q: dir.q * mag, r: dir.r * mag, s: -(dir.q * mag) - (dir.r * mag) };
}

/**
 * Dynamic Coordinate Mask for "Stretched Diamond" geometry.
 * Shaves top-left and bottom-right corners of the W x H parallelogram.
 */
export const isTileInDiamond = (q: number, r: number, width: number, height: number): boolean => {
    if (q < 0 || q >= width || r < 0 || r >= height) return false;

    const sum = q + r;

    // For the 9x11 Tutorial Standard: q+r must be between 4 and 14
    // This shaves the corners of the axial parallelogram to create a balanced diamond.
    const topLimit = Math.floor(width / 2); // e.g., 4 for width 9
    const bottomLimit = (width - 1) + (height - 1) - topLimit; // e.g., 8 + 10 - 4 = 14 for 9x11

    return sum >= topLimit && sum <= bottomLimit;
};

/**
 * Generate a diamond-shaped grid (shaved axial parallelogram)
 */
export const getDiamondGrid = (width: number, height: number): Point[] => {
    const cells: Point[] = [];
    for (let q = 0; q < width; q++) {
        for (let r = 0; r < height; r++) {
            if (isTileInDiamond(q, r, width, height)) {
                cells.push(createHex(q, r));
            }
        }
    }
    return cells;
};

/**
 * Bounds check for the "Stretched Diamond" geometry
 */
export const isHexInRectangularGrid = (hex: Point, width: number, height: number): boolean => {
    return isTileInDiamond(hex.q, hex.r, width, height);
};
