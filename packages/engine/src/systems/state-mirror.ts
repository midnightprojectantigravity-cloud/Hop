import type { GameState, Point } from '../types';
import { pointToKey } from '../hex';

export interface StateMirrorSnapshot {
    turn: number;
    stackTick: number;
    actors: Array<{
        id: string;
        position: Point;
    }>;
}

export interface StateMirrorMismatch {
    actorId: string;
    expected?: Point;
    actual?: Point;
    reason: 'missing_in_ui' | 'missing_in_engine' | 'position_mismatch';
}

export interface StateMirrorValidationResult {
    ok: boolean;
    mismatches: StateMirrorMismatch[];
}

const clonePoint = (p: Point): Point => ({ q: p.q, r: p.r, s: p.s });

export const buildEngineMirrorSnapshot = (state: GameState): StateMirrorSnapshot => {
    const actors = [
        state.player,
        ...state.enemies,
        ...(state.companions || []),
        ...(state.dyingEntities || [])
    ];

    return {
        turn: state.turnNumber || 0,
        stackTick: state.stackTrace?.length || 0,
        actors: actors.map(actor => ({
            id: actor.id,
            position: clonePoint(actor.position)
        }))
    };
};

export const validateStateMirrorSnapshot = (
    engineSnapshot: StateMirrorSnapshot,
    uiSnapshot: StateMirrorSnapshot
): StateMirrorValidationResult => {
    const mismatches: StateMirrorMismatch[] = [];
    const engineMap = new Map(engineSnapshot.actors.map(a => [a.id, a.position]));
    const uiMap = new Map(uiSnapshot.actors.map(a => [a.id, a.position]));

    for (const [actorId, expected] of engineMap.entries()) {
        const actual = uiMap.get(actorId);
        if (!actual) {
            mismatches.push({ actorId, expected, reason: 'missing_in_ui' });
            continue;
        }
        if (pointToKey(expected) !== pointToKey(actual)) {
            mismatches.push({ actorId, expected, actual, reason: 'position_mismatch' });
        }
    }

    for (const [actorId, actual] of uiMap.entries()) {
        if (!engineMap.has(actorId)) {
            mismatches.push({ actorId, actual, reason: 'missing_in_engine' });
        }
    }

    return {
        ok: mismatches.length === 0,
        mismatches
    };
};

