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
    const x = size * (3 / 2 * hex.q);
    const y = size * (Math.sqrt(3) / 2 * hex.q + Math.sqrt(3) * hex.r);
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

export const getGridCells = (radius: number): Point[] => {
    const cells: Point[] = [];
    for (let q = -radius; q <= radius; q++) {
        const r1 = Math.max(-radius, -q - radius);
        const r2 = Math.min(radius, -q + radius);
        for (let r = r1; r <= r2; r++) {
            cells.push(createHex(q, r));
        }
    }
    return cells;
};

/**
 * Generate a rectangular grid of flat-top hexes
 * width = number of columns
 * height = number of rows
 */
export const getRectangularGrid = (width: number, height: number): Point[] => {
    const cells: Point[] = [];
    for (let q = 0; q < width; q++) {
        const qOffset = Math.floor(q / 2);
        for (let r = -qOffset; r < height - qOffset; r++) {
            cells.push(createHex(q, r));
        }
    }
    return cells;
};

/**
 * Check if a hex is within a rectangular grid of flat-top hexes
 */
export const isHexInRectangularGrid = (hex: Point, width: number, height: number): boolean => {
    if (hex.q < 0 || hex.q >= width) return false;
    const qOffset = Math.floor(hex.q / 2);
    return hex.r >= -qOffset && hex.r < height - qOffset;
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
