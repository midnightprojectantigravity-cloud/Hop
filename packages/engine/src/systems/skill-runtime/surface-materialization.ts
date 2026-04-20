import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';

export const materializePlaceSurfaceInstruction = (
    instruction: {
        target: any;
        pointSet?: any;
        pointPattern?: any;
        targetFanOut?: any;
        pointFilters?: any;
        surface?: string;
        duration?: number;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: PointResolutionDependencies['resolvePointRef'],
    resolveInstructionPoints: (
        pointSet: any,
        pointPattern: any,
        fanOut: any,
        pointFilters: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext,
        deps: PointResolutionDependencies
    ) => Point[],
    pointResolutionDeps: PointResolutionDependencies
): AtomicEffect[] => {
    const position = resolvePointRef(instruction.target, attacker, state, context);
    const positions = instruction.target === 'selected_hex'
        ? resolveInstructionPoints(
            instruction.pointSet,
            instruction.pointPattern,
            instruction.targetFanOut,
            instruction.pointFilters,
            attacker,
            state,
            context,
            pointResolutionDeps
        )
        : (position ? [position] : []);
    const effects: AtomicEffect[] = [];
    if (instruction.surface === 'fire') {
        for (const surfacePoint of positions) {
            effects.push({
                type: 'PlaceFire',
                position: surfacePoint,
                duration: instruction.duration ?? 0
            });
        }
    }
    return effects;
};
