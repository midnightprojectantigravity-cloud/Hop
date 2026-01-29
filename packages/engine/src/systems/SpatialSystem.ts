/**
 * SPATIAL SYSTEM
 * Unified source of truth for all grid-based queries, navigation, and occupancy bitmasks.
 */
import type { GameState, Point } from '../types';
import { pointToKey } from '../hex';
import {
    hexAdd,
    hexEquals,
    scaleVector,
    createHex,
    isHexInRectangularGrid,
    getNeighbors as hexNeighbors
} from '../hex';
import { getActorAt } from '../helpers';
// Ensure these helpers in mask.ts support bigint[] (Array of bitmasks)
import { createOccupancyMask, setOccupancy, isOccupiedMask } from './mask';
import { UnifiedTileService } from './unified-tile-service';

export const SpatialSystem = {
    /**
     * SINGLE SOURCE OF TRUTH FOR NEIGHBORS
     */
    getNeighbors(pos: Point): Point[] {
        return hexNeighbors(pos);
    },

    /**
     * Bitmask occupancy check
     * FIXED: Ensure we pass the bigint[] to the mask helper
     */
    isTileBlocked(state: GameState, p: Point): boolean {
        // If occupancyMask is undefined or empty, default to not blocked
        if (!state.occupancyMask || state.occupancyMask.length === 0) return false;
        return isOccupiedMask(state.occupancyMask, p);
    },

    /**
     * Walkability check (Environment only)
     */
    // isWalkable(state: GameState, pos: Point): boolean {
    //     const tile = state.tiles.get(pointToKey(pos));
    //     if (!tile) return false;
    //     // Walkable tiles must have the trait and NOT be blocked
    //     return tile.traits.has('WALKABLE') && !tile.traits.has('BLOCKS_MOVEMENT');
    // },

    /**
     * Refresh occupancy mask (Units + Solid Environment)
     * FIXED: Returns bigint[] to satisfy GameState interface
     */
    refreshOccupancyMask(state: GameState): bigint[] {
        // createOccupancyMask should return bigint[] based on grid dimensions
        let mask = createOccupancyMask(state.gridWidth, state.gridHeight);

        // 1. Environmental Blockers
        state.tiles?.forEach(tile => {
            if (tile.baseId === 'WALL' || tile.traits?.has('BLOCKS_LOS')) {
                mask = setOccupancy(mask, tile.position, true);
            }
        });

        // 2. Player Occupancy
        if (state.player) {
            mask = setOccupancy(mask, state.player.position, true);
        }

        // 3. Enemy Occupancy
        state.enemies?.forEach(e => {
            mask = setOccupancy(mask, e.position, true);
        });

        return mask;
    },

    /**
     * BFS Movement Range Calculation
     */
    getMovementRange(state: GameState, origin: Point, movePoints: number): Point[] {
        const visited = new Map<string, number>();
        const out: Point[] = [];
        const key = (p: Point) => `${p.q},${p.r}`;

        const q: Array<{ p: Point; cost: number }> = [{ p: origin, cost: 0 }];
        visited.set(key(origin), 0);

        while (q.length) {
            const cur = q.shift()!;
            if (cur.cost >= movePoints) continue;

            for (const n of this.getNeighbors(cur.p)) {
                if (!this.isWithinBounds(state, n)) continue;
                if (!UnifiedTileService.isWalkable(state, n)) continue;

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
    },

    /**
     * Axial/Linear Targeting Search
     */
    getAxialTargets(state: GameState, origin: Point, range: number, options: {
        includeWalls?: boolean;
        includeActors?: boolean;
        stopAtObstacles?: boolean;
    } = {}): Point[] {
        const { includeWalls = false, includeActors = true, stopAtObstacles = true } = options;
        const valid: Point[] = [];

        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const coord = hexAdd(origin, scaleVector(d, i));
                if (!this.isWithinBounds(state, coord)) break;

                const tile = UnifiedTileService.getTileAt(state, coord);
                const isWall = tile?.baseId === 'WALL';
                const actor = getActorAt(state, coord);

                if (isWall) {
                    if (includeWalls) valid.push(coord);
                    if (stopAtObstacles) break;
                } else if (actor) {
                    if (includeActors) valid.push(coord);
                    if (stopAtObstacles) break;
                } else {
                    valid.push(coord);
                }
            }
        }
        return valid;
    },

    /**
     * Area of Effect (AOE) circular query
     */
    getAreaTargets(state: GameState, center: Point, radius: number): Point[] {
        const targets: Point[] = [];
        for (let q = -radius; q <= radius; q++) {
            for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r++) {
                const coord = hexAdd(center, createHex(q, r));
                if (this.isWithinBounds(state, coord)) {
                    targets.push(coord);
                }
            }
        }
        return targets;
    },

    /**
     * Grid bounds check
     */
    isWithinBounds(state: GameState, p: Point): boolean {
        return isHexInRectangularGrid(p, state.gridWidth, state.gridHeight);
    },

    /** Legacy Alias */
    getAxialTargetsWithOptions(state: GameState, origin: Point, range: number, options?: any): Point[] {
        return this.getAxialTargets(state, origin, range, options);
    }
};

export default SpatialSystem;
