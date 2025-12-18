import type { Point } from './types';

export const createHex = (q: number, r: number): Point => ({ q, r, s: -q - r });

export const hexEquals = (a: Point, b: Point): boolean => a.q === b.q && a.r === b.r && a.s === b.s;

export const hexAdd = (a: Point, b: Point): Point => createHex(a.q + b.q, a.r + b.r);

export const hexSubtract = (a: Point, b: Point): Point => createHex(a.q - b.q, a.r - b.r);

export const hexDistance = (a: Point, b: Point): number => {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.s - b.s)) / 2;
};

export const hexToPixel = (hex: Point, size: number): { x: number; y: number } => {
    const x = size * (Math.sqrt(3) * hex.q + (Math.sqrt(3) / 2) * hex.r);
    const y = size * ((3 / 2) * hex.r);
    return { x, y };
};

// Directions for neighbors
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
