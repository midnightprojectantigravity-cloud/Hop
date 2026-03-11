import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { SpatialSystem } from '../systems/spatial-system';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByActor } from '../systems/validation';
import { isFreeMoveMode, resolveFreeMoveInterruption } from '../systems/free-move';
import {
    resolveSkillMovementPolicy,
    validateMovementDestination,
    validateMovementTraversalStep
} from '../systems/capabilities/movement-policy';

/**
 * BASIC_MOVE Skill
 * Goal: Standard movement skill that uses BFS for pathfinding.
 */

const resolveBasicMovePolicy = (state: GameState, actor: Actor, target?: Point) => {
    const freeMove = isFreeMoveMode(state);
    const baseRange = freeMove ? 20 : Math.max(actor.speed || 1, 1);
    const policy = resolveSkillMovementPolicy(state, actor, {
        skillId: 'BASIC_MOVE',
        target,
        baseRange
    });
    if (freeMove) {
        return {
            ...policy,
            range: 20
        };
    }
    return policy;
};

const getSafeMovementRange = (
    state: GameState,
    actor: Actor,
    origin: Point,
    movePoints: number,
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>
): Point[] => {
    if (movementPolicy.pathing === 'teleport') {
        return SpatialSystem.getAreaTargets(state, origin, movePoints).filter(next => {
            if (hexEquals(next, origin)) return false;
            return validateMovementDestination(state, actor, next, movementPolicy).isValid;
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
            const traversal = validateMovementTraversalStep(state, actor, next, movementPolicy, {
                skillId: 'BASIC_MOVE',
                allowAlliedOccupancy: true
            });
            if (!traversal.isValid) continue;

            const nk = key(next);
            const newCost = cur.cost + 1;
            if (visited.has(nk) && visited.get(nk)! <= newCost) continue;

            visited.set(nk, newCost);
            if (validateMovementDestination(state, actor, next, movementPolicy).isValid) {
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
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>
): Point[] | null => {
    if (movementPolicy.pathing === 'teleport') {
        if (hexEquals(origin, target)) return null;
        if (hexDistance(origin, target) > movePoints) return null;
        if (!validateMovementDestination(state, actor, target, movementPolicy).isValid) return null;
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
            const traversal = validateMovementTraversalStep(state, actor, next, movementPolicy, {
                skillId: 'BASIC_MOVE',
                allowAlliedOccupancy: true
            });
            if (!traversal.isValid) continue;

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
    if (!validateMovementDestination(state, actor, target, movementPolicy).isValid) return null;

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
        const freeMove = isFreeMoveMode(state);

        if (!target) return { effects, messages, consumesTurn: false };

        const movementPolicy = resolveBasicMovePolicy(state, attacker, target);
        const range = movementPolicy.range;
        const validTargets = getSafeMovementRange(state, attacker, attacker.position, range, movementPolicy);
        const isTargetValid = validTargets.some((p: Point) => hexEquals(p, target));
        let path = findSafePath(state, attacker, attacker.position, target, range, movementPolicy);

        if (!isTargetValid || !path || path.length < 2) {
            messages.push('Target out of reach or blocked!');
            return { effects, messages, consumesTurn: false };
        }

        let destination = target;
        if (freeMove && attacker.id === state.player.id) {
            const interruption = resolveFreeMoveInterruption(state, path);
            if (interruption.interrupted) {
                destination = interruption.destination;
                const destinationIndex = path.findIndex(point => hexEquals(point, destination));
                if (destinationIndex > 0) {
                    path = path.slice(0, destinationIndex + 1);
                }
                const spottingEnemy = state.enemies.find(enemy => enemy.id === interruption.spottedByEnemyId);
                const enemyLabel = spottingEnemy?.subtype || interruption.spottedByEnemyId || 'an enemy';
                messages.push(`Spotted by ${enemyLabel}. Free Move interrupted.`);
            }
        }

        effects.push({
            type: 'Displacement',
            target: 'self',
            destination,
            source: attacker.position,
            path,
            simulatePath: movementPolicy.simulatePath,
            // Validation/pathfinding allows passing through allies for free movement.
            // Runtime simulation must match that contract to avoid short-stops.
            ignoreCollision: true,
            ignoreGroundHazards: movementPolicy.ignoreGroundHazards || movementPolicy.pathing === 'flight' || movementPolicy.pathing === 'teleport',
            presentationKind: 'walk',
            pathStyle: 'hex_step',
            presentationSequenceId: `${attacker.id}:BASIC_MOVE:${destination.q},${destination.r},${destination.s}:${state.turnNumber}`
        });

        const actorLabel = attacker.id === state.player.id
            ? 'You'
            : `${attacker.subtype || 'enemy'}#${attacker.id}`;
        messages.push(`${actorLabel} moved to (${destination.q}, ${destination.r}). [Range ${range}]`);

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const actor = getActorAt(state, origin) as Actor;
        if (!actor) return [];

        const movementPolicy = resolveBasicMovePolicy(state, actor);
        const range = movementPolicy.range;
        const movementTargets = getSafeMovementRange(state, actor, origin, range, movementPolicy);
        return movementTargets.filter(p => !isBlockedByActor(state, p, actor.id));
    },
    upgrades: {},
    scenarios: getSkillScenarios('BASIC_MOVE')
};
