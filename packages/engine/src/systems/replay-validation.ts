import type { Action } from '../types';

export const REPLAYABLE_ACTION_TYPES = new Set<Action['type']>([
    'MOVE',
    'THROW_SPEAR',
    'WAIT',
    'USE_SKILL',
    'JUMP',
    'SHIELD_BASH',
    'ATTACK',
    'LEAP',
    'ADVANCE_TURN',
    'SELECT_UPGRADE',
    'RESOLVE_PENDING'
]);

export interface ReplayActionValidationResult {
    valid: boolean;
    actions: Action[];
    errors: string[];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const validateReplayActions = (actions: unknown): ReplayActionValidationResult => {
    if (!Array.isArray(actions)) {
        return {
            valid: false,
            actions: [],
            errors: ['Replay actions must be an array.']
        };
    }

    const validActions: Action[] = [];
    const errors: string[] = [];

    actions.forEach((candidate, index) => {
        if (!isObject(candidate) || typeof candidate.type !== 'string') {
            errors.push(`Action[${index}] is not a valid action object with a "type" field.`);
            return;
        }
        if (!REPLAYABLE_ACTION_TYPES.has(candidate.type as Action['type'])) {
            errors.push(`Action[${index}] type "${candidate.type}" is not replayable.`);
            return;
        }
        validActions.push(candidate as Action);
    });

    return {
        valid: errors.length === 0,
        actions: validActions,
        errors
    };
};

