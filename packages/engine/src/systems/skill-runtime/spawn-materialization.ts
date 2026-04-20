import type { Actor, AtomicEffect, GameState, Point } from '../../types';
import { createBombActorId, applyInitialStatuses } from './spawn-resolution';
import { createBombActor } from '../effects/bomb-runtime';
import { createRaiseDeadSkeletonId } from '../entities/companion-id-strategies';
import { createCompanion } from '../entities/entity-factory';
import { resolveSummonPlacement } from '../summon-placement';
import { SpatialSystem } from '../spatial-system';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { resolveActorAtPoint } from './presentation-materialization';
import { resolveFalconCompanionState } from './actor-resolution';
import type { PointResolutionContext } from './point-resolution';

export type SpawnMaterializationDeps = {
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
    syncActorPosition: (context: PointResolutionContext, actorId: string | undefined, destination: Point | undefined) => void;
};

export const materializeSpawnActorInstruction = (
    instruction: any,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: SpawnMaterializationDeps
): { effects: AtomicEffect[]; messages: string[] } => {
    const effects: AtomicEffect[] = [];
    const messages: string[] = [];
    const owner = deps.resolveActorRef(instruction.owner, attacker, state, context) as Actor | undefined;
    const position = deps.resolvePointRef(instruction.position, attacker, state, context);
    if (!owner) return { effects, messages };
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
        for (const placementEffect of placement.effects) {
            effects.push(placementEffect);
            if (placementEffect.type === 'Displacement' && typeof placementEffect.target === 'string') {
                deps.syncActorPosition(context, placementEffect.target, placementEffect.destination);
            }
        }
        messages.push(...placement.messages);
        return placement.spawnPosition;
    })();
    if (!spawnPosition) return { effects, messages };

    const actor = instruction.spawnType === 'ephemeral_actor'
        ? applyInitialStatuses(
            (() => {
                const factionSource = instruction.factionSource
                    ? deps.resolveActorRef(instruction.factionSource, attacker, state, context)
                    : owner;
                const ownerFactionId = factionSource && typeof factionSource === 'object' && 'factionId' in factionSource
                    ? factionSource.factionId
                    : owner.factionId;
                return createBombActor(
                    instruction.actorId
                        || (instruction.actorIdStrategy === 'bomb_toss_v1'
                            ? createBombActorId(attacker, state, spawnPosition)
                            : createBombActorId(attacker, state, spawnPosition)),
                    spawnPosition,
                    ownerFactionId
                );
            })(),
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
            ...(instruction.companionType === 'falcon' ? resolveFalconCompanionState(owner, undefined) : {}),
            ...(instruction.initialCompanionState || {})
        };
        actor.companionState = {
            ...actor.companionState,
            ...mergedFalconState,
            mode: mergedFalconState.mode || actor.companionState?.mode || 'roost'
        };
    }
    deps.syncActorPosition(context, actor.id, actor.position);
    effects.push({ type: 'SpawnActor', actor });
    return { effects, messages };
};
