import { getNeighbors, hexDistance, hexEquals } from '../../hex';
import type { Actor, GameState, Point } from '../../types';
import { isFreeMoveMode, resolveFreeMoveInterruption } from '../free-move';
import {
    resolveSkillMovementPolicy,
    validateMovementDestination,
    validateMovementTraversalStep,
    type ResolvedSkillMovementPolicy
} from '../capabilities/movement-policy';
import { TileResolver } from '../tiles/tile-effects';
import { UnifiedTileService } from '../tiles/unified-tile-service';
import { SpatialSystem } from '../spatial-system';
import type { RuntimeMovementPolicy, SkillRuntimeDefinition } from './types';

const cloneMovementPolicy = (
    movementPolicy: ResolvedSkillMovementPolicy,
    overrides: Partial<ResolvedSkillMovementPolicy> & {
        movementModel?: Partial<ResolvedSkillMovementPolicy['movementModel']>;
    }
): ResolvedSkillMovementPolicy => ({
    ...movementPolicy,
    ...overrides,
    movementModel: {
        ...movementPolicy.movementModel,
        ...(overrides.movementModel || {})
    }
});

const resolveLandingMovementPolicy = (
    movementPolicy: ResolvedSkillMovementPolicy
): ResolvedSkillMovementPolicy => cloneMovementPolicy(movementPolicy, {
    ignoreWalls: false,
    ignoreGroundHazards: false,
    movementModel: {
        ...movementPolicy.movementModel,
        pathing: 'walk',
        ignoreWalls: false,
        ignoreGroundHazards: false
    }
});

const resolveTraversalMovementPolicies = (
    movementPolicy: ResolvedSkillMovementPolicy
): ResolvedSkillMovementPolicy[] => {
    if (movementPolicy.pathing !== 'walk') return [movementPolicy];
    if (!movementPolicy.ignoreWalls && !movementPolicy.ignoreGroundHazards) return [movementPolicy];
    return [
        resolveLandingMovementPolicy(movementPolicy),
        movementPolicy
    ];
};

const resolveTransitionOptions = (
    traversalPolicy: ResolvedSkillMovementPolicy
) => ({
    ignoreActors: true,
    ignoreGroundHazards: traversalPolicy.ignoreGroundHazards
        || traversalPolicy.pathing === 'flight'
        || traversalPolicy.pathing === 'teleport',
    ignoreWalls: traversalPolicy.ignoreWalls
});

const resolveMovementBaseRange = (
    definition: SkillRuntimeDefinition,
    attacker: Actor
): number => {
    const movementPolicy = definition.movementPolicy;
    if (!movementPolicy || movementPolicy.rangeSource !== 'actor_speed') {
        return definition.baseVariables.range;
    }
    return Math.max(attacker.speed || 1, 1);
};

const applyFreeMoveRangeOverride = (
    movementPolicy: RuntimeMovementPolicy | undefined,
    state: GameState,
    resolved: ResolvedSkillMovementPolicy
): ResolvedSkillMovementPolicy => {
    if (!movementPolicy) return resolved;
    if (!isFreeMoveMode(state)) return resolved;
    if (movementPolicy.freeMoveRangeOverride === undefined) return resolved;
    return {
        ...resolved,
        range: movementPolicy.freeMoveRangeOverride
    };
};

const collectReachableMovementTargetsWithPolicy = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    actor: Actor,
    origin: Point,
    movePoints: number,
    traversalPolicy: ResolvedSkillMovementPolicy,
    landingPolicy: ResolvedSkillMovementPolicy
): Point[] => {
    const visited = new Map<string, number>();
    const out: Point[] = [];
    const key = (point: Point) => `${point.q},${point.r}`;
    const queue: Array<{ point: Point; remaining: number }> = [{ point: origin, remaining: movePoints }];
    visited.set(key(origin), movePoints);

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (current.remaining <= 0) continue;

        for (const next of getNeighbors(current.point)) {
            const traversal = validateMovementTraversalStep(state, actor, next, traversalPolicy, {
                skillId: definition.id,
                allowAlliedOccupancy: true
            });
            if (!traversal.isValid) continue;

            const resolvedTile = UnifiedTileService.getTileAt(state, next);
            const transition = TileResolver.processTransition(
                actor,
                resolvedTile,
                state,
                current.remaining,
                resolveTransitionOptions(traversalPolicy)
            );
            const nextKey = key(next);
            const nextRemaining = transition.newMomentum ?? Math.max(0, current.remaining - 1);
            if (visited.has(nextKey) && visited.get(nextKey)! >= nextRemaining) continue;

            visited.set(nextKey, nextRemaining);
            if (validateMovementDestination(
                state,
                actor,
                next,
                landingPolicy,
                definition.movementPolicy?.validateDestination
            ).isValid) {
                out.push(next);
            }
            if (!transition.interrupt && nextRemaining > 0) {
                queue.push({ point: next, remaining: nextRemaining });
            }
        }
    }

    return out;
};

const findMovementPathWithPolicy = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    actor: Actor,
    origin: Point,
    target: Point,
    movePoints: number,
    traversalPolicy: ResolvedSkillMovementPolicy,
    landingPolicy: ResolvedSkillMovementPolicy
): Point[] | null => {
    const key = (point: Point) => `${point.q},${point.r}`;
    const parseKey = (value: string): Point => {
        const [q, r] = value.split(',').map(Number);
        return { q, r, s: -q - r };
    };

    const queue: Point[] = [origin];
    const remaining = new Map<string, number>([[key(origin), movePoints]]);
    const cameFrom = new Map<string, string | null>([[key(origin), null]]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        const currentKey = key(current);
        const currentRemaining = remaining.get(currentKey)!;
        if (currentRemaining <= 0) continue;

        for (const next of getNeighbors(current)) {
            const traversal = validateMovementTraversalStep(state, actor, next, traversalPolicy, {
                skillId: definition.id,
                allowAlliedOccupancy: true
            });
            if (!traversal.isValid) continue;

            const resolvedTile = UnifiedTileService.getTileAt(state, next);
            const transition = TileResolver.processTransition(
                actor,
                resolvedTile,
                state,
                currentRemaining,
                resolveTransitionOptions(traversalPolicy)
            );
            const nextKey = key(next);
            const nextRemaining = transition.newMomentum ?? Math.max(0, currentRemaining - 1);
            if (remaining.has(nextKey) && remaining.get(nextKey)! >= nextRemaining) continue;

            remaining.set(nextKey, nextRemaining);
            cameFrom.set(nextKey, currentKey);
            if (!transition.interrupt && nextRemaining > 0) {
                queue.push(next);
            }
        }
    }

    const targetKey = key(target);
    if (!cameFrom.has(targetKey)) return null;
    if (!validateMovementDestination(
        state,
        actor,
        target,
        landingPolicy,
        definition.movementPolicy?.validateDestination
    ).isValid) {
        return null;
    }

    const path: Point[] = [];
    let currentKey: string | null = targetKey;
    while (currentKey) {
        path.push(parseKey(currentKey));
        currentKey = cameFrom.get(currentKey) || null;
    }
    path.reverse();
    return path;
};

export const resolveRuntimeMovementPolicy = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    attacker: Actor,
    target?: Point
): ResolvedSkillMovementPolicy | undefined => {
    const movementPolicy = definition.movementPolicy;
    if (!movementPolicy) return undefined;

    const baseRange = (() => {
        if (movementPolicy.freeMoveRangeOverride !== undefined && isFreeMoveMode(state)) {
            return movementPolicy.freeMoveRangeOverride;
        }
        return resolveMovementBaseRange(definition, attacker);
    })();

    const resolved = resolveSkillMovementPolicy(state, attacker, {
        skillId: definition.id,
        target,
        baseRange,
        basePathing: movementPolicy.basePathing || 'walk',
        baseIgnoreWalls: movementPolicy.baseIgnoreWalls,
        baseIgnoreGroundHazards: movementPolicy.baseIgnoreGroundHazards,
        baseAllowPassThroughActors: movementPolicy.baseAllowPassThroughActors
    });

    return applyFreeMoveRangeOverride(movementPolicy, state, resolved);
};

export const resolveRuntimeReachableMovementTargets = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    actor: Actor,
    origin: Point = actor.position
): Point[] => {
    const movementPolicy = resolveRuntimeMovementPolicy(definition, state, actor);
    if (!movementPolicy) return [];
    const movePoints = movementPolicy.range;
    const landingPolicy = resolveLandingMovementPolicy(movementPolicy);

    if (movementPolicy.pathing === 'teleport') {
        return SpatialSystem.getAreaTargets(state, origin, movePoints).filter(next => {
            if (hexEquals(next, origin)) return false;
            return validateMovementDestination(
                state,
                actor,
                next,
                landingPolicy,
                definition.movementPolicy?.validateDestination
            ).isValid;
        });
    }

    const outByKey = new Map<string, Point>();
    for (const traversalPolicy of resolveTraversalMovementPolicies(movementPolicy)) {
        const reachable = collectReachableMovementTargetsWithPolicy(
            definition,
            state,
            actor,
            origin,
            movePoints,
            traversalPolicy,
            landingPolicy
        );
        for (const point of reachable) {
            const key = `${point.q},${point.r}`;
            if (!outByKey.has(key)) {
                outByKey.set(key, point);
            }
        }
    }

    return [...outByKey.values()];
};

const findRuntimeMovementPath = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    actor: Actor,
    origin: Point,
    target: Point,
    movementPolicy: ResolvedSkillMovementPolicy
): Point[] | null => {
    const movePoints = movementPolicy.range;
    const landingPolicy = resolveLandingMovementPolicy(movementPolicy);

    if (movementPolicy.pathing === 'teleport') {
        if (hexEquals(origin, target)) return null;
        if (hexDistance(origin, target) > movePoints) return null;
        if (!validateMovementDestination(
            state,
            actor,
            target,
            landingPolicy,
            definition.movementPolicy?.validateDestination
        ).isValid) {
            return null;
        }
        return [origin, target];
    }

    for (const traversalPolicy of resolveTraversalMovementPolicies(movementPolicy)) {
        const path = findMovementPathWithPolicy(
            definition,
            state,
            actor,
            origin,
            target,
            movePoints,
            traversalPolicy,
            landingPolicy
        );
        if (path) return path;
    }

    return null;
};

export interface RuntimeMovementExecutionPlan {
    movementPolicy: ResolvedSkillMovementPolicy;
    range: number;
    path: Point[] | null;
    destination: Point;
    interruptionMessage?: string;
}

export const resolveRuntimeMovementExecutionPlan = (
    definition: SkillRuntimeDefinition,
    state: GameState,
    actor: Actor,
    target: Point
): RuntimeMovementExecutionPlan | undefined => {
    const movementPolicy = resolveRuntimeMovementPolicy(definition, state, actor, target);
    if (!movementPolicy) return undefined;

    let path = findRuntimeMovementPath(definition, state, actor, actor.position, target, movementPolicy);
    if (!path || path.length < 2) {
        return {
            movementPolicy,
            range: movementPolicy.range,
            path,
            destination: target
        };
    }

    let destination = target;
    let interruptionMessage: string | undefined;
    if (definition.movementPolicy?.freeMoveRangeOverride !== undefined
        && actor.id === state.player.id
        && isFreeMoveMode(state)) {
        const interruption = resolveFreeMoveInterruption(state, path);
        if (interruption.interrupted) {
            destination = interruption.destination;
            const destinationIndex = path.findIndex(point => hexEquals(point, destination));
            if (destinationIndex > 0) {
                path = path.slice(0, destinationIndex + 1);
            }
            const spottingEnemy = state.enemies.find(enemy => enemy.id === interruption.spottedByEnemyId);
            const enemyLabel = spottingEnemy?.subtype || interruption.spottedByEnemyId || 'an enemy';
            interruptionMessage = `Spotted by ${enemyLabel}. Free Move interrupted.`;
        }
    }

    return {
        movementPolicy,
        range: movementPolicy.range,
        path,
        destination,
        interruptionMessage
    };
};
