import type { GameState, Point, Actor } from '../types';
import { hexEquals, getHexLine, hexDistance, getDirectionFromTo } from '../hex';
import { isPerimeter, getActorAt } from '../helpers';
import { pointToKey } from './tile-migration';

/**
 * Validation System
 * Pure utility functions for validating grid positions, paths, and interactions.
 */

/**
 * Checks if a position is blocked by a wall or is on the perimeter.
 */
export function isBlockedByWall(state: GameState, position: Point): boolean {
    const tile = state.tiles.get(pointToKey(position));
    const blocksLOS = tile?.traits.has('BLOCKS_LOS') || tile?.baseId === 'WALL';
    return blocksLOS || isPerimeter(position, state.gridWidth, state.gridHeight);
}

/**
 * Checks if a position is blocked by lava.
 */
export function isBlockedByLava(state: GameState, position: Point): boolean {
    const tile = state.tiles.get(pointToKey(position));
    return tile?.baseId === 'LAVA' || tile?.traits.has('LIQUID') || false;
}


/**
 * Checks if a position is blocked by an actor (optionally excluding one).
 */
export function isBlockedByActor(state: GameState, position: Point, excludeId?: string): boolean {
    const actor = getActorAt(state, position);
    return !!actor && actor.id !== excludeId;
}

/**
 * Validates if the target is within a certain range from the origin.
 */
export function validateRange(origin: Point, target: Point, range: number): boolean {
    const dist = hexDistance(origin, target);
    return dist >= 1 && dist <= range;
}

/**
 * Validates if the target is in an axial direction from the origin.
 */
export function validateAxialDirection(origin: Point, target: Point): { isAxial: boolean; directionIndex: number } {
    const directionIndex = getDirectionFromTo(origin, target);
    return {
        isAxial: directionIndex !== -1,
        directionIndex
    };
}

/**
 * Finds the first obstacle along a path.
 */
export function findFirstObstacle(state: GameState, path: Point[], options: {
    checkWalls?: boolean;
    checkActors?: boolean;
    checkLava?: boolean;
    excludeActorId?: string;
} = {}): { obstacle?: 'wall' | 'actor' | 'lava'; position?: Point; actor?: Actor } {
    const { checkWalls = true, checkActors = true, checkLava = false, excludeActorId } = options;

    for (const point of path) {
        if (checkWalls && isBlockedByWall(state, point)) {
            return { obstacle: 'wall', position: point };
        }
        if (checkLava && isBlockedByLava(state, point)) {
            return { obstacle: 'lava', position: point };
        }
        if (checkActors) {
            const actor = getActorAt(state, point);
            if (actor && actor.id !== excludeActorId) {
                return { obstacle: 'actor', position: point, actor };
            }
        }
    }

    return {};
}

/**
 * Validates line-of-sight between two points.
 */
export function validateLineOfSight(state: GameState, origin: Point, target: Point, options: {
    stopAtWalls?: boolean;
    stopAtActors?: boolean;
    stopAtLava?: boolean;
    excludeActorId?: string;
} = {}): { isValid: boolean; blockedBy?: 'wall' | 'actor' | 'lava'; blockedAt?: Point } {
    const line = getHexLine(origin, target);
    // Ignore start, check up to target
    const pathToCheck = line.slice(1);

    const { stopAtWalls = true, stopAtActors = true, stopAtLava = false, excludeActorId } = options;

    const result = findFirstObstacle(state, pathToCheck, {
        checkWalls: stopAtWalls,
        checkActors: stopAtActors,
        checkLava: stopAtLava,
        excludeActorId
    });

    if (result.obstacle) {
        // If we hit something BEFORE the target, or IF we care about hitting the target itself
        // Usually LOS means "can I reach the target". 
        // If target IS the obstacle, it's valid for LOS (you can see what you hit).
        // But if there's an obstacle BETWEEN, then it's invalid.
        if (result.position && !hexEquals(result.position, target)) {
            return { isValid: false, blockedBy: result.obstacle, blockedAt: result.position };
        }
    }

    return { isValid: true };
}
