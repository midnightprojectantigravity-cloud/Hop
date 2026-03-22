import type { Actor as EntityType, MovementTrace, Point } from '@hop/engine';
import { getHexLine, hexEquals } from '@hop/engine';

export interface MovementPathResolution {
    path: Point[] | null;
    source: 'trace' | 'replay_fallback' | 'none';
    movementType?: MovementTrace['movementType'];
    hasMatchingTrace: boolean;
}

export interface MovementPathResolveOptions {
    // Strict live mode must stay engine-authoritative.
    // Replay compatibility may still use previousPosition fallback when old traces are absent.
    allowReplayFallback?: boolean;
}

export const resolveMovementPath = (
    entity: EntityType,
    movementTrace?: MovementTrace,
    options: MovementPathResolveOptions = {}
): MovementPathResolution => {
    const hasMatchingTrace = Boolean(
        movementTrace
        && movementTrace.actorId === entity.id
        && movementTrace.destination
        && hexEquals(movementTrace.destination as Point, entity.position)
        && Array.isArray(movementTrace.path)
        && movementTrace.path.length > 1
    );

    if (hasMatchingTrace && movementTrace?.path) {
        return {
            path: movementTrace.path as Point[],
            source: 'trace',
            movementType: movementTrace.movementType,
            hasMatchingTrace: true
        };
    }

    if (options.allowReplayFallback && entity.previousPosition && !hexEquals(entity.previousPosition, entity.position)) {
        const fallbackPath = getHexLine(entity.previousPosition, entity.position);
        if (fallbackPath.length > 1) {
            return {
                path: fallbackPath,
                source: 'replay_fallback',
                hasMatchingTrace: false
            };
        }
    }

    return {
        path: null,
        source: 'none',
        hasMatchingTrace: false
    };
};
