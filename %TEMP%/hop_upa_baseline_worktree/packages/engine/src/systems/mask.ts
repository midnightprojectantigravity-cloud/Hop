import type { Point } from '../types';

/**
 * TODO: 
 * Ask about this file
 * 
 * MASK UTILITIES
 * Low-level bitmask operations for spatial hashing.
 * No dependencies on high-level state or helpers to avoid circular imports.
 */

export const createOccupancyMask = (_width: number, height: number): bigint[] => {
    return Array(height).fill(0n);
};

export const setOccupancy = (mask: bigint[], p: Point, value: boolean): bigint[] => {
    if (!Number.isInteger(p.q) || !Number.isInteger(p.r)) return [...mask];
    if (p.r < 0 || p.r >= mask.length || p.q < 0) return [...mask];
    const newMask = [...mask];
    if (value) {
        newMask[p.r] |= (1n << BigInt(p.q));
    } else {
        newMask[p.r] &= ~(1n << BigInt(p.q));
    }
    return newMask;
};

export const isOccupiedMask = (mask: bigint[], p: Point): boolean => {
    if (p.r < 0 || p.r >= mask.length) return true;
    return (mask[p.r] & (1n << BigInt(p.q))) !== 0n;
};
