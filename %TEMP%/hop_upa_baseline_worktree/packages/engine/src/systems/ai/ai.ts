/**
 * ENEMY AI SYSTEM (runtime wrapper)
 * Enemy planning and intent adaptation live under `systems/ai/enemy/*`.
 */
import type { Entity, Point, GameState } from '../../types';
import { decideEnemyIntent as decideEnemyIntentFromSelector, selectEnemyDecision } from './enemy/selector';
import {
    registerEnemySubtypePolicyHandler,
    type EnemyPolicyHandler,
    type EnemyPlannerResult,
} from './enemy/policies';
import type { EnemyAiContext } from './enemy/types';

/**
 * Get the direction from one hex to another (0-5)
 */
const getDirectionTo = (from: Point, to: Point): number => {
    const dq = to.q - from.q;
    const dr = to.r - from.r;

    if (dq > 0 && dr === 0) return 0;
    if (dq > 0 && dr < 0) return 1;
    if (dq === 0 && dr < 0) return 2;
    if (dq < 0 && dr === 0) return 3;
    if (dq < 0 && dr > 0) return 4;
    return 5;
};

/**
 * Check if attack is from front of shield bearer
 */
export const isBlockedByShield = (enemy: Entity, attackerPos: Point): boolean => {
    if (enemy.subtype !== 'shieldBearer' || enemy.facing === undefined) return false;

    const attackDirection = getDirectionTo(enemy.position, attackerPos);
    const diff = Math.abs(attackDirection - enemy.facing);
    return diff <= 1 || diff >= 5;
};

export type EnemyActionResult = EnemyPlannerResult;
export type EnemyAiHandler = EnemyPolicyHandler;

export const registerEnemySubtypeAiHandler = (subtype: string, handler: EnemyAiHandler) => {
    registerEnemySubtypePolicyHandler(subtype, handler);
};

/**
 * Compute an enemy's next move/intent given the player's position and the current state.
 * Returns a new Entity instance (do not mutate input).
 */
export const computeEnemyAction = (bt: Entity, playerMovedTo: Point, state: GameState & { occupiedCurrentTurn?: Point[] }): EnemyActionResult => {
    const context: EnemyAiContext = {
        enemy: bt,
        playerPos: playerMovedTo,
        state
    };
    const selected = selectEnemyDecision(context);
    return {
        entity: selected.plannedEntity,
        nextState: selected.nextState,
        ...(selected.message !== undefined ? { message: selected.message } : {})
    };
};

export const decideEnemyIntent = (bt: Entity, playerMovedTo: Point, state: GameState & { occupiedCurrentTurn?: Point[] }) => {
    const context: EnemyAiContext = {
        enemy: bt,
        playerPos: playerMovedTo,
        state
    };
    return decideEnemyIntentFromSelector(context);
};
