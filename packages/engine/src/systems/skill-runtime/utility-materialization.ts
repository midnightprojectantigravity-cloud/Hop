import type { Actor, GameState, Point } from '../../types';
import { createBombActorId, applyInitialStatuses } from './spawn-resolution';
import { createBombActor } from '../effects/bomb-runtime';
import { createRaiseDeadSkeletonId } from '../entities/companion-id-strategies';
import { createCompanion } from '../entities/entity-factory';
import { resolveSummonPlacement } from '../summon-placement';
import { SpatialSystem } from '../spatial-system';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { resolveActorAtPoint } from './presentation-materialization';
import type { PointResolutionContext, PointResolutionDependencies } from './point-resolution';

export type UtilityMaterializationDeps = {
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
    pointResolutionDeps: PointResolutionDependencies;
    syncActorPosition: (context: PointResolutionContext, actorId: string | undefined, destination: Point | undefined) => void;
};

export const materializeSpawnItemInstruction = (
    instruction: { position: any; itemType: string },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: UtilityMaterializationDeps['resolvePointRef']
): Array<any> => {
    const position = resolvePointRef(instruction.position, attacker, state, context);
    if (!position) return [];
    return [{ type: 'SpawnItem', itemType: instruction.itemType, position }];
};

export const materializePickupItemInstruction = (
    instruction: { itemType: string; position?: any },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: UtilityMaterializationDeps['resolvePointRef']
): Array<any> => {
    const position = instruction.position ? resolvePointRef(instruction.position, attacker, state, context) : undefined;
    if (instruction.itemType === 'spear') return [{ type: 'PickupSpear', position }];
    if (instruction.itemType === 'shield') return [{ type: 'PickupShield', position }];
    return [];
};

export const materializeModifyResourceInstruction = (
    instruction: { target: any; sparkDelta?: number; manaDelta?: number; exhaustionDelta?: number; actionCountDelta?: number },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolveActorRef: UtilityMaterializationDeps['resolveActorRef']
): Array<any> => {
    const actorRef = resolveActorRef(instruction.target, attacker, state, context);
    if (!actorRef || typeof actorRef !== 'object' || !('id' in actorRef)) return [];
    return [{
        type: 'ApplyResources',
        target: actorRef.id,
        sparkDelta: instruction.sparkDelta,
        manaDelta: instruction.manaDelta,
        exhaustionDelta: instruction.exhaustionDelta,
        actionCountDelta: instruction.actionCountDelta
    }];
};

export const materializeRemoveCorpseInstruction = (
    instruction: { position: any },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    resolvePointRef: UtilityMaterializationDeps['resolvePointRef']
): Array<any> => {
    const position = resolvePointRef(instruction.position, attacker, state, context);
    return position ? [{ type: 'RemoveCorpse', position }] : [];
};

export const materializeTrapInstruction = (
    instruction: {
        kind: 'place' | 'remove' | 'cooldown';
        position: any;
        owner?: any;
        pointSet?: any;
        volatileCore?: boolean;
        chainReaction?: boolean;
        resetCooldown?: number;
        cooldown?: number;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: UtilityMaterializationDeps
): Array<any> => {
    if (instruction.kind === 'place') return [];
    const position = deps.resolvePointRef(instruction.position, attacker, state, context);
    if (!position) return [];
    if (instruction.kind === 'remove') {
        return [{
            type: 'RemoveTrap',
            position,
            ownerId: instruction.owner
                ? (deps.resolveActorRef(instruction.owner, attacker, state, context) as Actor | undefined)?.id
                : undefined
        }];
    }
    return [{
        type: 'SetTrapCooldown',
        position,
        cooldown: instruction.cooldown,
        ownerId: instruction.owner
            ? (deps.resolveActorRef(instruction.owner, attacker, state, context) as Actor | undefined)?.id
            : undefined
    }];
};

export const materializeSpawnActorInstruction = (
    instruction: {
        spawnType: 'companion' | 'ephemeral_actor';
        positionStrategy?: 'owner_adjacent_first_valid';
        owner: any;
        position: any;
        placementPolicy?: 'fail';
        actorId?: string;
        actorIdStrategy?: string;
        factionSource?: any;
        companionType?: string;
        summon?: any;
        anchorActorId?: string;
        anchorPoint?: Point;
        initialBehaviorOverlay?: any;
        initialCompanionState?: any;
        initialStatuses?: any;
    },
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: UtilityMaterializationDeps
): Array<any> => {
    const owner = deps.resolveActorRef(instruction.owner, attacker, state, context) as Actor | undefined;
    const position = deps.resolvePointRef(instruction.position, attacker, state, context);
    if (!owner) return [];
    const spawnPosition = (() => {
        if (instruction.spawnType === 'companion' && instruction.positionStrategy === 'owner_adjacent_first_valid') {
            return SpatialSystem.getNeighbors(owner.position).find(candidate =>
                SpatialSystem.isWithinBounds(state, candidate)
                && UnifiedTileService.isWalkable(state, candidate)
                && !resolveActorAtPoint(state, candidate)
            );
        }
        if (!position) return undefined;
        if (instruction.spawnType !== 'companion') return position;
        const placement = resolveSummonPlacement(
            state,
            owner,
            position,
            instruction.placementPolicy || 'fail'
        );
        if (!placement.ok || !placement.spawnPosition) {
            return undefined;
        }
        return placement.spawnPosition;
    })();
    if (!spawnPosition) return [];

    const actor = instruction.spawnType === 'ephemeral_actor'
        ? applyInitialStatuses(
                createBombActor(
                    instruction.actorId
                        || (instruction.actorIdStrategy === 'bomb_toss_v1'
                            ? createBombActorId(attacker, state, spawnPosition)
                            : createBombActorId(attacker, state, spawnPosition)),
                spawnPosition,
                (
                    (() => {
                        const factionSource = instruction.factionSource
                            ? deps.resolveActorRef(instruction.factionSource, attacker, state, context)
                            : owner;
                        return factionSource && typeof factionSource === 'object' && 'factionId' in factionSource
                            ? factionSource.factionId
                            : owner.factionId;
                    })()
                )
            ),
            instruction.initialStatuses
        )
        : createCompanion({
            companionType: instruction.companionType as any,
            ownerId: owner.id,
            ownerFactionId: owner.factionId,
            position: spawnPosition,
            id: instruction.actorId
                || (instruction.actorIdStrategy === 'raise_dead_skeleton_v1'
                    ? createRaiseDeadSkeletonId(state)
                    : instruction.actorIdStrategy === 'falcon_owner_v1'
                        ? `falcon-${owner.id}`
                        : undefined),
            summon: instruction.summon,
            initialAnchorActorId: instruction.anchorActorId,
            initialAnchorPoint: instruction.anchorPoint,
            initialBehaviorOverlay: instruction.initialBehaviorOverlay
        });
    if (instruction.spawnType === 'companion') {
        const mergedFalconState = {
            ...(instruction.companionType === 'falcon' ? {} : {}),
            ...(instruction.initialCompanionState || {})
        };
        actor.companionState = {
            ...actor.companionState,
            ...mergedFalconState,
            mode: mergedFalconState.mode || actor.companionState?.mode || 'roost'
        };
    }
    deps.syncActorPosition(context, actor.id, actor.position);
    return [{ type: 'SpawnActor', actor }];
};
