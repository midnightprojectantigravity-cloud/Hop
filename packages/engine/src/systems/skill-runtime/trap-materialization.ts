import type { Actor, GameState, Point } from '../../types';
import { resolvePointSet } from './point-resolution';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';

export const materializePlaceTrapInstruction = (
    instruction: {
        owner: any;
        pointSet?: any;
        position?: any;
        volatileCore?: boolean;
        chainReaction?: boolean;
        resetCooldown?: number;
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
    ) => Point | undefined,
    pointResolutionDeps: PointResolutionDependencies
): Array<any> => {
    const owner = resolveActorRef(instruction.owner, attacker, state, context);
    if (!owner || typeof owner !== 'object' || !('id' in owner)) return [];
    const positions = instruction.pointSet
        ? resolvePointSet(instruction.pointSet, attacker, state, context, pointResolutionDeps)
        : (instruction.position ? [resolvePointRef(instruction.position, attacker, state, context)].filter((point): point is Point => !!point) : []);
    return positions.map((position: Point) => ({
        type: 'PlaceTrap',
        position,
        ownerId: owner.id,
        volatileCore: instruction.volatileCore,
        chainReaction: instruction.chainReaction,
        resetCooldown: instruction.resetCooldown
    }));
};

export const materializeRemoveTrapInstruction = (
    instruction: { position: any; owner?: any },
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
    const position = resolvePointRef(instruction.position, attacker, state, context);
    if (!position) return [];
    return [{
        type: 'RemoveTrap',
        position,
        ownerId: instruction.owner
            ? (resolveActorRef(instruction.owner, attacker, state, context) as Actor | undefined)?.id
            : undefined
    }];
};

export const materializeSetTrapCooldownInstruction = (
    instruction: { position: any; cooldown?: number; owner?: any },
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
    const position = resolvePointRef(instruction.position, attacker, state, context);
    if (!position) return [];
    return [{
        type: 'SetTrapCooldown',
        position,
        cooldown: instruction.cooldown,
        ownerId: instruction.owner
            ? (resolveActorRef(instruction.owner, attacker, state, context) as Actor | undefined)?.id
            : undefined
    }];
};
