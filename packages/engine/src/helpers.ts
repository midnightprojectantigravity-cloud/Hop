/**
 * STATELESS HELPERS
 * Pure utility functions for grid and entity queries.
 * TODO: Prioritize bitmask checks (spatial.ts) in isOccupied/isWalkable for high-performance loops.
 */
import type { GameState, Point, Entity, Actor } from './types';
import { hexEquals, isHexInRectangularGrid, hexDistance, pointToKey } from './hex';
import { applyDamage } from './systems/actor';



/**
 * Determines if a point is a special tile (stairs, shrine, or hazardous).
 * Primarily used during map generation.
 */
import { UnifiedTileService } from './systems/unified-tile-service';

export const isSpecialTile = (
    point: Point,
    state: {
        playerStart?: Point;
        stairsPosition?: Point;
        shrinePosition?: Point;
        lavaPositions?: Point[];
        wallPositions?: Point[];
        tiles?: any;
        gridWidth?: number;
        gridHeight?: number;
    }
): boolean => {
    if (state.playerStart && hexEquals(point, state.playerStart)) return true;
    if (state.stairsPosition && hexEquals(point, state.stairsPosition)) return true;
    if (state.shrinePosition && hexEquals(point, state.shrinePosition)) return true;
    if (state.lavaPositions?.some(lp => hexEquals(lp, point))) return true;
    if (state.wallPositions?.some(wp => hexEquals(wp, point))) return true;

    if (state.tiles) {
        const traits = UnifiedTileService.getTraitsAt(state as any, point);
        if (traits.has('HAZARDOUS') || traits.has('BLOCKS_MOVEMENT')) return true;
    }

    return false;
};



/**
 * Checks if a position is occupied by an enemy.
 */
export const getEnemyAt = (
    enemies: Entity[],
    position: Point
): Entity | undefined => {
    if (!enemies) return undefined;
    return enemies.find(e => e && e.position && hexEquals(e.position, position));
};

/**
 * Gets the actor (player or enemy) at a position.
 */
export const getActorAt = (state: GameState, position: Point): Entity | undefined => {
    if (hexEquals(state.player.position, position)) return state.player;
    return getEnemyAt(state.enemies, position);
};

import { isOccupiedMask } from './systems/mask';

/**
 * Checks if a position is occupied by another actor.
 * Uses bitmask for performance (Strict Occupancy).
 */
export const isOccupied = (
    position: Point,
    state: GameState
): boolean => {
    // Spatial mask check is O(1)
    if (state.occupancyMask) {
        return isOccupiedMask(state.occupancyMask, position);
    }
    // Fallback for safety
    return !!getActorAt(state, position);
};

/**
 * Check if the player is on a shrine.
 */
export const checkShrine = (
    state: GameState,
    position: Point
): boolean => {
    return !!state.shrinePosition && hexEquals(position, state.shrinePosition);
};

/**
 * Check if the player is on stairs.
 */
export const checkStairs = (
    state: GameState,
    position: Point
): boolean => {
    if (!hexEquals(position, state.stairsPosition)) return false;

    // Boss Lock: If the Sentinel is alive, you cannot leave the floor
    const bossAlive = state.enemies.some(e => e.subtype === 'sentinel' && e.hp > 0);
    if (bossAlive) return false;

    return true;
};

/**
 * Checks if a position is on the grid perimeter (boundary).
 */
export const isPerimeter = (
    position: Point,
    width: number,
    height: number
): boolean => {
    if (position.q === 0 || position.q === width - 1) return true;
    if (position.r === 0 || position.r === height - 1) return true;

    const sum = position.q + position.r;
    const topLimit = Math.floor(width / 2);
    const bottomLimit = (width - 1) + (height - 1) - topLimit;

    if (sum === topLimit || sum === bottomLimit) return true;

    return false;
};



/**
 * Resolves an ID to an Actor object from the GameState.
 */
export const getActorById = (state: GameState, id: string, attacker: Actor): Actor | undefined => {
    if (id === attacker.id || id === 'self') return attacker;
    return state.enemies.find(e => e.id === id);
};

/**
 * Returns the immediate threat zone (AoE) for a skill given a target hex.
 * This does not run the full simulation, just projects the danger area.
 */
export const getSkillAoE = (
    state: GameState,
    _skillId: string,
    origin: Point,
    target: Point
): Point[] => {
    // For now, most skills are axial/linear.
    // DASH/BASH follow a straight line from origin through target.
    const dist = hexDistance(origin, target);
    if (dist === 0) return [];

    // Direction vector
    const dq = (target.q - origin.q) / dist;
    const dr = (target.r - origin.r) / dist;
    const ds = (target.s - origin.s) / dist;

    // Projected thread line (e.g., 2 hexes beyond impact)
    const result: Point[] = [];
    const seen = new Set<string>();

    const projectionDistance = 2; // Default "danger zone" beyond impact
    for (let i = 1; i <= projectionDistance; i++) {
        const projection = {
            q: target.q + Math.round(dq * i),
            r: target.r + Math.round(dr * i),
            s: target.s + Math.round(ds * i)
        };
        if (isHexInRectangularGrid(projection, state.gridWidth, state.gridHeight)) {
            const key = `${projection.q},${projection.r}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(projection);
            }
        }
    }
    return result;
};
