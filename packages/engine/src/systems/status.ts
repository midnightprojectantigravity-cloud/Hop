import type { Actor } from '../types';

/**
 * Status System
 * Handles application, ticking, and querying of status effects.
 */

/**
 * Checks if an actor is currently stunned
 */
export function isStunned(actor: Actor): boolean {
    return actor.statusEffects?.some(s => s.type === 'stunned') ?? false;
}

/**
 * Checks if an actor is currently rooted
 */
export function isRooted(actor: Actor): boolean {
    return actor.statusEffects?.some(s => s.type === 'rooted') ?? false;
}

/**
 * Ticks down all status effects on an actor by the given amount (default 1)
 */
export function tickStatuses(actor: Actor, amount: number = 1): Actor {
    if (!actor.statusEffects || actor.statusEffects.length === 0) return actor;

    const nextStatuses = actor.statusEffects
        .map(s => ({ ...s, duration: s.duration - amount }))
        .filter(s => s.duration > 0);

    return {
        ...actor,
        statusEffects: nextStatuses
    };
}

/**
 * Clears actor intent if they are stunned
 */
export function handleStunReset(actor: Actor): Actor {
    if (isStunned(actor)) {
        return {
            ...actor,
            intent: undefined,
            intentPosition: undefined
        };
    }
    return actor;
}
