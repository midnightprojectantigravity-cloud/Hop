import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/spatial-system';
import { getSkillScenarios } from '../scenarios';
import { canLandOnHazard, canPassHazard, isBlockedByActor } from '../systems/validation';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';
import { isFreeMoveMode } from '../systems/free-move';
import { resolveMovementCapabilities } from '../systems/capabilities/movement';

/**
 * BASIC_MOVE Skill
 * Goal: Standard movement skill that uses BFS for pathfinding.
 */

// 1. Extract the shared logic
const getEffectiveMoveRange = (state: GameState, actor: Actor, rangeModifier: number): number => {
    if (isFreeMoveMode(state)) return 20;
    return Math.max((actor.speed || 1) + rangeModifier, 1);
};

const isBlockedMovementTile = (state: GameState, target: Point): boolean => {
    if (!SpatialSystem.isWithinBounds(state, target)) return true;
    const traits = UnifiedTileService.getTraitsAt(state, target);
    return traits.has('BLOCKS_MOVEMENT');
};

const resolveBasicMoveModel = (state: GameState, actor: Actor, target?: Point) =>
    resolveMovementCapabilities(state, actor, { skillId: 'BASIC_MOVE', target }).model;

const getSafeMovementRange = (
    state: GameState,
    actor: Actor,
    origin: Point,
    movePoints: number,
    movementModel: ReturnType<typeof resolveBasicMoveModel>
): Point[] => {
    const ignoreWalls = movementModel.ignoreWalls || movementModel.pathing === 'flight' || movementModel.pathing === 'teleport';
    const ignoreHazards = movementModel.ignoreGroundHazards || movementModel.pathing === 'flight' || movementModel.pathing === 'teleport';
    const canPassActors = movementModel.allowPassThroughActors || movementModel.pathing === 'teleport';

    if (movementModel.pathing === 'teleport') {
        return SpatialSystem.getAreaTargets(state, origin, movePoints).filter(next => {
            if (hexEquals(next, origin)) return false;
            if (!SpatialSystem.isWithinBounds(state, next)) return false;
            if (!ignoreWalls && !UnifiedTileService.isWalkable(state, next)) return false;
            if (!ignoreWalls && isBlockedMovementTile(state, next)) return false;
            if (!canLandOnHazard(state, actor, next, { movementModel })) return false;
            if (isBlockedByActor(state, next, actor.id)) return false;
            return true;
        });
    }

    const visited = new Map<string, number>();
    const out: Point[] = [];
    const key = (p: Point) => `${p.q},${p.r}`;
    const queue: Array<{ p: Point; cost: number }> = [{ p: origin, cost: 0 }];
    visited.set(key(origin), 0);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.cost >= movePoints) continue;

        for (const next of getNeighbors(cur.p)) {
            if (!SpatialSystem.isWithinBounds(state, next)) continue;
            if (!ignoreWalls && !UnifiedTileService.isWalkable(state, next)) continue;
            if (!ignoreHazards && !canPassHazard(state, actor, next, 'BASIC_MOVE', { movementModel })) continue;

            const occupant = getActorAt(state, next) as Actor | undefined;
            const occupiedByOther = !!occupant && occupant.id !== actor.id;
            const occupiedByAlly = occupiedByOther && occupant.factionId === actor.factionId;
            if (occupiedByOther && !occupiedByAlly && !canPassActors) continue;

            const nk = key(next);
            const newCost = cur.cost + 1;
            if (visited.has(nk) && visited.get(nk)! <= newCost) continue;

            visited.set(nk, newCost);
            if (!occupiedByOther && canLandOnHazard(state, actor, next, { movementModel }) && (ignoreWalls || !isBlockedMovementTile(state, next))) {
                out.push(next);
            }
            queue.push({ p: next, cost: newCost });
        }
    }

    return out;
};

const findSafePath = (
    state: GameState,
    actor: Actor,
    origin: Point,
    target: Point,
    movePoints: number,
    movementModel: ReturnType<typeof resolveBasicMoveModel>
): Point[] | null => {
    const ignoreWalls = movementModel.ignoreWalls || movementModel.pathing === 'flight' || movementModel.pathing === 'teleport';
    const ignoreHazards = movementModel.ignoreGroundHazards || movementModel.pathing === 'flight' || movementModel.pathing === 'teleport';
    const canPassActors = movementModel.allowPassThroughActors || movementModel.pathing === 'teleport';

    if (movementModel.pathing === 'teleport') {
        if (hexEquals(origin, target)) return null;
        if (!SpatialSystem.isWithinBounds(state, target)) return null;
        if (hexDistance(origin, target) > movePoints) return null;
        if (!ignoreWalls && !UnifiedTileService.isWalkable(state, target)) return null;
        if (!ignoreWalls && isBlockedMovementTile(state, target)) return null;
        if (!canLandOnHazard(state, actor, target, { movementModel })) return null;
        if (isBlockedByActor(state, target, actor.id)) return null;
        return [origin, target];
    }

    const key = (p: Point) => `${p.q},${p.r}`;
    const parseKey = (k: string): Point => {
        const [q, r] = k.split(',').map(Number);
        return { q, r, s: -q - r };
    };

    const queue: Point[] = [origin];
    const cost = new Map<string, number>([[key(origin), 0]]);
    const cameFrom = new Map<string, string | null>([[key(origin), null]]);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        const curKey = key(cur);
        const curCost = cost.get(curKey)!;
        if (curCost >= movePoints) continue;

        for (const next of getNeighbors(cur)) {
            if (!SpatialSystem.isWithinBounds(state, next)) continue;
            if (!ignoreWalls && !UnifiedTileService.isWalkable(state, next)) continue;
            if (!ignoreHazards && !canPassHazard(state, actor, next, 'BASIC_MOVE', { movementModel })) continue;

            const occupant = getActorAt(state, next) as Actor | undefined;
            const occupiedByOther = !!occupant && occupant.id !== actor.id;
            const occupiedByAlly = occupiedByOther && occupant.factionId === actor.factionId;
            if (occupiedByOther && !occupiedByAlly && !canPassActors) continue;

            const nextKey = key(next);
            const nextCost = curCost + 1;
            if (cost.has(nextKey) && cost.get(nextKey)! <= nextCost) continue;

            cost.set(nextKey, nextCost);
            cameFrom.set(nextKey, curKey);
            queue.push(next);
        }
    }

    const targetKey = key(target);
    if (!cameFrom.has(targetKey)) return null;
    if (!ignoreWalls && isBlockedMovementTile(state, target)) return null;
    if (!canLandOnHazard(state, actor, target, { movementModel })) return null;
    if (isBlockedByActor(state, target, actor.id)) return null;

    const path: Point[] = [];
    let cur: string | null = targetKey;
    while (cur) {
        path.push(parseKey(cur));
        cur = cameFrom.get(cur) || null;
    }
    path.reverse();
    return path;
};

export const BASIC_MOVE: SkillDefinition = {
    id: 'BASIC_MOVE',
    name: 'Walk',
    description: 'Move to an adjacent or nearby tile within your speed range.',
    slot: 'passive',
    icon: '👣',
    baseVariables: {
        range: 1, // Base range, will be modified by actor speed
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const movementModel = resolveBasicMoveModel(state, attacker, target);
        const range = getEffectiveMoveRange(state, attacker, movementModel.rangeModifier || 0);
        const validTargets = getSafeMovementRange(state, attacker, attacker.position, range, movementModel);
        const isTargetValid = validTargets.some((p: Point) => hexEquals(p, target));
        const path = findSafePath(state, attacker, attacker.position, target, range, movementModel);

        if (!isTargetValid || !path || path.length < 2) {
            messages.push('Target out of reach or blocked!');
            return { effects, messages, consumesTurn: false };
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination: target,
            source: attacker.position,
            path,
            simulatePath: movementModel.pathing !== 'teleport',
            // Validation/pathfinding allows passing through allies for free movement.
            // Runtime simulation must match that contract to avoid short-stops.
            ignoreCollision: true,
            ignoreGroundHazards: movementModel.ignoreGroundHazards || movementModel.pathing === 'flight' || movementModel.pathing === 'teleport'
        });

        const actorLabel = attacker.id === state.player.id
            ? 'You'
            : `${attacker.subtype || 'enemy'}#${attacker.id}`;
        messages.push(`${actorLabel} moved to (${target.q}, ${target.r}). [Range ${range}]`);

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor;
        if (!actor) return [];

        const movementModel = resolveBasicMoveModel(state, actor);
        const range = getEffectiveMoveRange(state, actor, movementModel.rangeModifier || 0);
        const movementTargets = getSafeMovementRange(state, actor, origin, range, movementModel);
        return movementTargets.filter(p => !isBlockedByActor(state, p, actor.id));
    },
    upgrades: {},
    scenarios: getSkillScenarios('BASIC_MOVE')
};
