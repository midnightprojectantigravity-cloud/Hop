import type { Action, CombatRulesetVersion, GridSize, MapShape } from '../types';

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

export interface ReplayRunV3 {
    seed: string;
    initialSeed?: string;
    loadoutId?: string;
    startFloor?: number;
    mapSize?: GridSize;
    mapShape?: MapShape;
    mode?: 'normal' | 'daily';
    date?: string;
    combatVersion?: CombatRulesetVersion;
}

export interface ReplayMetaV3 {
    recordedAt: string;
    completedAt?: string;
    source?: 'client' | 'manual' | 'import';
    diagnostics?: {
        actionCount: number;
        hasTurnAdvance: boolean;
        hasPendingResolve: boolean;
        suspiciouslyShort: boolean;
    };
    final?: {
        score?: number;
        floor?: number;
        fingerprint?: string;
        gameStatus?: 'won' | 'lost';
    };
}

export interface ReplayEnvelopeV3 {
    version: 3;
    run: ReplayRunV3;
    actions: Action[];
    meta: ReplayMetaV3;
}

export interface ReplayActionValidationResult {
    valid: boolean;
    actions: Action[];
    errors: string[];
}

export interface ReplayEnvelopeValidationResult {
    valid: boolean;
    envelope?: ReplayEnvelopeV3;
    errors: string[];
}

export interface ReplayEnvelopeValidationOptions {
    maxActions?: number;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const isReplayRecordableAction = (candidate: unknown): candidate is Action => {
    if (!isObject(candidate) || typeof candidate.type !== 'string') return false;
    return REPLAYABLE_ACTION_TYPES.has(candidate.type as Action['type']);
};

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
        if (!isReplayRecordableAction(candidate)) {
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

export const validateReplayEnvelopeV3 = (
    payload: unknown,
    options: ReplayEnvelopeValidationOptions = {}
): ReplayEnvelopeValidationResult => {
    const errors: string[] = [];
    const maxActions = options.maxActions ?? 10_000;

    if (!isObject(payload)) {
        return {
            valid: false,
            errors: ['Replay payload must be an object.']
        };
    }

    if (payload.version !== 3) {
        errors.push('Replay payload version must be 3.');
    }

    const run = payload.run;
    if (!isObject(run)) {
        errors.push('Replay payload must include a run object.');
    } else {
        if (typeof run.seed !== 'string' || run.seed.trim().length === 0) {
            errors.push('Replay run.seed must be a non-empty string.');
        }
        if (run.initialSeed !== undefined && typeof run.initialSeed !== 'string') {
            errors.push('Replay run.initialSeed must be a string when provided.');
        }
        if (run.loadoutId !== undefined && typeof run.loadoutId !== 'string') {
            errors.push('Replay run.loadoutId must be a string when provided.');
        }
        if (run.startFloor !== undefined && (!Number.isInteger(run.startFloor) || Number(run.startFloor) < 1)) {
            errors.push('Replay run.startFloor must be a positive integer when provided.');
        }
        if (run.mapSize !== undefined) {
            if (!isObject(run.mapSize)) {
                errors.push('Replay run.mapSize must be an object when provided.');
            } else {
                const width = Number((run.mapSize as Record<string, unknown>).width);
                const height = Number((run.mapSize as Record<string, unknown>).height);
                if (!Number.isInteger(width) || width <= 0) {
                    errors.push('Replay run.mapSize.width must be a positive integer when provided.');
                }
                if (!Number.isInteger(height) || height <= 0) {
                    errors.push('Replay run.mapSize.height must be a positive integer when provided.');
                }
            }
        }
        if (run.mapShape !== undefined && run.mapShape !== 'diamond' && run.mapShape !== 'rectangle') {
            errors.push('Replay run.mapShape must be "diamond" or "rectangle" when provided.');
        }
        if (run.mode !== undefined && run.mode !== 'normal' && run.mode !== 'daily') {
            errors.push('Replay run.mode must be "normal" or "daily" when provided.');
        }
        if (run.date !== undefined && typeof run.date !== 'string') {
            errors.push('Replay run.date must be a string when provided.');
        }
        if (run.combatVersion !== undefined && run.combatVersion !== 'trinity_ratio_v2') {
            errors.push('Replay run.combatVersion must be "trinity_ratio_v2" when provided.');
        }
    }

    const actionValidation = validateReplayActions(payload.actions);
    if (!actionValidation.valid) {
        errors.push(...actionValidation.errors);
    }
    if (Array.isArray(payload.actions) && payload.actions.length > maxActions) {
        errors.push(`Replay actions exceed max limit (${maxActions}).`);
    }

    const meta = payload.meta;
    if (!isObject(meta)) {
        errors.push('Replay payload must include a meta object.');
    } else if (typeof meta.recordedAt !== 'string' || meta.recordedAt.trim().length === 0) {
        errors.push('Replay meta.recordedAt must be a non-empty string.');
    }

    if (errors.length > 0) {
        return {
            valid: false,
            errors
        };
    }

    return {
        valid: true,
        envelope: {
            version: 3,
            run: run as ReplayRunV3,
            actions: actionValidation.actions,
            meta: meta as ReplayMetaV3
        },
        errors: []
    };
};
