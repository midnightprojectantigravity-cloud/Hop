import type { Actor, GameState, Point } from '../../types';
import type { EmitJuiceInstruction, RuntimePathRef } from './types';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';

export const resolveJuiceMetadata = (
    metadata: Record<string, unknown> | undefined,
    instruction: EmitJuiceInstruction,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: Pick<PointResolutionDependencies, 'resolvePointRef'> & {
        resolvePathPenultimatePoint: (pathRef: RuntimePathRef | undefined, attacker: Actor, state: GameState, context: PointResolutionContext) => Point | undefined;
    }
): Record<string, unknown> | undefined => {
    const nextMetadata = metadata ? { ...metadata } : {};

    if (instruction.contactHexRef) {
        const point = deps.resolvePointRef(instruction.contactHexRef, attacker, state, context);
        if (point) nextMetadata.contactHex = point;
    }
    if (instruction.contactToRef) {
        const point = deps.resolvePointRef(instruction.contactToRef, attacker, state, context);
        if (point) nextMetadata.contactToHex = point;
    }
    if (instruction.contactFromRef) {
        const point = deps.resolvePointRef(instruction.contactFromRef, attacker, state, context);
        if (point) nextMetadata.contactFromHex = point;
    }
    if (instruction.contactFromPathRef) {
        const point = deps.resolvePathPenultimatePoint(instruction.contactFromPathRef, attacker, state, context);
        if (point) nextMetadata.contactFromHex = point;
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
};
