/**
 * HEX GEOMETRY ENGINE
 * Axiomatic hex math implementation. Pure functions only.
 */
import type { MapShape, Point } from './types';

export const createHex = (q: number, r: number): Point => ({ q, r, s: -q - r });
export const DEFAULT_MAP_SHAPE: MapShape = 'diamond';

export const isMapShape = (shape: unknown): shape is MapShape =>
    shape === 'diamond' || shape === 'rectangle';

/**
 * Single source of truth for coordinate keys.
 * ALWAYS uses axial coordinates (q, r).
 */
const getHexKey = (pos: Point): string => `${pos.q},${pos.r}`;
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

const getDiamondSumBounds = (
    width: number,
    height: number
): { minSum: number; maxSum: number } => {
    const maxSum = (width - 1) + (height - 1);
    const topLimit = Math.floor(width / 2);
    return {
        minSum: topLimit,
        maxSum: maxSum - topLimit
    };
};

const getRectangleRowBounds = (
    q: number,
    width: number,
    height: number
): { minR: number; maxR: number } | null => {
    if (q < 0 || q >= width || width <= 0 || height <= 0) return null;
    const offset = Math.floor((width - 1) / 2);
    const qOffset = Math.floor(q / 2);
    const minR = offset - qOffset;
    const maxR = (height - 1) - qOffset;
    if (minR < 0 || maxR < 0 || minR > maxR) return null;
    return { minR, maxR };
};

export const getMapRowBoundsForColumn = (
    q: number,
    width: number,
    height: number,
    mapShape: MapShape = DEFAULT_MAP_SHAPE
): { minR: number; maxR: number } | null => {
    if (mapShape === 'rectangle') {
        return getRectangleRowBounds(q, width, height);
    }

    if (q < 0 || q >= width || height <= 0) return null;
    const { minSum, maxSum } = getDiamondSumBounds(width, height);
    const minR = Math.max(0, minSum - q);
    const maxR = Math.min(height - 1, maxSum - q);
    return minR > maxR ? null : { minR, maxR };
};

export const isTileInDiamond = (q: number, r: number, width: number, height: number): boolean => {
    if (q < 0 || q >= width || r < 0 || r >= height) return false;
    const sum = q + r;
    const bounds = getDiamondSumBounds(width, height);
    return sum >= bounds.minSum && sum <= bounds.maxSum;
};

/**
 * Rectangle shape mask in positive-only axial coordinates.
 * Clips top-left and bottom-right corners by column index so every column
 * has the same count of playable rows.
 */
export const isTileInRectangle = (q: number, r: number, width: number, height: number): boolean => {
    if (q < 0 || q >= width || r < 0 || r >= height) return false;
    const bounds = getRectangleRowBounds(q, width, height);
    if (!bounds) return false;
    return r >= bounds.minR && r <= bounds.maxR;
};

export const isTileInMapShape = (
    q: number,
    r: number,
    width: number,
    height: number,
    mapShape: MapShape = DEFAULT_MAP_SHAPE
): boolean => {
    if (mapShape === 'rectangle') {
        return isTileInRectangle(q, r, width, height);
    }
    return isTileInDiamond(q, r, width, height);
};

/**
 * Generate a diamond-shaped grid (shaved axial parallelogram)
 */
export const getDiamondGrid = (width: number, height: number): Point[] => {
    return getGridForShape(width, height, 'diamond');
};

export const getGridForShape = (
    width: number,
    height: number,
    mapShape: MapShape = DEFAULT_MAP_SHAPE
): Point[] => {
    const cells: Point[] = [];
    for (let q = 0; q < width; q++) {
        for (let r = 0; r < height; r++) {
            if (isTileInMapShape(q, r, width, height, mapShape)) {
                cells.push(createHex(q, r));
            }
        }
    }
    return cells;
};

/**
 * Bounds check for the "Stretched Diamond" geometry
 */
export const isHexInRectangularGrid = (
    hex: Point,
    width: number,
    height: number,
    mapShape: MapShape = DEFAULT_MAP_SHAPE
): boolean => {
    return isTileInMapShape(hex.q, hex.r, width, height, mapShape);
};
