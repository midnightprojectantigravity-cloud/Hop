/**
 * SPATIAL HASHING SYSTEM
 * Goal 3: High-performance grid occupancy via BigInt bitmasks.
 * Allows for constant-time lookups in high-frequency AI loops.
 * TODO: Implement "Multi-layer Masks" to separate walls, enemies, and hazards.
 */
import type { GameState, Point } from '../types';
import { getNeighbors, isHexInRectangularGrid, hexEquals } from '../hex';
import { isWalkable, getActorAt } from '../helpers';
import { createOccupancyMask, setOccupancy, isOccupiedMask } from './mask';

/**
 * Refresh the entire occupancy mask from the current state.
 * Strict Occupancy: Units, Player, and "Solid" items (Bombs) share the mask.
 */
export const refreshOccupancyMask = (state: GameState): bigint[] => {
    let mask = createOccupancyMask(state.gridWidth, state.gridHeight);

    // 1. Add Environment (Walls are ALWAYS solid)
    state.tiles.forEach(tile => {
        if (tile.baseId === 'WALL' || tile.traits.has('BLOCKS_LOS')) {
            mask = setOccupancy(mask, tile.position, true);
        }
    });


    // 2. Add Player
    mask = setOccupancy(mask, state.player.position, true);

    // 3. Add Enemies & Solid Subtypes (Bombs)
    state.enemies.forEach(e => {
        mask = setOccupancy(mask, e.position, true);
    });

    return mask;
};

/**
 * High-performance bitwise check for occupancy.
 */
export const isTileBlocked = (state: GameState, p: Point): boolean => {
    return isOccupiedMask(state.occupancyMask, p);
};

/**
 * Compute reachable tiles from `origin` within `movePoints` using BFS/Dijkstra
 * respecting walls, lava, and other units. Returns a set of Points (excluding origin).
 */
export const getMovementRange = (state: GameState, origin: Point, movePoints: number): Point[] => {
    const visited = new Map<string, number>();
    const out: Point[] = [];
    const key = (p: Point) => `${p.q},${p.r},${p.s}`;

    const q: Array<{ p: Point; cost: number }> = [{ p: origin, cost: 0 }];
    visited.set(key(origin), 0);

    while (q.length) {
        const cur = q.shift()!;

        if (cur.cost >= movePoints) continue;

        for (const n of getNeighbors(cur.p)) {
            // 1. Boundary Check
            if (!isHexInRectangularGrid(n, state.gridWidth, state.gridHeight)) continue;

            // 2. Wall/Lava Check (Environment)
            if (!isWalkable(n, state.wallPositions, state.lavaPositions, state.gridWidth, state.gridHeight, state)) continue;


            // 3. THE FIX: Occupancy Check
            // We only care if SOMEONE ELSE is there. 
            // If we check isOccupied(n) and 'n' is where we are moving, 
            // it must be empty of OTHER actors.
            const occupant = getActorAt(state, n);
            if (occupant && !hexEquals(n, origin)) continue;

            const nk = key(n);
            const newCost = cur.cost + 1;

            if (!visited.has(nk) || visited.get(nk)! > newCost) {
                visited.set(nk, newCost);
                out.push(n);
                q.push({ p: n, cost: newCost });
            }
        }
    }

    return out;
};
