import type { Actor, GameState, Point } from '../../types';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';
import type { EmitJuiceInstruction } from './types';
import { resolveJuiceMetadata } from './juice-resolution';
import { resolvePathPenultimatePoint, resolvePathRef, resolveDirectionFromPath } from './path-resolution';

export const materializeEmitJuiceInstruction = (
    instruction: EmitJuiceInstruction & {
        pointPattern?: any;
        targetFanOut?: any;
        pointFilters?: any;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
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
): Array<any> => {
    const pointTargets = instruction.pointSet
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
        : [];
    const actorTarget = instruction.targetActor
        ? pointResolutionDeps.resolveActorRef(instruction.targetActor, attacker, state, context)
        : undefined;
    const juiceTargets = pointTargets.length > 0
        ? pointTargets
        : [instruction.target ? pointResolutionDeps.resolvePointRef(instruction.target, attacker, state, context) : undefined]
            .filter((value): value is Point => !!value);
    const path = resolvePathRef(instruction.pathRef, attacker, state, context, pointResolutionDeps.resolvePointRef);
    const direction = instruction.direction
        || (instruction.directionRef
            ? pointResolutionDeps.resolvePointRef(instruction.directionRef, attacker, state, context)
            : resolveDirectionFromPath(instruction.directionPathRef, attacker, state, context, pointResolutionDeps.resolvePointRef));
    const metadata = resolveJuiceMetadata(
        instruction.metadata as Record<string, unknown> | undefined,
        instruction,
        attacker,
        state,
        context,
        {
            resolvePointRef: pointResolutionDeps.resolvePointRef,
            resolvePathPenultimatePoint: (pathRef, innerAttacker, innerState, innerContext) =>
                resolvePathPenultimatePoint(pathRef, innerAttacker, innerState, innerContext, pointResolutionDeps.resolvePointRef)
        }
    );

    const targets = juiceTargets.length > 0
        ? juiceTargets
        : [actorTarget?.id];
    const effects: Array<any> = [];
    for (const juiceTarget of targets) {
        effects.push({
            type: 'Juice',
            effect: instruction.effect,
            target: juiceTarget,
            path,
            intensity: instruction.intensity,
            direction,
            text: instruction.text,
            duration: instruction.duration,
            color: instruction.color,
            metadata: metadata as Record<string, any> | undefined
        });
    }
    return effects;
};
