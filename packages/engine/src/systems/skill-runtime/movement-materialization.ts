import { hexDistance } from '../../hex';
import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import { resolveForce } from '../combat/force';
import { processKineticPulse } from '../movement/kinetic-kernel';
import type { PointResolutionContext } from './point-resolution';
import type { SkillCollisionPolicy, SkillPhysicsPlan } from './types';
import { clonePoint, resolveActorLabel } from './execution-context';
import { resolvePathRef } from './path-resolution';
import { toCollisionPolicy, adjustMagnitudeForWeightClass, resolveDirectionVector, resolveRuntimeStatusMultipliers } from './physics-resolution';

export type MovementMaterializationDeps = {
    resolveActorRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Actor | Point | undefined;
    resolvePointRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined;
    resolveRuntimeMovementExecutionPlan: any;
    syncActorPosition: (context: PointResolutionContext, actorId: string | undefined, destination: Point | undefined) => void;
    appendTrace: (trace: any, entry: any) => void;
    createTrace: (mode: any) => any;
    resolveRuntimeSkillActorById: (state: GameState, actorId: string) => Actor | undefined;
};

type MovementMaterializationContext = PointResolutionContext & {
    physicsPlan: SkillPhysicsPlan;
    collisionPolicy?: SkillCollisionPolicy;
    trace: any;
};

export const materializeMoveActorInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: MovementMaterializationContext,
    resolved: { runtime: { movementPolicy?: any; id: string }; targeting: { generator: string } },
    deps: MovementMaterializationDeps
): { effects: AtomicEffect[]; messages: string[] } => {
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    const actorRef = deps.resolveActorRef(instruction.actor, attacker, state, context) as Actor | undefined;
    const requestedDestination = deps.resolvePointRef(instruction.destination, attacker, state, context);
    if (!actorRef || !requestedDestination) return { effects, messages };

    const explicitPath = instruction.pathRef
        ? resolvePathRef(instruction.pathRef, attacker, state, context, deps.resolvePointRef)
        : undefined;
    const movementPlan = explicitPath
        ? undefined
        : (resolved.runtime.movementPolicy
            && (resolved.targeting.generator === 'movement_reachable' || instruction.simulatePath))
            ? deps.resolveRuntimeMovementExecutionPlan(resolved.runtime, state, actorRef, requestedDestination)
            : undefined;
    if (explicitPath && explicitPath.length < 2) return { effects, messages };
    if (movementPlan && (!movementPlan.path || movementPlan.path.length < 2)) return { effects, messages };
    if (movementPlan?.interruptionMessage) {
        messages.push(movementPlan.interruptionMessage);
    }

    const destination = movementPlan?.destination || requestedDestination;
    const source = instruction.suppressPresentation ? undefined : clonePoint(actorRef.position);
    deps.syncActorPosition(context, actorRef.id, destination);
    const suppressPresentation = !!instruction.suppressPresentation;
    effects.push({
        type: 'Displacement',
        target: instruction.effectTargetMode === 'actor_id'
            ? actorRef.id
            : instruction.actor === 'self'
                ? 'self'
                : actorRef.id,
        destination,
        source,
        path: movementPlan?.path || explicitPath || undefined,
        simulatePath: instruction.simulatePath ?? movementPlan?.movementPolicy.simulatePath ?? !!explicitPath,
        ignoreCollision: instruction.ignoreCollision ?? (movementPlan ? true : undefined),
        ignoreWalls: instruction.ignoreWalls ?? movementPlan?.movementPolicy.ignoreWalls,
        ignoreGroundHazards: instruction.ignoreGroundHazards ?? (
            movementPlan
                ? (movementPlan.movementPolicy.ignoreGroundHazards
                    || movementPlan.movementPolicy.pathing === 'flight'
                    || movementPlan.movementPolicy.pathing === 'teleport')
                : undefined
        ),
        presentationKind: suppressPresentation ? undefined : instruction.presentationKind,
        pathStyle: suppressPresentation ? undefined : instruction.pathStyle,
        presentationSequenceId: suppressPresentation ? undefined : instruction.presentationSequenceId
            ?? (resolved.runtime.id === 'DASH'
                ? `${actorRef.id}:DASH:${destination.q},${destination.r},${destination.s}:${state.turnNumber}`
                : undefined)
    });
    return { effects, messages };
};

export const materializeTeleportActorInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: MovementMaterializationContext,
    resolved: { runtime: { id: string; movementPolicy?: any } },
    deps: MovementMaterializationDeps
): { effects: AtomicEffect[]; messages: string[] } => {
    const actorRef = deps.resolveActorRef(instruction.actor, attacker, state, context) as Actor | undefined;
    const destination = deps.resolvePointRef(instruction.destination, attacker, state, context);
    if (!actorRef || !destination) return { effects: [], messages: [] };
    const movementPolicy = resolved.runtime.movementPolicy
        ? deps.resolveRuntimeMovementExecutionPlan(resolved.runtime, state, actorRef, destination)?.movementPolicy
        : undefined;
    const source = clonePoint(actorRef.position);
    deps.syncActorPosition(context, actorRef.id, destination);
    return {
        effects: [{
        type: 'Displacement',
        target: instruction.actor === 'self' ? 'self' : actorRef.id,
        destination,
        source,
        simulatePath: instruction.simulatePath ?? movementPolicy?.simulatePath,
        ignoreWalls: instruction.ignoreWalls ?? movementPolicy?.ignoreWalls ?? true,
        ignoreGroundHazards: instruction.ignoreGroundHazards ?? movementPolicy?.ignoreGroundHazards ?? true,
        presentationKind: instruction.presentationKind
            ?? (resolved.runtime.id === 'JUMP' ? 'jump' : undefined),
        pathStyle: instruction.pathStyle
            ?? (resolved.runtime.id === 'JUMP' ? 'arc' : undefined),
        presentationSequenceId: instruction.presentationSequenceId
            ?? (resolved.runtime.id === 'JUMP'
                ? `${actorRef.id}:JUMP:${destination.q},${destination.r},${destination.s}:${state.turnNumber}`
                : undefined)
    }],
        messages: []
    };
};

export const materializeApplyForceInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: MovementMaterializationContext,
    resolved: { runtime: { id: string }; physicsPlan: SkillPhysicsPlan },
    deps: MovementMaterializationDeps,
    appendTrace: (trace: any, entry: any) => void,
    resolveRuntimeStatusMultipliersFn: typeof resolveRuntimeStatusMultipliers,
    resolveForceFn: typeof resolveForce
): { effects: AtomicEffect[]; messages: string[] } => {
    const actorRef = deps.resolveActorRef(instruction.target, attacker, state, context) as Actor | undefined;
    const source = instruction.source
        ? deps.resolvePointRef(instruction.source, attacker, state, context)
        : deps.resolvePointRef('caster_hex', attacker, state, context);
    if (!actorRef || !source) return { effects: [], messages: [] };
    const messages: string[] = [];
    const magnitude = adjustMagnitudeForWeightClass(
        instruction.magnitude,
        actorRef,
        context.physicsPlan,
        entry => appendTrace(context.trace, entry),
        'physicsPlan.weightClassModifierTable'
    );
    if (instruction.resolveImmediately) {
        const resolution = resolveForceFn(state, {
            source,
            targetActorId: actorRef.id,
            mode: instruction.mode,
            magnitude,
            maxDistance: instruction.maxDistance,
            collision: toCollisionPolicy(instruction.collision, context.collisionPolicy, context.physicsPlan) || { onBlocked: 'stop' }
        });
        if (resolution.collided && instruction.collision?.applyStunOnStop) {
            messages.push(`Bashed ${resolveActorLabel(actorRef, state)} into obstacle!`);
        }
        return { effects: resolution.effects, messages };
    }
    return {
        effects: [{
            type: 'ApplyForce',
            target: actorRef.id,
            source,
            mode: instruction.mode,
            magnitude,
            maxDistance: instruction.maxDistance,
            collision: toCollisionPolicy(instruction.collision, context.collisionPolicy, context.physicsPlan) || { onBlocked: 'stop' }
        }],
        messages
    };
};

export const materializeEmitPulseInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: MovementMaterializationContext,
    targetActor: Actor | undefined,
    resolved: { runtime: { baseVariables: { momentum?: number } }; physicsPlan: SkillPhysicsPlan },
    deps: MovementMaterializationDeps,
    appendTrace: (trace: any, entry: any) => void
): AtomicEffect[] => {
    const origin = deps.resolvePointRef(instruction.origin, attacker, state, context);
    const direction = resolveDirectionVector(instruction.direction, context as any);
    if (!origin || !direction) return [];
    const pulseMagnitude = adjustMagnitudeForWeightClass(
        instruction.magnitude || context.physicsPlan.baseMomentum || resolved.runtime.baseVariables.momentum || 0,
        targetActor,
        context.physicsPlan,
        entry => appendTrace(context.trace, entry),
        'physicsPlan.baseMomentum'
    );
    const pulseEffects = processKineticPulse(state, {
        origin,
        direction,
        momentum: pulseMagnitude,
        collision: toCollisionPolicy(instruction.collision, context.collisionPolicy, context.physicsPlan)
    });
    return pulseEffects;
};
