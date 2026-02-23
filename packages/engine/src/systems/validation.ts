import type { GameState, Point, Actor } from '../types';
import { hexEquals, getHexLine, hexDistance, getDirectionFromTo } from '../hex';
import { getActorAt } from '../helpers';
import { pointToKey } from '../hex';
import { UnifiedTileService } from './unified-tile-service';

/**
 * Validation System
 * Pure utility functions for validating grid positions, paths, and interactions.
 */

/**
 * Checks if a position is blocked by a wall tile.
 */
export function isBlockedByWall(state: GameState, position: Point): boolean {
    const tile = state.tiles.get(pointToKey(position));
    const blocksLOS = tile?.traits.has('BLOCKS_LOS') || tile?.baseId === 'WALL';
    return !!blocksLOS;
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
        if (result.position && !hexEquals(result.position, target)) {
            return { isValid: false, blockedBy: result.obstacle, blockedAt: result.position };
        }
    }

    return { isValid: true };
}

/**
 * Returns true if the first obstacle along the line is the target actor.
 * Useful for projectile targeting that must stop on the first actor.
 */
export function hasClearLineToActor(
    state: GameState,
    origin: Point,
    target: Point,
    targetActorId: string,
    excludeActorId?: string
): boolean {
    const line = getHexLine(origin, target);
    const pathToCheck = line.slice(1);
    const result = findFirstObstacle(state, pathToCheck, {
        checkWalls: true,
        checkActors: true,
        checkLava: false,
        excludeActorId
    });
    return result.obstacle === 'actor'
        && result.actor?.id === targetActorId
        && !!result.position
        && hexEquals(result.position, target);
}

/**
 * Hazard Policy Helpers (Targeting + Movement)
 */
export function isHazardousTile(state: GameState, position: Point): { isHazard: boolean; isFireHazard: boolean } {
    const traits = UnifiedTileService.getTraitsAt(state, position);
    const isHazard = traits.has('HAZARDOUS') || traits.has('LAVA') || traits.has('FIRE') || traits.has('VOID');
    const isFireHazard = traits.has('LAVA') || traits.has('FIRE');
    return { isHazard, isFireHazard };
}

export function canLandOnHazard(state: GameState, actor: Actor, position: Point): boolean {
    const { isHazard, isFireHazard } = isHazardousTile(state, position);
    if (!isHazard) return true;
    if (actor.isFlying) return true;
    const hasAbsorbFire = actor.activeSkills?.some(s => s.id === 'ABSORB_FIRE')
        || actor.statusEffects?.some(s => s.type === 'fire_immunity');
    if (hasAbsorbFire && isFireHazard) return true;
    return false;
}

export function canPassHazard(state: GameState, actor: Actor, position: Point, skillId: string): boolean {
    if (canLandOnHazard(state, actor, position)) return true;
    const passSkills = new Set(['JUMP', 'VAULT', 'GRAPPLE_HOOK', 'DASH']);
    return passSkills.has(skillId);
}
