/**
 * STATELESS HELPERS
 * Pure utility functions for grid and entity queries.
 * TODO: Prioritize bitmask checks (spatial.ts) in isOccupied/isWalkable for high-performance loops.
 */
import type { GameState, Point, Entity, Actor } from './types';
import { hexEquals, isHexInRectangularGrid, hexDistance, pointToKey } from './hex';
import { applyDamage } from './systems/actor';



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
    state: GameState
): boolean => {
    if (!isHexInRectangularGrid(position, state.gridWidth, state.gridHeight)) return false;

    const tile = state.tiles.get(pointToKey(position));
    if (!tile) return true;

    if (tile.traits.has('BLOCKS_MOVEMENT') || tile.baseId === 'WALL') return false;
    if (tile.traits.has('WALKABLE') || tile.baseId === 'ICE') return true;

    // Lava is typically non-walkable in most engines unless flying/jumping
    if (tile.baseId === 'LAVA') return false;

    return true;
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
 * Apply lava damage to a given position. Returns the new Entity and any messages.
 * @deprecated Use TileResolver.processStay/Enter instead
 */
export const applyLavaDamage = (
    state: GameState,
    position: Point,
    entityIn?: Entity
): { entity: Entity; messages: string[] } => {
    const messages: string[] = [];
    let entity = entityIn ?? state.player;

    const hasImmunity = entity.statusEffects.some(s => s.type === 'fire_immunity');
    if (hasImmunity) return { entity, messages };

    const tile = state.tiles.get(pointToKey(position));
    if (tile?.baseId === 'LAVA' || tile?.traits.has('LIQUID')) {
        // Lava is instant death for enemies, heavy damage for player
        const damage = entity.type === 'player' ? 1 : 99;
        entity = applyDamage(entity, damage);
        messages.push(`${entity.type === 'player' ? 'You were' : (entity.subtype || entity.type) + ' was'} engulfed by lava!`);
    }
    return { entity, messages };
};

/**
 * Apply void damage to a given position. Returns the new Entity and any messages.
 * @deprecated Use TileResolver.processStay/Enter instead
 */
export const applyVoidDamage = (
    state: GameState,
    position: Point,
    entityIn?: Entity
): { entity: Entity; messages: string[] } => {
    const messages: string[] = [];
    let entity = entityIn ?? state.player;

    const tile = state.tiles.get(pointToKey(position));
    if (tile?.baseId === 'VOID') {
        const damage = entity.type === 'player' ? 1 : 99;
        entity = applyDamage(entity, damage);
        messages.push(`${entity.type === 'player' ? 'Void consumes you' : 'Void consumes ' + (entity.subtype || entity.type)}!`);
    }
    return { entity, messages };
};

/**
 * Apply fire damage to a given position. Returns the new Entity and any messages.
 * @deprecated Use TileResolver.processStay/Enter instead
 */
export const applyFireDamage = (
    state: GameState,
    position: Point,
    entityIn?: Entity
): { entity: Entity; messages: string[] } => {
    const messages: string[] = [];
    let entity = entityIn ?? state.player;

    const hasImmunity = entity.statusEffects.some(s => s.type === 'fire_immunity');
    if (hasImmunity) return { entity, messages };

    const tile = state.tiles.get(pointToKey(position));
    if (tile?.effects.some(e => e.id === 'FIRE')) {
        entity = applyDamage(entity, 1);
        messages.push(`${entity.type === 'player' ? 'You are' : (entity.subtype || entity.type) + ' is'} burning!`);
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
 * Checks if a point is within the grid bounds.
 */
export const isWithinBounds = (state: GameState, p: Point): boolean => {
    return isHexInRectangularGrid(p, state.gridWidth, state.gridHeight);
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
    const projectionDistance = 2; // Default "danger zone" beyond impact
    for (let i = 1; i <= projectionDistance; i++) {
        const projection = {
            q: target.q + Math.round(dq * i),
            r: target.r + Math.round(dr * i),
            s: target.s + Math.round(ds * i)
        };
        if (isHexInRectangularGrid(projection, state.gridWidth, state.gridHeight)) {
            result.push(projection);
        }
    }
    return result;
};
