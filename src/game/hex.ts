import type { Point } from './types';

export const createHex = (q: number, r: number): Point => ({ q, r, s: -q - r });

export const hexEquals = (a: Point, b: Point): boolean => a.q === b.q && a.r === b.r && a.s === b.s;

export const hexAdd = (a: Point, b: Point): Point => createHex(a.q + b.q, a.r + b.r);

export const hexSubtract = (a: Point, b: Point): Point => createHex(a.q - b.q, a.r - b.r);

export const hexDistance = (a: Point, b: Point): number => {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
};

export const hexToPixel = (hex: Point, size: number): { x: number; y: number } => {
    // Flat-top hex projection
    // Each column (q) is shifted vertically by 0.5 hex height (sqrt(3)/2 * size)
    // x = size * 3/2 * q
    // y = size * sqrt(3) * (r + q/2)
    const x = size * (3 / 2 * hex.q);
    const y = size * Math.sqrt(3) * (hex.r + hex.q / 2);
    return { x, y };
};

// Directions for neighbors (axial)
const DIRECTIONS = [
    createHex(1, 0), createHex(1, -1), createHex(0, -1),
    createHex(-1, 0), createHex(-1, 1), createHex(0, 1)
];

export const getNeighbors = (hex: Point): Point[] => {
    return DIRECTIONS.map(d => hexAdd(hex, d));
};

/**
 * Dynamic Coordinate Mask for "Stretched Diamond" geometry.
 * Shaves top-left and bottom-right corners of the W x H parallelogram.
 */
export const isTileInDiamond = (q: number, r: number, width: number, height: number): boolean => {
    if (q < 0 || q >= width || r < 0 || r >= height) return false;

    const sum = q + r;
    // Hard reset limits based on user's specific 9x11 constraints:
    // q + r > 3 (min 4) and q + r < 15 (max 14)
    const topLimit = 4;
    const bottomLimit = 14;

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

export const hexDirection = (dir: number): Point => DIRECTIONS[dir % 6];

export const getHexLine = (start: Point, end: Point): Point[] => {
    const dist = hexDistance(start, end);
    const results: Point[] = [];
    for (let i = 0; i <= dist; i++) {
        const t = dist === 0 ? 0 : i / dist;
        const q = start.q + (end.q - start.q) * t;
        const r = start.r + (end.r - start.r) * t;
        results.push(createHex(Math.round(q), Math.round(r)));
    }
    return results;
};
