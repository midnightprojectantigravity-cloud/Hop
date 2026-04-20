import type { Actor, GameState, Point } from '../../types';
import type { PointResolutionContext } from './point-resolution';

export const materializeUpdateCompanionStateInstruction = (
    instruction: {
        target: any;
        mode?: any;
        markTarget?: any;
        orbitStep?: number;
        apexStrikeCooldown?: number;
        healCooldown?: number;
        keenSight?: boolean;
        twinTalons?: boolean;
        apexPredator?: boolean;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolveActorRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Actor | Point | undefined,
    resolvePointRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined
): Array<any> => {
    const actorRef = resolveActorRef(instruction.target, attacker, state, context);
    if (!actorRef || typeof actorRef !== 'object' || !('id' in actorRef)) return [];
    return [{
        type: 'UpdateCompanionState',
        target: actorRef.id,
        mode: instruction.mode,
        markTarget: instruction.markTarget === 'selected_hex'
            ? resolvePointRef('selected_hex', attacker, state, context)
            : instruction.markTarget === 'target_actor_id'
                ? context.targetActorId || null
                : instruction.markTarget,
        orbitStep: instruction.orbitStep,
        apexStrikeCooldown: instruction.apexStrikeCooldown,
        healCooldown: instruction.healCooldown,
        keenSight: instruction.keenSight,
        twinTalons: instruction.twinTalons,
        apexPredator: instruction.apexPredator
    }];
};

export const materializeUpdateBehaviorStateInstruction = (
    instruction: {
        target: any;
        overlays?: any;
        anchorPoint?: Point | string | null;
        anchorActorRef?: any;
        anchorActorId?: string | null;
        goal?: any;
        controller?: any;
        clearOverlays?: boolean;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolveActorRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Actor | Point | undefined,
    resolvePointRef: (
        ref: any,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined
): Array<any> => {
    const actorRef = resolveActorRef(instruction.target, attacker, state, context);
    if (!actorRef || typeof actorRef !== 'object' || !('id' in actorRef)) return [];
    const anchorPoint = typeof instruction.anchorPoint === 'string'
        ? resolvePointRef(instruction.anchorPoint, attacker, state, context)
        : instruction.anchorPoint;
    const anchorActorId = instruction.anchorActorRef === null
        ? null
        : instruction.anchorActorRef
            ? (resolveActorRef(instruction.anchorActorRef, attacker, state, context) as Actor | undefined)?.id
            : instruction.anchorActorId;
    return [{
        type: 'UpdateBehaviorState',
        target: actorRef.id,
        overlays: instruction.overlays,
        anchorActorId,
        anchorPoint,
        goal: instruction.goal,
        controller: instruction.controller,
        clearOverlays: instruction.clearOverlays
    }];
};
