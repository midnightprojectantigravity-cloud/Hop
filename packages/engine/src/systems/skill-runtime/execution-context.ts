import { consumeRandom } from '../rng';
import type { Actor, GameState, Point } from '../../types';
import type { PointResolutionContext } from './point-resolution';
import type { ResolutionTrace, ResolutionTraceEntry, ResolutionTraceMode } from './types';

export const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

export const createTrace = (mode: ResolutionTraceMode): ResolutionTrace => ({
    mode,
    entries: []
});

export const appendTrace = (trace: ResolutionTrace, entry: ResolutionTraceEntry): void => {
    if (trace.mode === 'none') return;
    trace.entries.push(entry);
};

export const resolveActorLabel = (
    actor: Actor,
    state: GameState
): string => actor.id === state.player.id
    ? 'You'
    : `${actor.subtype || 'enemy'}#${actor.id}`;

export const consumeRuntimeRandom = (context: PointResolutionContext): number => {
    const { value, nextState } = consumeRandom(context.rngState);
    context.rngState = nextState;
    context.rngConsumption += 1;
    return value;
};

export const syncActorPosition = (
    context: PointResolutionContext,
    actorId: string | undefined,
    destination: Point | undefined
): void => {
    if (!actorId || !destination) return;
    context.actorPositions.set(actorId, clonePoint(destination));
};
