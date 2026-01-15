/**
 * SPATIAL HASHING SYSTEM
 * Goal 3: High-performance grid occupancy via BigInt bitmasks.
 * Allows for constant-time lookups in high-frequency AI loops.
 * TODO: Implement "Multi-layer Masks" to separate walls, enemies, and hazards.
 */
import type { GameState, Point } from './types';
import { getNeighbors } from './hex';
import { isHexInRectangularGrid } from './hex';
import { isWalkable, isOccupied } from './helpers';

/**
 * Initialize an empty occupancy mask for the grid.
 */
export const createOccupancyMask = (_width: number, height: number): bigint[] => {
    return Array(height).fill(0n);
};

/**
 * Set a position in the bitmask.
 */
export const setOccupancy = (mask: bigint[], p: Point, value: boolean): bigint[] => {
    const newMask = [...mask];
    if (value) {
        newMask[p.r] |= (1n << BigInt(p.q));
    } else {
        newMask[p.r] &= ~(1n << BigInt(p.q));
    }
    return newMask;
};

/**
 * Check if a position is occupied using the bitmask.
 */
export const isOccupiedMask = (mask: bigint[], p: Point): boolean => {
    if (p.r < 0 || p.r >= mask.length) return true;
    return (mask[p.r] & (1n << BigInt(p.q))) !== 0n;
};

/**
 * Refresh the entire occupancy mask from the current state.
 */
export const refreshOccupancyMask = (state: GameState): bigint[] => {
    let mask = createOccupancyMask(state.gridWidth, state.gridHeight);

    // Add Walls
    state.wallPositions.forEach(p => {
        mask = setOccupancy(mask, p, true);
    });

    // Add Player
    mask = setOccupancy(mask, state.player.position, true);

    // Add Enemies
    state.enemies.forEach(e => {
        mask = setOccupancy(mask, e.position, true);
    });

    return mask;
};

/**
 * Compute reachable tiles from `origin` within `movePoints` using BFS/Dijkstra
 * respecting walls, lava, and other units. Returns a set of Points (excluding origin).
 */
export const getMovementRange = (state: GameState, origin: Point, movePoints: number): Point[] => {
    const visited = new Map<string, number>();
    const out: Point[] = [];

    const key = (p: Point) => `${p.q},${p.r},${p.s}`;

    // Simple queue for BFS (since all costs are 1)
    const q: Array<{ p: Point; cost: number }> = [{ p: origin, cost: 0 }];

    while (q.length) {
        const cur = q.shift()!;
        const k = key(cur.p);
        if (visited.has(k) && visited.get(k)! <= cur.cost) continue;
        visited.set(k, cur.cost);

        if (cur.cost > 0) out.push(cur.p);
        if (cur.cost >= movePoints) continue;

        for (const n of getNeighbors(cur.p)) {
            if (!isHexInRectangularGrid(n, state.gridWidth, state.gridHeight)) continue;
            if (!isWalkable(n, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight)) continue;
            if (isOccupied(n, state)) continue;
            const nk = key(n);
            if (visited.has(nk) && visited.get(nk)! <= cur.cost + 1) continue;
            q.push({ p: n, cost: cur.cost + 1 });
        }
    }

    return out;
};
