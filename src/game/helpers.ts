// src/game/helpers.ts

import type { GameState, Point, Entity } from './types';
import { hexEquals, isHexInRectangularGrid } from './hex';
import { applyDamage } from './actor';
import { GRID_WIDTH, GRID_HEIGHT } from './constants';

/**
 * Determines if a point is a special tile (player start, stairs, shrine, lava, or wall).
 * This is primarily used during map generation to avoid overlapping key elements.
 */
export const isSpecialTile = (
    point: Point,
    specialPositions: {
        playerStart?: Point;
        stairsPosition: Point;
        shrinePosition?: Point;
        lavaPositions?: Point[];
        wallPositions?: Point[];
    }
): boolean => {
    if (specialPositions.playerStart && hexEquals(point, specialPositions.playerStart)) return true;
    if (hexEquals(point, specialPositions.stairsPosition)) return true;
    if (specialPositions.shrinePosition && hexEquals(point, specialPositions.shrinePosition)) return true;
    if (specialPositions.lavaPositions?.some(lp => hexEquals(lp, point))) return true;
    if (specialPositions.wallPositions?.some(wp => hexEquals(wp, point))) return true;
    return false;
};

/**
 * Checks if a position is walkable (exists in grid and is not a wall or lava).
 */
export const isWalkable = (
    position: Point,
    wallPositions: Point[],
    lavaPositions: Point[]
): boolean => {
    const isWall = wallPositions?.some(w => hexEquals(w, position));
    if (isWall) return false;
    const isLava = lavaPositions?.some(l => hexEquals(l, position));
    if (isLava) return false;
    return isHexInRectangularGrid(position, GRID_WIDTH, GRID_HEIGHT);
};

/**
 * Checks if a position is occupied by another actor.
 */
export const isOccupied = (
    position: Point,
    state: GameState
): boolean => {
    if (hexEquals(state.player.position, position)) return true;
    return state.enemies.some(e => hexEquals(e.position, position));
};

/**
 * Checks if a position is occupied by an enemy.
 */
export const getEnemyAt = (
    enemies: Entity[],
    position: Point
): Entity | undefined => {
    return enemies.find(e => hexEquals(e.position, position));
};

/**
 * Apply lava damage to a given position. Returns the new Entity and any messages.
 */
export const applyLavaDamage = (
    state: GameState,
    position: Point,
    entityIn?: Entity
): { entity: Entity; messages: string[] } => {
    const messages: string[] = [];
    let entity = entityIn ?? state.player;
    if (state.lavaPositions.some(lp => hexEquals(lp, position))) {
        // Lava is instant death for enemies, heavy damage for player
        const damage = entity.type === 'player' ? 1 : 99;
        entity = applyDamage(entity, damage);
        messages.push(`${entity.type === 'player' ? 'You were' : entity.subtype + ' was'} engulfed by lava!`);
    }
    return { entity, messages };
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
    return hexEquals(position, state.stairsPosition);
};
