import type { Point } from '../types';
import { createHex, pointToKey } from '../hex';
import { hexDistanceInt } from './math/hex-int';
import {
    buildEdgeSignature,
    buildEdgesFromTileKeys,
    buildPathBendKeys,
    computeMaxStraightRun,
    isHazardousPathTile,
    isPathEligibleTile,
    parseKeyToHex,
    resolveTileRouteMembership,
    sortPathEdges,
    walkableNeighborKeys
} from './compiler-path-utils';
import type {
    AuthoredFloorSpec,
    AuthoredPathOverride,
    FloorIntentRequest,
    GeneratedPathNetwork,
    GenerationFailure,
    ModulePlan,
    NarrativeAnchor,
    PathEdge,
    PathLandmark,
    PathSegment,
    RouteMembership,
    RouteProfile,
    SpatialPlan,
    TopologicalBlueprint
} from './schema';
import type { Tile } from '../systems/tiles/tile-types';
import type { BaseArena } from './compiler-context';
import { buildPathDiagnostics } from './artifact-helpers';

type AuthoredFloor = AuthoredFloorSpec;

const getPathOverride = (
    authoredFloor: AuthoredFloor | undefined,
    targetId: string
): AuthoredPathOverride | undefined => authoredFloor?.pathOverrides?.[targetId];

const resolveLandmarkRoute = (
    override: AuthoredPathOverride | undefined,
    onPathDefault: boolean,
    fallbackMembership: Exclude<RouteMembership, 'hidden'>
): { onPath: boolean; routeMembership: RouteMembership } => {
    if (override?.routeHint === 'hidden') {
        return {
            onPath: false,
            routeMembership: 'hidden'
        };
    }
    if (override?.routeHint === 'primary' || override?.routeHint === 'alternate') {
        const onPath = override.onPath ?? true;
        return {
            onPath,
            routeMembership: onPath ? override.routeHint : 'hidden'
        };
    }
    const onPath = override?.onPath ?? onPathDefault;
    return {
        onPath,
        routeMembership: onPath ? fallbackMembership : 'hidden'
    };
};

const buildOrderedMainLandmarks = (landmarks: PathLandmark[], tiles: Map<string, Tile>): string[] | GenerationFailure => {
    const landmarksById = new Map(landmarks.map(landmark => [landmark.id, landmark]));
    const start = landmarksById.get('entry');
    const exit = landmarksById.get('exit');
    if (!start || !exit) {
        return {
            stage: 'buildTacticalPathNetwork',
            code: 'TACTICAL_PATH_START_EXIT_UNREACHABLE',
            severity: 'error',
            conflict: {
                authoredId: 'arena',
                constraintType: 'TACTICAL_PATH_START_EXIT_UNREACHABLE',
                spatialContext: {
                    hexes: [start?.point || createHex(0, 0), exit?.point || createHex(0, 0)],
                    anchorIds: ['entry', 'exit']
                }
            },
            diagnostics: ['Path landmarks must include entry and exit.']
        };
    }

    const mainCandidates = landmarks
        .filter(landmark =>
            landmark.onPath
            && landmark.routeMembership !== 'alternate'
            && landmark.id !== 'entry'
            && landmark.id !== 'exit'
        )
        .sort((left, right) =>
            left.orderHint - right.orderHint
            || hexDistanceInt(start.point, left.point) - hexDistanceInt(start.point, right.point)
            || left.id.localeCompare(right.id)
        );

    const chain = ['entry', 'exit'];
    for (const candidate of mainCandidates) {
        let bestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;
        for (let index = 1; index < chain.length; index += 1) {
            const previousId = chain[index - 1]!;
            const nextId = chain[index]!;
            const previous = landmarksById.get(previousId)!;
            const next = landmarksById.get(nextId)!;
            const direct = findShortestPath(tiles, [pointToKey(previous.point)], pointToKey(next.point), new Set());
            const toCandidate = findShortestPath(tiles, [pointToKey(previous.point)], pointToKey(candidate.point), new Set());
            const fromCandidate = findShortestPath(tiles, [pointToKey(candidate.point)], pointToKey(next.point), new Set());
            if (!toCandidate || !fromCandidate) continue;
            const score = toCandidate.cost + fromCandidate.cost - (direct?.cost ?? 0);
            if (score < bestScore || (score === bestScore && index < bestIndex)) {
                bestScore = score;
                bestIndex = index;
            }
        }
        if (bestIndex === -1) {
            return {
                stage: 'buildTacticalPathNetwork',
                code: 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                severity: 'error',
                conflict: {
                    authoredId: candidate.id,
                    constraintType: 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                    spatialContext: {
                        hexes: [candidate.point],
                        anchorIds: [candidate.id]
                    }
                },
                diagnostics: [`Main-path landmark ${candidate.id} cannot be connected to the route chain.`]
            };
        }
        chain.splice(bestIndex, 0, candidate.id);
    }

    return chain;
};

interface ShortestPathResult {
    sourceKey: string;
    cost: number;
    tileKeys: string[];
    edges: PathEdge[];
}

const findShortestPath = (
    tiles: Map<string, Tile>,
    sourceKeys: string[],
    targetKey: string,
    reusedKeys: ReadonlySet<string>,
    options: {
        blockedKeys?: ReadonlySet<string>;
        disfavoredKeys?: ReadonlySet<string>;
        disfavorCost?: number;
    } = {}
): ShortestPathResult | undefined => {
    const blockedKeys = options.blockedKeys || new Set<string>();
    const disfavoredKeys = options.disfavoredKeys || new Set<string>();
    const disfavorCost = options.disfavorCost ?? 25;
    const normalizedSources = sourceKeys
        .filter((key, index, values) => values.indexOf(key) === index)
        .filter((key) => isPathEligibleTile(tiles.get(key)) && (!blockedKeys.has(key) || key === targetKey))
        .sort((left, right) => left.localeCompare(right));

    if (normalizedSources.length === 0 || !isPathEligibleTile(tiles.get(targetKey)) || (blockedKeys.has(targetKey) && !normalizedSources.includes(targetKey))) {
        return undefined;
    }
    if (normalizedSources.includes(targetKey)) {
        return {
            sourceKey: targetKey,
            cost: 0,
            tileKeys: [targetKey],
            edges: []
        };
    }

    const frontier: Array<{ key: string; cost: number }> = [];
    const distanceByKey = new Map<string, number>();
    const predecessorByKey = new Map<string, string>();
    const originByKey = new Map<string, string>();

    normalizedSources.forEach(sourceKey => {
        frontier.push({ key: sourceKey, cost: 0 });
        distanceByKey.set(sourceKey, 0);
        originByKey.set(sourceKey, sourceKey);
    });

    while (frontier.length > 0) {
        let bestIndex = 0;
        for (let index = 1; index < frontier.length; index += 1) {
            const candidate = frontier[index]!;
            const currentBest = frontier[bestIndex]!;
            if (candidate.cost < currentBest.cost || (candidate.cost === currentBest.cost && candidate.key.localeCompare(currentBest.key) < 0)) {
                bestIndex = index;
            }
        }

        const current = frontier.splice(bestIndex, 1)[0]!;
        const bestKnownCost = distanceByKey.get(current.key);
        if (bestKnownCost === undefined || current.cost !== bestKnownCost) continue;
        if (current.key === targetKey) break;

        const point = parseKeyToHex(current.key);
        const neighbors = walkableNeighborKeys(point).sort((left, right) => left.localeCompare(right));
        neighbors.forEach(neighborKey => {
            const tile = tiles.get(neighborKey);
            if (blockedKeys.has(neighborKey) && neighborKey !== targetKey) return;
            if (!isPathEligibleTile(tile)) return;
            const baseCost = isHazardousPathTile(tile) ? 30 : 10;
            const reuseBonus = reusedKeys.has(neighborKey) ? 5 : 0;
            const disfavorPenalty = disfavoredKeys.has(neighborKey) && !normalizedSources.includes(neighborKey) && neighborKey !== targetKey
                ? disfavorCost
                : 0;
            const edgeCost = Math.max(1, baseCost - reuseBonus + disfavorPenalty);
            const candidateCost = current.cost + edgeCost;
            const knownCost = distanceByKey.get(neighborKey);
            if (knownCost !== undefined && candidateCost >= knownCost) return;
            distanceByKey.set(neighborKey, candidateCost);
            predecessorByKey.set(neighborKey, current.key);
            originByKey.set(neighborKey, originByKey.get(current.key) || current.key);
            frontier.push({ key: neighborKey, cost: candidateCost });
        });
    }

    const resolvedCost = distanceByKey.get(targetKey);
    if (resolvedCost === undefined) return undefined;

    const reversedKeys: string[] = [];
    let currentKey: string | undefined = targetKey;
    while (currentKey) {
        reversedKeys.push(currentKey);
        if (normalizedSources.includes(currentKey)) break;
        currentKey = predecessorByKey.get(currentKey);
    }

    const tileKeys = reversedKeys.reverse();
    const sourceKey = originByKey.get(targetKey) || tileKeys[0] || targetKey;

    return {
        sourceKey,
        cost: resolvedCost,
        tileKeys,
        edges: buildEdgesFromTileKeys(tileKeys)
    };
};

const buildAlternateRouteSegment = (
    tiles: Map<string, Tile>,
    primarySegments: PathSegment[],
    landmarkById: Map<string, PathLandmark>,
    routeProfile: RouteProfile
): { segment: PathSegment; junctionTileKeys: string[]; sharedLandmarkIds: string[] } | undefined => {
    const primaryTrail = primarySegments.reduce<string[]>((trail, segment, index) => (
        index === 0
            ? [...segment.tileKeys]
            : [...trail, ...segment.tileKeys.slice(1)]
    ), []);
    if (routeProfile.minRouteCount < 2 || primaryTrail.length < Math.max(6, routeProfile.minBranchSeparationTiles + 3)) {
        return undefined;
    }

    const desiredSplitIndex = Math.max(1, Math.floor((primaryTrail.length - 1) / 3));
    const desiredMergeIndex = Math.min(
        primaryTrail.length - 2,
        Math.max(desiredSplitIndex + 2, Math.ceil(((primaryTrail.length - 1) * 2) / 3))
    );
    const pairCandidates: Array<{ splitIndex: number; mergeIndex: number; score: number }> = [];
    for (let splitIndex = 1; splitIndex <= Math.max(1, primaryTrail.length - 4); splitIndex += 1) {
        for (let mergeIndex = splitIndex + 2; mergeIndex <= primaryTrail.length - 2; mergeIndex += 1) {
            const score = Math.abs(splitIndex - desiredSplitIndex) + Math.abs(mergeIndex - desiredMergeIndex);
            pairCandidates.push({ splitIndex, mergeIndex, score });
        }
    }
    pairCandidates.sort((left, right) =>
        left.score - right.score
        || (right.mergeIndex - right.splitIndex) - (left.mergeIndex - left.splitIndex)
        || left.splitIndex - right.splitIndex
    );

    const primaryTileSet = new Set(primarySegments.flatMap(segment => segment.tileKeys));
    for (const candidate of pairCandidates) {
        const sourceKey = primaryTrail[candidate.splitIndex]!;
        const targetKey = primaryTrail[candidate.mergeIndex]!;
        if (sourceKey === targetKey) continue;
        const splitSegment = primarySegments.find(segment => segment.tileKeys.includes(sourceKey));
        const mergeSegment = [...primarySegments].reverse().find(segment => segment.tileKeys.includes(targetKey));
        const splitLandmarkId = splitSegment?.fromLandmarkId || 'entry';
        const mergeLandmarkId = mergeSegment?.toLandmarkId || 'exit';
        const betweenPrimaryKeys = new Set<string>();
        primaryTrail.slice(candidate.splitIndex, candidate.mergeIndex + 1).forEach(key => betweenPrimaryKeys.add(key));
        betweenPrimaryKeys.delete(sourceKey);
        betweenPrimaryKeys.delete(targetKey);

        const alternatePath = findShortestPath(
            tiles,
            [sourceKey],
            targetKey,
            new Set<string>(),
            {
                disfavoredKeys: betweenPrimaryKeys,
                disfavorCost: 60
            }
        );
        if (!alternatePath) continue;

        const offPrimaryKeys = alternatePath.tileKeys.filter(key =>
            key !== sourceKey
            && key !== targetKey
            && !primaryTileSet.has(key)
        );
        if (new Set(offPrimaryKeys).size < routeProfile.minBranchSeparationTiles) continue;

        return {
            segment: {
                id: `alternate:${splitLandmarkId}->${mergeLandmarkId}`,
                fromLandmarkId: splitLandmarkId,
                toLandmarkId: mergeLandmarkId,
                tileKeys: alternatePath.tileKeys,
                edges: alternatePath.edges,
                kind: 'alternate',
                routeMembership: 'alternate'
            },
            junctionTileKeys: [sourceKey, targetKey],
            sharedLandmarkIds: Array.from(landmarkById.values())
                .filter(landmark => {
                    const key = pointToKey(landmark.point);
                    return key === sourceKey || key === targetKey;
                })
                .map(landmark => landmark.id)
        };
    }

    return undefined;
};

export const buildPathLandmarks = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    blueprint: TopologicalBlueprint,
    spatialPlan: SpatialPlan,
    modulePlan: ModulePlan,
    logicAnchors: NarrativeAnchor[],
    authoredFloor: AuthoredFloor | undefined
): {
    landmarks: PathLandmark[];
    modulePlan: ModulePlan;
    logicAnchors: NarrativeAnchor[];
    spatialPlan: SpatialPlan;
} => {
    const slotById = new Map(blueprint.slots.map(slot => [slot.id, slot]));
    const secondaryRouteFallback: Exclude<RouteMembership, 'hidden'> = blueprint.role === 'boss' ? 'primary' : 'alternate';
    const resolveReachablePoint = (preferredPoint: Point, footprintKeys?: string[]): Point => {
        if (isPathEligibleTile(tiles.get(pointToKey(preferredPoint)))) return preferredPoint;
        const candidates = (footprintKeys || [])
            .filter(key => isPathEligibleTile(tiles.get(key)))
            .map(key => parseKeyToHex(key))
            .sort((left, right) =>
                hexDistanceInt(preferredPoint, left) - hexDistanceInt(preferredPoint, right)
                || pointToKey(left).localeCompare(pointToKey(right))
            );
        return candidates[0] || preferredPoint;
    };

    const modulePlacements = modulePlan.placements
        .map(placement => {
            const slot = slotById.get(placement.slotId);
            const override = getPathOverride(authoredFloor, placement.slotId);
            const route = resolveLandmarkRoute(
                override,
                slot?.onPathDefault ?? false,
                placement.slotId === 'secondary_slot' ? secondaryRouteFallback : 'primary'
            );
            return {
                ...placement,
                onPath: route.onPath
            };
        })
        .sort((left, right) => left.slotId.localeCompare(right.slotId));

    const pointToModule = new Map<string, ModulePlan['placements'][number]>();
    modulePlacements.forEach(placement => {
        pointToModule.set(pointToKey(placement.anchor), placement);
        placement.footprintKeys.forEach(key => pointToModule.set(key, placement));
    });

    const resolveContainingPlacement = (point: Point): ModulePlan['placements'][number] | undefined => {
        const directKey = pointToKey(point);
        return pointToModule.get(directKey)
            || modulePlacements.find((placement) =>
                pointToKey(placement.anchor) === directKey || placement.footprintKeys.includes(directKey)
            );
    };

    const logicAnchorResults = logicAnchors
        .map(anchor => {
            const override = getPathOverride(authoredFloor, anchor.id);
            const containingPlacement = resolveContainingPlacement(anchor.point);
            const resolvedPoint = resolveReachablePoint(anchor.point, containingPlacement?.footprintKeys);
            const resolvedPlacement = resolveContainingPlacement(resolvedPoint) || containingPlacement;
            const route = resolveLandmarkRoute(
                override,
                resolvedPlacement?.onPath ?? false,
                resolvedPlacement?.slotId === 'secondary_slot' ? secondaryRouteFallback : 'primary'
            );
            return {
                ...anchor,
                point: resolvedPoint,
                onPath: route.onPath
            };
        })
        .sort((left, right) => left.id.localeCompare(right.id));

    const landmarks: PathLandmark[] = [];
    const addLandmark = (landmark: PathLandmark) => {
        landmarks.push(landmark);
    };

    addLandmark({
        id: 'entry',
        kind: 'start',
        point: arena.playerSpawn,
        onPath: true,
        routeMembership: 'shared',
        reachable: false,
        orderHint: getPathOverride(authoredFloor, 'entry')?.pathOrder ?? 0
    });
    addLandmark({
        id: 'exit',
        kind: 'exit',
        point: arena.stairsPosition,
        onPath: true,
        routeMembership: 'shared',
        reachable: false,
        orderHint: getPathOverride(authoredFloor, 'exit')?.pathOrder ?? 1000
    });
    if (arena.shrinePosition) {
        const shrineOverride = getPathOverride(authoredFloor, 'shrine');
        const shrineRoute = resolveLandmarkRoute(shrineOverride, true, 'shared');
        addLandmark({
            id: 'shrine',
            kind: 'shrine',
            point: arena.shrinePosition,
            onPath: shrineRoute.onPath,
            routeMembership: shrineRoute.routeMembership,
            reachable: false,
            orderHint: shrineOverride?.pathOrder ?? 150
        });
    }

    modulePlacements.forEach(placement => {
        const slot = slotById.get(placement.slotId);
        const override = getPathOverride(authoredFloor, placement.slotId);
        const route = resolveLandmarkRoute(
            override,
            placement.onPath,
            placement.slotId === 'secondary_slot' ? secondaryRouteFallback : 'primary'
        );
        addLandmark({
            id: placement.slotId,
            kind: 'module',
            point: resolveReachablePoint(placement.anchor, placement.footprintKeys),
            sourceId: placement.moduleId,
            onPath: route.onPath,
            routeMembership: route.routeMembership,
            reachable: false,
            orderHint: override?.pathOrder ?? slot?.pathOrderDefault ?? 300
        });
    });

    logicAnchorResults.forEach(anchor => {
        const override = getPathOverride(authoredFloor, anchor.id);
        const containingPlacement = resolveContainingPlacement(anchor.point);
        const route = resolveLandmarkRoute(
            override,
            anchor.onPath ?? false,
            containingPlacement?.slotId === 'secondary_slot' ? secondaryRouteFallback : 'primary'
        );
        addLandmark({
            id: anchor.id,
            kind: 'logic_anchor',
            point: anchor.point,
            sourceId: anchor.kind,
            onPath: route.onPath,
            routeMembership: route.routeMembership,
            reachable: false,
            orderHint: override?.pathOrder ?? ((containingPlacement?.onPath ? 250 : 300))
        });
    });

    const sortedLandmarks = landmarks.sort((left, right) =>
        left.orderHint - right.orderHint
        || left.id.localeCompare(right.id)
    );

    return {
        landmarks: sortedLandmarks,
        modulePlan: {
            placements: modulePlacements
        },
        logicAnchors: logicAnchorResults,
        spatialPlan: {
            ...spatialPlan,
            mainLandmarkIds: sortedLandmarks.filter(landmark => landmark.onPath).map(landmark => landmark.id),
            primaryLandmarkIds: sortedLandmarks
                .filter(landmark => landmark.routeMembership === 'primary' || landmark.routeMembership === 'shared')
                .map(landmark => landmark.id),
            alternateLandmarkIds: sortedLandmarks
                .filter(landmark => landmark.routeMembership === 'alternate' || landmark.routeMembership === 'shared')
                .map(landmark => landmark.id),
            hiddenLandmarkIds: sortedLandmarks.filter(landmark => !landmark.onPath).map(landmark => landmark.id)
        }
    };
};

export const buildTacticalPathNetwork = (
    tiles: Map<string, Tile>,
    landmarks: PathLandmark[],
    routeProfile: RouteProfile
): { pathNetwork: GeneratedPathNetwork; diagnostics: string[] } | GenerationFailure => {
    const mainChain = buildOrderedMainLandmarks(landmarks, tiles);
    if ('stage' in mainChain) return mainChain;

    const landmarkById = new Map(landmarks.map(landmark => [landmark.id, landmark]));
    const mainTileKeys = new Set<string>();
    const tacticalTileKeys = new Set<string>();
    const tacticalEdges = new Map<string, PathEdge>();
    const segments: PathSegment[] = [];
    const primarySegments: PathSegment[] = [];

    for (let index = 1; index < mainChain.length; index += 1) {
        const fromId = mainChain[index - 1]!;
        const toId = mainChain[index]!;
        const from = landmarkById.get(fromId)!;
        const to = landmarkById.get(toId)!;
        const result = findShortestPath(
            tiles,
            [pointToKey(from.point)],
            pointToKey(to.point),
            mainTileKeys
        );
        if (!result) {
            return {
                stage: 'buildTacticalPathNetwork',
                code: fromId === 'entry' && toId === 'exit'
                    ? 'TACTICAL_PATH_START_EXIT_UNREACHABLE'
                    : 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                severity: 'error',
                conflict: {
                    authoredId: toId,
                    constraintType: fromId === 'entry' && toId === 'exit'
                        ? 'TACTICAL_PATH_START_EXIT_UNREACHABLE'
                        : 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                    spatialContext: {
                        hexes: [from.point, to.point],
                        anchorIds: [fromId, toId]
                    }
                },
                diagnostics: [`Unable to connect ${fromId} to ${toId} with a walkable main route.`]
            };
        }

        result.tileKeys.forEach(key => {
            mainTileKeys.add(key);
            tacticalTileKeys.add(key);
        });
        result.edges.forEach(edge => {
            tacticalEdges.set(buildEdgeSignature(edge), edge);
        });
        const segment: PathSegment = {
            id: `primary:${fromId}->${toId}`,
            fromLandmarkId: fromId,
            toLandmarkId: toId,
            tileKeys: result.tileKeys,
            edges: result.edges,
            kind: 'primary',
            routeMembership: 'primary'
        };
        primarySegments.push(segment);
        segments.push(segment);
    }

    let routeCount = 1;
    const junctionTileKeys = new Set<string>();
    const alternateRoute = (
        routeProfile.mode === 'dual_route'
        || routeProfile.mode === 'dual_route_pre_arena'
    ) ? buildAlternateRouteSegment(tiles, primarySegments, landmarkById, routeProfile) : undefined;

    if (alternateRoute) {
        routeCount = 2;
        alternateRoute.segment.tileKeys.forEach(key => tacticalTileKeys.add(key));
        alternateRoute.segment.edges.forEach(edge => tacticalEdges.set(buildEdgeSignature(edge), edge));
        alternateRoute.junctionTileKeys.forEach(key => junctionTileKeys.add(key));
        alternateRoute.sharedLandmarkIds.forEach(landmarkId => {
            const landmark = landmarkById.get(landmarkId);
            if (landmark && landmark.routeMembership === 'primary') {
                landmark.routeMembership = 'shared';
            }
        });
        segments.push(alternateRoute.segment);
    }

    const landmarkOwnerByMainTile: Record<string, string> = {};
    segments
        .filter(segment => segment.kind === 'primary')
        .forEach(segment => {
            segment.tileKeys.forEach((tileKey, index) => {
                const distanceToStart = index;
                const distanceToEnd = segment.tileKeys.length - 1 - index;
                const owner = distanceToStart <= distanceToEnd ? segment.fromLandmarkId : segment.toLandmarkId;
                const existingOwner = landmarkOwnerByMainTile[tileKey];
                if (!existingOwner || owner.localeCompare(existingOwner) < 0) {
                    landmarkOwnerByMainTile[tileKey] = owner;
                }
            });
        });

    const hiddenLandmarks = landmarks
        .filter(landmark => !landmark.onPath)
        .sort((left, right) =>
            left.orderHint - right.orderHint || left.id.localeCompare(right.id)
        );

    for (const landmark of hiddenLandmarks) {
        const targetKey = pointToKey(landmark.point);
        if (mainTileKeys.has(targetKey)) {
            tacticalTileKeys.add(targetKey);
            continue;
        }
        const result = findShortestPath(
            tiles,
            Array.from(mainTileKeys).sort(),
            targetKey,
            mainTileKeys
        );
        if (!result) {
            return {
                stage: 'buildTacticalPathNetwork',
                code: 'TACTICAL_PATH_OFFPATH_UNREACHABLE',
                severity: 'error',
                conflict: {
                    authoredId: landmark.id,
                    constraintType: 'TACTICAL_PATH_OFFPATH_UNREACHABLE',
                    spatialContext: {
                        hexes: [landmark.point],
                        anchorIds: [landmark.id]
                    }
                },
                diagnostics: [`Off-path landmark ${landmark.id} cannot be reached from the main route.`]
            };
        }
        result.tileKeys.forEach(key => tacticalTileKeys.add(key));
        result.edges.forEach(edge => tacticalEdges.set(buildEdgeSignature(edge), edge));
        const fromLandmarkId = landmarkOwnerByMainTile[result.sourceKey] || 'entry';
        const fromLandmark = landmarkById.get(fromLandmarkId);
        segments.push({
            id: `spur:${fromLandmarkId}->${landmark.id}`,
            fromLandmarkId,
            toLandmarkId: landmark.id,
            tileKeys: result.tileKeys,
            edges: result.edges,
            kind: 'spur',
            routeMembership: fromLandmark?.routeMembership === 'alternate' ? 'alternate' : 'primary'
        });
    }

    const reachableTileKeys = new Set(tacticalTileKeys);
    const finalizedLandmarks = landmarks.map(landmark => ({
        ...landmark,
        reachable: reachableTileKeys.has(pointToKey(landmark.point))
    }));

    const pathNetwork: GeneratedPathNetwork = {
        landmarks: finalizedLandmarks,
        tacticalTileKeys: Array.from(tacticalTileKeys).sort(),
        tacticalEdges: sortPathEdges(tacticalEdges.values()),
        visualTileKeys: [],
        visualEdges: [],
        segments: segments.sort((left, right) => left.id.localeCompare(right.id)),
        routeCount,
        junctionTileKeys: Array.from(junctionTileKeys).sort(),
        maxStraightRun: 0,
        environmentalPressureClusters: []
    };
    pathNetwork.maxStraightRun = computeMaxStraightRun(pathNetwork);

    return {
        pathNetwork,
        diagnostics: buildPathDiagnostics(pathNetwork)
    };
};

export const buildVisualPathNetwork = (
    pathNetwork: GeneratedPathNetwork
): { pathNetwork: GeneratedPathNetwork; diagnostics: string[] } => {
    const visualTileKeys = new Set<string>();
    const visualEdges = new Map<string, PathEdge>();
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .forEach(segment => {
            segment.tileKeys.forEach(key => visualTileKeys.add(key));
            segment.edges.forEach(edge => visualEdges.set(buildEdgeSignature(edge), edge));
        });

    const nextPathNetwork: GeneratedPathNetwork = {
        ...pathNetwork,
        visualTileKeys: Array.from(visualTileKeys).sort(),
        visualEdges: sortPathEdges(visualEdges.values()),
        maxStraightRun: computeMaxStraightRun({
            ...pathNetwork,
            visualTileKeys: Array.from(visualTileKeys).sort(),
            visualEdges: sortPathEdges(visualEdges.values())
        })
    };

    return {
        pathNetwork: nextPathNetwork,
        diagnostics: buildPathDiagnostics(nextPathNetwork)
    };
};
