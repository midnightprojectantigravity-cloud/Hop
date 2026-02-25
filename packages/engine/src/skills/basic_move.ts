import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/SpatialSystem';
import { getSkillScenarios } from '../scenarios';
import { canLandOnHazard, canPassHazard, isBlockedByActor } from '../systems/validation';
import { UnifiedTileService } from '../systems/unified-tile-service';
import { isFreeMoveMode } from '../systems/free-move';

/**
 * BASIC_MOVE Skill
 * Goal: Standard movement skill that uses BFS for pathfinding.
 */

// 1. Extract the shared logic
const getEffectiveMoveRange = (state: GameState, actor: Actor): number => {
    if (isFreeMoveMode(state)) return 20;
    return Math.max(actor.speed || 1, 1);
};

const isBlockedMovementTile = (state: GameState, target: Point): boolean => {
    if (!SpatialSystem.isWithinBounds(state, target)) return true;
    const traits = UnifiedTileService.getTraitsAt(state, target);
    return traits.has('BLOCKS_MOVEMENT');
};

const getSafeMovementRange = (state: GameState, actor: Actor, origin: Point, movePoints: number): Point[] => {
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
            if (!UnifiedTileService.isWalkable(state, next)) continue;
            if (!canPassHazard(state, actor, next, 'BASIC_MOVE')) continue;

            const occupant = getActorAt(state, next) as Actor | undefined;
            const occupiedByOther = !!occupant && occupant.id !== actor.id;
            const occupiedByAlly = occupiedByOther && occupant.factionId === actor.factionId;
            if (occupiedByOther && !occupiedByAlly) continue;

            const nk = key(next);
            const newCost = cur.cost + 1;
            if (visited.has(nk) && visited.get(nk)! <= newCost) continue;

            visited.set(nk, newCost);
            if (!occupiedByAlly && canLandOnHazard(state, actor, next) && !isBlockedMovementTile(state, next)) {
                out.push(next);
            }
            queue.push({ p: next, cost: newCost });
        }
    }

    return out;
};

const findSafePath = (state: GameState, actor: Actor, origin: Point, target: Point, movePoints: number): Point[] | null => {
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
            if (!UnifiedTileService.isWalkable(state, next)) continue;
            if (!canPassHazard(state, actor, next, 'BASIC_MOVE')) continue;

            const occupant = getActorAt(state, next) as Actor | undefined;
            const occupiedByOther = !!occupant && occupant.id !== actor.id;
            const occupiedByAlly = occupiedByOther && occupant.factionId === actor.factionId;
            if (occupiedByOther && !occupiedByAlly) continue;

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
    if (isBlockedMovementTile(state, target)) return null;
    if (!canLandOnHazard(state, actor, target)) return null;

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

        const range = getEffectiveMoveRange(state, attacker);
        const validTargets = getSafeMovementRange(state, attacker, attacker.position, range);
        const isTargetValid = validTargets.some((p: Point) => hexEquals(p, target));
        const path = findSafePath(state, attacker, attacker.position, target, range);

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
            simulatePath: true,
            // Validation/pathfinding allows passing through allies for free movement.
            // Runtime simulation must match that contract to avoid short-stops.
            ignoreCollision: true
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

        const range = getEffectiveMoveRange(state, actor);
        const movementTargets = getSafeMovementRange(state, actor, origin, range);
        return movementTargets.filter(p => !isBlockedByActor(state, p, actor.id));
    },
    upgrades: {},
    scenarios: getSkillScenarios('BASIC_MOVE')
};
