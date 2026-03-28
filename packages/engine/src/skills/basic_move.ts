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
import { TileResolver } from '../systems/tiles/tile-effects';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';

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

const cloneBasicMovePolicy = (
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>,
    overrides: Partial<ReturnType<typeof resolveBasicMovePolicy>> & {
        movementModel?: Partial<ReturnType<typeof resolveBasicMovePolicy>['movementModel']>;
    }
) => ({
    ...movementPolicy,
    ...overrides,
    movementModel: {
        ...movementPolicy.movementModel,
        ...(overrides.movementModel || {})
    }
});

const resolveBasicMoveLandingPolicy = (
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>
) => cloneBasicMovePolicy(movementPolicy, {
    ignoreWalls: false,
    ignoreGroundHazards: false,
    movementModel: {
        ...movementPolicy.movementModel,
        pathing: 'walk',
        ignoreWalls: false,
        ignoreGroundHazards: false
    }
});

const resolveBasicMoveTraversalPolicies = (
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>
) => {
    if (movementPolicy.pathing !== 'walk') return [movementPolicy];
    if (!movementPolicy.ignoreWalls && !movementPolicy.ignoreGroundHazards) return [movementPolicy];
    return [
        resolveBasicMoveLandingPolicy(movementPolicy),
        movementPolicy
    ];
};

const resolveBasicMoveTransitionOptions = (
    traversalPolicy: ReturnType<typeof resolveBasicMovePolicy>
) => ({
    ignoreActors: true,
    ignoreGroundHazards: traversalPolicy.ignoreGroundHazards || traversalPolicy.pathing === 'flight' || traversalPolicy.pathing === 'teleport',
    ignoreWalls: traversalPolicy.ignoreWalls
});

const collectMovementRangeWithPolicy = (
    state: GameState,
    actor: Actor,
    origin: Point,
    movePoints: number,
    traversalPolicy: ReturnType<typeof resolveBasicMovePolicy>,
    landingPolicy: ReturnType<typeof resolveBasicMovePolicy>
): Point[] => {
    const visited = new Map<string, number>();
    const out: Point[] = [];
    const key = (p: Point) => `${p.q},${p.r}`;
    const queue: Array<{ p: Point; remaining: number }> = [{ p: origin, remaining: movePoints }];
    visited.set(key(origin), movePoints);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        if (cur.remaining <= 0) continue;

        for (const next of getNeighbors(cur.p)) {
            const traversal = validateMovementTraversalStep(state, actor, next, traversalPolicy, {
                skillId: 'BASIC_MOVE',
                allowAlliedOccupancy: true
            });
            if (!traversal.isValid) continue;

            const resolvedTile = UnifiedTileService.getTileAt(state, next);

            const transition = TileResolver.processTransition(
                actor,
                resolvedTile,
                state,
                cur.remaining,
                resolveBasicMoveTransitionOptions(traversalPolicy)
            );
            const nk = key(next);
            const nextRemaining = transition.newMomentum ?? Math.max(0, cur.remaining - 1);
            if (visited.has(nk) && visited.get(nk)! >= nextRemaining) continue;

            visited.set(nk, nextRemaining);
            if (validateMovementDestination(state, actor, next, landingPolicy).isValid) {
                out.push(next);
            }
            if (!transition.interrupt && nextRemaining > 0) {
                queue.push({ p: next, remaining: nextRemaining });
            }
        }
    }

    return out;
};

const findSafePathWithPolicy = (
    state: GameState,
    actor: Actor,
    origin: Point,
    target: Point,
    movePoints: number,
    traversalPolicy: ReturnType<typeof resolveBasicMovePolicy>,
    landingPolicy: ReturnType<typeof resolveBasicMovePolicy>
): Point[] | null => {
    const key = (p: Point) => `${p.q},${p.r}`;
    const parseKey = (k: string): Point => {
        const [q, r] = k.split(',').map(Number);
        return { q, r, s: -q - r };
    };

    const queue: Point[] = [origin];
    const remaining = new Map<string, number>([[key(origin), movePoints]]);
    const cameFrom = new Map<string, string | null>([[key(origin), null]]);

    while (queue.length > 0) {
        const cur = queue.shift()!;
        const curKey = key(cur);
        const curRemaining = remaining.get(curKey)!;
        if (curRemaining <= 0) continue;

        for (const next of getNeighbors(cur)) {
            const traversal = validateMovementTraversalStep(state, actor, next, traversalPolicy, {
                skillId: 'BASIC_MOVE',
                allowAlliedOccupancy: true
            });
            if (!traversal.isValid) continue;

            const resolvedTile = UnifiedTileService.getTileAt(state, next);

            const transition = TileResolver.processTransition(
                actor,
                resolvedTile,
                state,
                curRemaining,
                resolveBasicMoveTransitionOptions(traversalPolicy)
            );
            const nextKey = key(next);
            const nextRemaining = transition.newMomentum ?? Math.max(0, curRemaining - 1);
            if (remaining.has(nextKey) && remaining.get(nextKey)! >= nextRemaining) continue;

            remaining.set(nextKey, nextRemaining);
            cameFrom.set(nextKey, curKey);
            if (!transition.interrupt && nextRemaining > 0) {
                queue.push(next);
            }
        }
    }

    const targetKey = key(target);
    if (!cameFrom.has(targetKey)) return null;
    if (!validateMovementDestination(state, actor, target, landingPolicy).isValid) return null;

    const path: Point[] = [];
    let cur: string | null = targetKey;
    while (cur) {
        path.push(parseKey(cur));
        cur = cameFrom.get(cur) || null;
    }
    path.reverse();
    return path;
};

const getSafeMovementRange = (
    state: GameState,
    actor: Actor,
    origin: Point,
    movePoints: number,
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>
): Point[] => {
    const landingPolicy = resolveBasicMoveLandingPolicy(movementPolicy);
    if (movementPolicy.pathing === 'teleport') {
        return SpatialSystem.getAreaTargets(state, origin, movePoints).filter(next => {
            if (hexEquals(next, origin)) return false;
            return validateMovementDestination(state, actor, next, landingPolicy).isValid;
        });
    }

    const outByKey = new Map<string, Point>();
    for (const traversalPolicy of resolveBasicMoveTraversalPolicies(movementPolicy)) {
        const reachable = collectMovementRangeWithPolicy(state, actor, origin, movePoints, traversalPolicy, landingPolicy);
        for (const point of reachable) {
            const key = `${point.q},${point.r}`;
            if (!outByKey.has(key)) {
                outByKey.set(key, point);
            }
        }
    }

    return [...outByKey.values()];
};

const findSafePath = (
    state: GameState,
    actor: Actor,
    origin: Point,
    target: Point,
    movePoints: number,
    movementPolicy: ReturnType<typeof resolveBasicMovePolicy>
): Point[] | null => {
    const landingPolicy = resolveBasicMoveLandingPolicy(movementPolicy);
    if (movementPolicy.pathing === 'teleport') {
        if (hexEquals(origin, target)) return null;
        if (hexDistance(origin, target) > movePoints) return null;
        if (!validateMovementDestination(state, actor, target, landingPolicy).isValid) return null;
        return [origin, target];
    }

    for (const traversalPolicy of resolveBasicMoveTraversalPolicies(movementPolicy)) {
        const path = findSafePathWithPolicy(state, actor, origin, target, movePoints, traversalPolicy, landingPolicy);
        if (path) return path;
    }

    return null;
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
            ignoreWalls: movementPolicy.ignoreWalls,
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
