import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import { addStatus } from '../entities/actor';

export const syncDisplacementEffects = (
    syncActorPosition: (actorId: string | undefined, destination: Point | undefined) => void,
    displacementEffects: AtomicEffect[]
): void => {
    for (const effect of displacementEffects) {
        if (effect.type !== 'Displacement') continue;
        if (typeof effect.target !== 'string') continue;
        syncActorPosition(effect.target === 'self' ? undefined : effect.target, effect.destination);
    }
};

export const createBombActorId = (
    attacker: Actor,
    state: GameState,
    position: Point
): string =>
    `bomb-${attacker.id}-${state.turnNumber}-${state.actionLog?.length ?? 0}-${position.q}_${position.r}_${position.s}`;

export const applyInitialStatuses = (
    actor: Actor,
    initialStatuses: Array<{ status: any; duration: number }> | undefined
): Actor => {
    if (!initialStatuses || initialStatuses.length === 0) return actor;
    return initialStatuses.reduce(
        (nextActor, status) => addStatus(nextActor, status.status, status.duration),
        actor
    );
};
