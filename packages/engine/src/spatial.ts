/**
 * SPATIAL HASHING SYSTEM
 * Goal 3: High-performance grid occupancy via BigInt bitmasks.
 * Allows for constant-time lookups in high-frequency AI loops.
 * TODO: Implement "Multi-layer Masks" to separate walls, enemies, and hazards.
 */
import type { GameState, Point } from './types';

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
