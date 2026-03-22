import type { Actor } from '../types';
import type { StatusID } from '../types/registry';

export const ACTION_PHASE_CONTROL_STATUSES = new Set<StatusID>(['stunned']);
export const MOVEMENT_INTERDICTION_STATUSES = new Set<StatusID>(['rooted']);
export const SOFT_DEBUFF_STATUSES = new Set<StatusID>(['blinded']);

export const isActionPhaseControlStatus = (status: StatusID): boolean => ACTION_PHASE_CONTROL_STATUSES.has(status);
export const isMovementInterdictionStatus = (status: StatusID): boolean => MOVEMENT_INTERDICTION_STATUSES.has(status);
export const isSoftDebuffStatus = (status: StatusID): boolean => SOFT_DEBUFF_STATUSES.has(status);
export const isControlTelemetryStatus = (status: StatusID): boolean =>
    isActionPhaseControlStatus(status) || isMovementInterdictionStatus(status);

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
        .map(s => {
            if (s.durationModel === 'action_phase') return s;
            return { ...s, duration: s.duration - amount };
        })
        .filter(s => s.duration > 0);

    return {
        ...actor,
        statusEffects: nextStatuses
    };
}

export function consumeActionPhaseStatuses(actor: Actor, phase: 'ACTION' | 'MOVE_AND_ACTION' = 'ACTION'): Actor {
    if (!actor.statusEffects || actor.statusEffects.length === 0) return actor;
    const nextStatuses = actor.statusEffects
        .map(status => {
            if (status.durationModel !== 'action_phase') return status;
            if (status.consumedOnPhase && status.consumedOnPhase !== phase) return status;
            const remainingActionPhases = Math.max(0, Number(status.remainingActionPhases ?? status.duration ?? 0) - 1);
            return {
                ...status,
                remainingActionPhases,
                duration: remainingActionPhases
            };
        })
        .filter(status => {
            if (status.durationModel !== 'action_phase') return status.duration > 0;
            return Math.max(0, Number(status.remainingActionPhases ?? status.duration ?? 0)) > 0;
        });

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
