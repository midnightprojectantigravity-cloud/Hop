import type { Actor, GameState, Point } from '../../types';
import { hexAdd, getDirectionFromTo, getHexLine, hexDirection } from '../../hex';
import { SpatialSystem } from '../spatial-system';
import { isBlockedByWall } from '../validation';
import { evaluateRuntimeSkillPredicate } from './targeting';
import type {
    ResolutionTrace,
    RuntimePointFilter,
    RuntimePointPattern,
    RuntimePointSet,
    RuntimePointRef,
    RuntimeResolvedActorRef,
    RuntimeTargetFanOut
} from './types';

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });

export interface PointResolutionDependencies {
    resolvePointRef: (
        ref: RuntimePointRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Point | undefined;
    resolveActorRef: (
        ref: RuntimeResolvedActorRef,
        attacker: Actor,
        state: GameState,
        context: PointResolutionContext
    ) => Actor | undefined;
    resolveActorAtPoint: (state: GameState, point: Point) => Actor | undefined;
    consumeRuntimeRandom: (context: PointResolutionContext) => number;
}

export interface PointResolutionContext {
    initialCasterPosition: Point;
    selectedHex?: Point;
    previousNeighbors?: Point[];
    persistentTargetIds?: string[];
    pointSetCache: Map<string, Point[]>;
    trace: ResolutionTrace;
    actorPositions: Map<string, Point>;
    targetActorId?: string;
    projectileTrace?: {
        impactKind: 'wall' | 'actor' | 'empty';
        impactHex: Point;
        impactActorId?: string;
        line: Point[];
    };
    rngState: Pick<GameState, 'rngSeed' | 'rngCounter'>;
    rngConsumption: number;
}

export const resolveInstructionPointPattern = (
    pointPattern: RuntimePointPattern | undefined,
    fanOut: RuntimeTargetFanOut | undefined
): RuntimePointPattern => pointPattern || fanOut || 'selected_hex_only';

export const expandSelectedHexPointPattern = (
    selectedHex: Point,
    state: GameState,
    context: PointResolutionContext,
    pointPattern: RuntimePointPattern
): Point[] => {
    if (pointPattern === 'selected_neighbors_only') {
        return SpatialSystem.getNeighbors(selectedHex).map(clonePoint);
    }
    if (pointPattern === 'selected_hex_plus_neighbors') {
        return [clonePoint(selectedHex), ...SpatialSystem.getNeighbors(selectedHex).map(clonePoint)];
    }
    if (pointPattern === 'selected_hex_only') {
        return [clonePoint(selectedHex)];
    }

    if (pointPattern.kind === 'perpendicular_line') {
        const directionIndex = getDirectionFromTo(context.initialCasterPosition, selectedHex);
        if (directionIndex === -1) return [];

        const sideADirection = (directionIndex + 2) % 6;
        const sideBDirection = (directionIndex + 5) % 6;
        const stepsPerSide = Math.floor(pointPattern.totalLength / 2);
        const points: Point[] = [clonePoint(selectedHex)];

        let sideA = selectedHex;
        for (let step = 0; step < stepsPerSide; step += 1) {
            sideA = hexAdd(sideA, hexDirection(sideADirection));
            if (SpatialSystem.isWithinBounds(state, sideA)) {
                points.push(clonePoint(sideA));
            }
        }

        let sideB = selectedHex;
        for (let step = 0; step < stepsPerSide; step += 1) {
            sideB = hexAdd(sideB, hexDirection(sideBDirection));
            if (SpatialSystem.isWithinBounds(state, sideB)) {
                points.push(clonePoint(sideB));
            }
        }

        return points;
    }

    return [clonePoint(selectedHex)];
};

export const applyInstructionPointFilters = (
    points: Point[],
    state: GameState,
    pointFilters: RuntimePointFilter[] | undefined
): Point[] => {
    if (!pointFilters || pointFilters.length === 0) return points;

    return points.filter(point => {
        if (pointFilters.includes('skip_blocked_by_wall') && isBlockedByWall(state, point)) {
            return false;
        }
        return true;
    });
};

export const resolvePointSet = (
    pointSet: RuntimePointSet | undefined,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: PointResolutionDependencies,
    pointFilters?: RuntimePointFilter[]
): Point[] => {
    if (!pointSet) return [];
    if (pointSet.cacheKey && context.pointSetCache.has(pointSet.cacheKey)) {
        return context.pointSetCache.get(pointSet.cacheKey)!.map(clonePoint);
    }

    if (pointSet.kind === 'line_between') {
        const from = deps.resolvePointRef(pointSet.from, attacker, state, context);
        const to = deps.resolvePointRef(pointSet.to, attacker, state, context);
        if (!from || !to) return [];
        let line = getHexLine(from, to);
        if (pointSet.includeStart === false) line = line.slice(1);
        if (pointSet.includeEnd === false) line = line.slice(0, -1);
        const resolved = applyInstructionPointFilters(line.map(clonePoint), state, pointFilters);
        if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, resolved.map(clonePoint));
        return resolved;
    }

    const center = deps.resolvePointRef(pointSet.center, attacker, state, context);
    if (!center) return [];
    const candidates: Point[] = [];
    for (let directionIndex = 0; directionIndex < 6; directionIndex += 1) {
        let cursor = clonePoint(center);
        for (let step = 0; step < pointSet.radius; step += 1) {
            cursor = hexAdd(cursor, hexDirection(directionIndex));
        }
        if (SpatialSystem.isWithinBounds(state, cursor)) {
            candidates.push(clonePoint(cursor));
        }
    }

    const filtered = candidates.filter(candidate =>
        (pointSet.predicates || []).every(predicate =>
            evaluateRuntimeSkillPredicate(
                predicate,
                state,
                deps.resolveActorRef('self', attacker, state, context) || attacker,
                candidate,
                context.trace,
                {
                    selectedHex: context.selectedHex,
                    previousNeighbors: context.previousNeighbors,
                    persistentTargetIds: context.persistentTargetIds,
                    candidateActor: deps.resolveActorAtPoint(state, candidate)
                }
            )
        )
    );

    const ordered = applyInstructionPointFilters(filtered, state, pointFilters);
    if (!pointSet.selection || pointSet.selection.mode === 'all') {
        if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, ordered.map(clonePoint));
        return ordered;
    }

    if (pointSet.selection.mode === 'first_n') {
        const limited = ordered.slice(0, Math.min(pointSet.selection.count ?? ordered.length, ordered.length));
        if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, limited.map(clonePoint));
        return limited;
    }

    const count = Math.min(pointSet.selection.count ?? ordered.length, ordered.length);
    const available = [...ordered];
    const selected: Point[] = [];
    for (let index = 0; index < count; index += 1) {
        if (available.length === 0) break;
        const roll = deps.consumeRuntimeRandom(context);
        const nextIndex = Math.floor(roll * available.length) % available.length;
        selected.push(available[nextIndex]!);
        available.splice(nextIndex, 1);
    }
    if (pointSet.cacheKey) context.pointSetCache.set(pointSet.cacheKey, selected.map(clonePoint));
    return selected;
};

export const resolveInstructionPoints = (
    pointSet: RuntimePointSet | undefined,
    pointPattern: RuntimePointPattern | undefined,
    fanOut: RuntimeTargetFanOut | undefined,
    pointFilters: RuntimePointFilter[] | undefined,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: PointResolutionDependencies
): Point[] => {
    if (pointSet) {
        return resolvePointSet(pointSet, attacker, state, context, deps, pointFilters);
    }
    const selectedHex = deps.resolvePointRef('selected_hex', attacker, state, context);
    if (!selectedHex) return [];
    return applyInstructionPointFilters(
        expandSelectedHexPointPattern(
            selectedHex,
            state,
            context,
            resolveInstructionPointPattern(pointPattern, fanOut)
        ),
        state,
        pointFilters
    );
};

export const resolveInstructionPointTargets = (
    targetRef: RuntimeResolvedActorRef | 'selected_hex',
    pointSet: RuntimePointSet | undefined,
    pointPattern: RuntimePointPattern | undefined,
    fanOut: RuntimeTargetFanOut | undefined,
    pointFilters: RuntimePointFilter[] | undefined,
    attacker: Actor,
    state: GameState,
    context: PointResolutionContext,
    deps: PointResolutionDependencies
): Array<{ point: Point; actor?: Actor; effectTarget: string | Point }> => {
    if (targetRef === 'selected_hex') {
        const points = resolveInstructionPoints(
            pointSet,
            pointPattern,
            fanOut,
            pointFilters,
            attacker,
            state,
            context,
            deps
        );
        return points.map(point => ({
            point,
            actor: deps.resolveActorAtPoint(state, point),
            effectTarget: point
        }));
    }

    const actor = deps.resolveActorRef(targetRef, attacker, state, context);
    if (!actor) return [];
    return [{
        point: clonePoint(actor.position),
        actor,
        effectTarget: actor.id
    }];
};
