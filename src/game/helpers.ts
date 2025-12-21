// src/game/helpers.ts

import type { GameState, Point, Entity } from './types';
import { hexEquals } from './hex';
import { applyDamage } from './actor';

/**
 * Determines if a point is a special tile (player start, stairs, shrine, or lava).
 */
export const isSpecialTile = (
    point: Point,
    stairsPos: Point,
    shrinePos?: Point,
    lavaPositions?: Point[]
): boolean => {
    if (hexEquals(point, createHex(0, 0))) return true; // player start
    if (hexEquals(point, stairsPos)) return true;
    if (shrinePos && hexEquals(point, shrinePos)) return true;
    if (lavaPositions && lavaPositions.some(lp => hexEquals(lp, point))) return true;
    return false;
};

/**
 * Apply lava damage to a given position. Returns the new HP and any messages.
 */
export const applyLavaDamage = (
    state: GameState,
    position: Point,
    playerIn?: Entity
): { player: Entity; messages: string[] } => {
    const messages: string[] = [];
    let player = playerIn ?? state.player;
    if (state.lavaPositions.some(lp => hexEquals(lp, position))) {
        player = applyDamage(player, 1);
        messages.push('Burned by lava!');
    }
    return { player, messages };
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

/** Helper to create the origin hex (0,0). */
const createHex = (q: number, r: number) => ({ q, r, s: -q - r });
