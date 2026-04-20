import type { MapShape, Point } from '../types';
import { FLOOR_THEMES, GRID_HEIGHT, GRID_WIDTH } from '../constants';
import { createHex, getGridForShape, getMapRowBoundsForColumn, isTileInMapShape, pointToKey } from '../hex';
import { buildModuleRegistryIndex } from './modules';
import { hexDistanceInt, hexParity } from './math/hex-int';
import { createRng32, pickByIndex } from './rng32';
import type {
    AuthoredFloorSpec,
    ClosedPathRequirement,
    FloorIntentRequest,
    GenerationFailure,
    GenerationState,
    NarrativeSceneRequest,
    RouteProfile,
    SpatialBudget,
    TopologicalBlueprint
} from './schema';

type AuthoredFloor = AuthoredFloorSpec;

export interface BaseArena {
    allHexes: Point[];
    playerSpawn: Point;
    stairsPosition: Point;
    shrinePosition?: Point;
    center: Point;
}

export interface DungeonGenerationMapOptions {
    gridWidth?: number;
    gridHeight?: number;
    mapShape?: MapShape;
}

export const chooseSpecialPoint = (anchors: AuthoredFloor['anchors'], id: string, fallback: Point): Point => {
    const source = anchors?.[id];
    return source ? createHex(source.q, source.r) : fallback;
};

export const resolveMapConfig = (options?: DungeonGenerationMapOptions): { width: number; height: number; mapShape: MapShape } => {
    const width = Number.isInteger(options?.gridWidth) && Number(options?.gridWidth) > 0
        ? Number(options?.gridWidth)
        : GRID_WIDTH;
    const height = Number.isInteger(options?.gridHeight) && Number(options?.gridHeight) > 0
        ? Number(options?.gridHeight)
        : GRID_HEIGHT;
    return {
        width,
        height,
        mapShape: options?.mapShape === 'rectangle' ? 'rectangle' : 'diamond'
    };
};

export const expandMapConfigForAuthoredFloor = (
    resolvedMap: { width: number; height: number; mapShape: MapShape },
    authoredFloor?: AuthoredFloor
): { width: number; height: number; mapShape: MapShape } => {
    if (!authoredFloor) return resolvedMap;

    const registry = buildModuleRegistryIndex();
    let maxQ = resolvedMap.width - 1;
    let maxR = resolvedMap.height - 1;

    Object.values(authoredFloor.anchors || {}).forEach(anchor => {
        maxQ = Math.max(maxQ, anchor.q);
        maxR = Math.max(maxR, anchor.r);
    });

    (authoredFloor.pinnedModules || []).forEach((pinned) => {
        const entry = registry.entriesById[pinned.id];
        if (!entry) {
            maxQ = Math.max(maxQ, pinned.anchor.q);
            maxR = Math.max(maxR, pinned.anchor.r);
            return;
        }
        entry.footprint.forEach(local => {
            maxQ = Math.max(maxQ, pinned.anchor.q + local.dq);
            maxR = Math.max(maxR, pinned.anchor.r + local.dr);
        });
    });

    let width = maxQ + 1;
    let height = maxR + 1;
    const candidatePoints: Point[] = [];

    Object.values(authoredFloor.anchors || {}).forEach(anchor => {
        candidatePoints.push(createHex(anchor.q, anchor.r));
    });

    (authoredFloor.pinnedModules || []).forEach((pinned) => {
        const entry = registry.entriesById[pinned.id];
        if (!entry) {
            candidatePoints.push(createHex(pinned.anchor.q, pinned.anchor.r));
            return;
        }
        entry.footprint.forEach(local => {
            candidatePoints.push(createHex(pinned.anchor.q + local.dq, pinned.anchor.r + local.dr));
        });
    });

    while (candidatePoints.some(point => !isTileInMapShape(point.q, point.r, width, height, resolvedMap.mapShape))) {
        height += 1;
        width = Math.max(width, maxQ + 1);
    }

    return {
        ...resolvedMap,
        width,
        height
    };
};

const buildParityOffset = (
    requirement: ClosedPathRequirement,
    entry: Point,
    exit: Point
): { offset: number; info: SpatialBudget['closedPathOffsets'][string] } => {
    const distance = hexDistanceInt(entry, exit);
    const pathParity: 'even' | 'odd' = distance % 2 === 0 ? 'even' : 'odd';
    const requiresWiggle = (
        (distance % 2 === 1 && requirement.requiredParity === 'even')
        || (distance % 2 === 0 && requirement.requiredParity === 'odd')
    );
    const wiggleHexes = requiresWiggle ? 2 : requirement.flexibleLoop ? 1 : 0;
    return {
        offset: wiggleHexes,
        info: { distance, pathParity, requiresWiggle, wiggleHexes }
    };
};

const collectAnchors = (arena: BaseArena, authoredFloor?: AuthoredFloor): Record<string, Point> => {
    const anchors: Record<string, Point> = {
        entry: arena.playerSpawn,
        exit: arena.stairsPosition
    };
    Object.entries(authoredFloor?.anchors || {}).forEach(([id, anchor]) => {
        anchors[id] = createHex(anchor.q, anchor.r);
    });
    return anchors;
};

const resolveRouteProfile = (
    role: FloorIntentRequest['role'],
    authoredFloor?: AuthoredFloor
): RouteProfile => {
    if (authoredFloor && role !== 'boss') {
        return {
            mode: 'single',
            minRouteCount: 1,
            maxStraightRun: 5,
            minBranchSeparationTiles: 0,
            rejoinBeforeExit: true,
            obstacleClusterBudget: 1,
            trapClusterBudget: 0,
            lavaClusterBudget: 1,
            saferRouteBias: 'none',
            riskierRouteBias: 'none'
        };
    }
    switch (role) {
        case 'recovery':
            return {
                mode: 'dual_route',
                minRouteCount: 2,
                maxStraightRun: 4,
                minBranchSeparationTiles: 3,
                rejoinBeforeExit: true,
                obstacleClusterBudget: 2,
                trapClusterBudget: 1,
                lavaClusterBudget: 0,
                saferRouteBias: 'strong',
                riskierRouteBias: 'soft'
            };
        case 'pressure_spike':
            return {
                mode: 'dual_route',
                minRouteCount: 2,
                maxStraightRun: 4,
                minBranchSeparationTiles: 3,
                rejoinBeforeExit: true,
                obstacleClusterBudget: 2,
                trapClusterBudget: 2,
                lavaClusterBudget: 2,
                saferRouteBias: 'soft',
                riskierRouteBias: 'strong'
            };
        case 'elite':
            return {
                mode: 'dual_route_pre_arena',
                minRouteCount: 2,
                maxStraightRun: 4,
                minBranchSeparationTiles: 3,
                rejoinBeforeExit: true,
                obstacleClusterBudget: 2,
                trapClusterBudget: 1,
                lavaClusterBudget: 2,
                saferRouteBias: 'soft',
                riskierRouteBias: 'strong'
            };
        case 'boss':
            return {
                mode: 'arena_single',
                minRouteCount: 1,
                maxStraightRun: 5,
                minBranchSeparationTiles: 0,
                rejoinBeforeExit: true,
                obstacleClusterBudget: 1,
                trapClusterBudget: 0,
                lavaClusterBudget: 1,
                saferRouteBias: 'none',
                riskierRouteBias: 'none'
            };
        case 'onboarding':
        default:
            return {
                mode: 'single',
                minRouteCount: 1,
                maxStraightRun: 4,
                minBranchSeparationTiles: 0,
                rejoinBeforeExit: true,
                obstacleClusterBudget: 1,
                trapClusterBudget: 0,
                lavaClusterBudget: 0,
                saferRouteBias: 'none',
                riskierRouteBias: 'none'
            };
    }
};

export const buildBaseArena = (
    floor: number,
    seed: string,
    options: { width: number; height: number; mapShape: MapShape },
    authoredFloor?: AuthoredFloor
): BaseArena => {
    const rng = createRng32(`${seed}:base`);
    const { width, height, mapShape } = options;
    const allHexes = getGridForShape(width, height, mapShape);
    const centerQ = Math.floor(width / 2);
    const bounds = getMapRowBoundsForColumn(centerQ, width, height, mapShape);
    const topR = bounds?.minR ?? 0;
    const bottomR = bounds?.maxR ?? (height - 1);
    const centerR = Math.floor((topR + bottomR) / 2);
    const defaultSpawn = createHex(centerQ, bottomR);
    const defaultStairs = createHex(centerQ, topR);
    const playerSpawn = chooseSpecialPoint(authoredFloor?.anchors, 'entry', defaultSpawn);
    const stairsPosition = chooseSpecialPoint(authoredFloor?.anchors, 'exit', defaultStairs);
    const registry = buildModuleRegistryIndex();
    const reservedKeys = new Set<string>();
    Object.values(authoredFloor?.anchors || {}).forEach(anchor => {
        reservedKeys.add(pointToKey(createHex(anchor.q, anchor.r)));
    });
    (authoredFloor?.pinnedModules || []).forEach((pinned) => {
        const entry = registry.entriesById[pinned.id];
        if (!entry) {
            reservedKeys.add(pointToKey(createHex(pinned.anchor.q, pinned.anchor.r)));
            return;
        }
        entry.footprint.forEach(local => {
            reservedKeys.add(pointToKey(createHex(pinned.anchor.q + local.dq, pinned.anchor.r + local.dr)));
        });
    });
    const shrineCandidates = allHexes
        .filter(hex =>
            pointToKey(hex) !== pointToKey(playerSpawn)
            && pointToKey(hex) !== pointToKey(stairsPosition)
            && !reservedKeys.has(pointToKey(hex))
            && hexDistanceInt(hex, playerSpawn) >= 3
        )
        .sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));

    return {
        allHexes,
        playerSpawn,
        stairsPosition,
        shrinePosition: authoredFloor?.anchors?.shrine
            ? createHex(authoredFloor.anchors.shrine.q, authoredFloor.anchors.shrine.r)
            : (floor >= 1 ? pickByIndex(shrineCandidates, rng) : undefined),
        center: createHex(centerQ, centerR)
    };
};

export { collectAnchors };

export const resolveFloorIntent = (
    floor: number,
    generationState: GenerationState,
    options: { width: number; height: number; mapShape: MapShape; theme: string },
    authoredFloor?: AuthoredFloor
): FloorIntentRequest => {
    const directorState = generationState.directorState;
    const redlinePressureBand = Math.max(
        Number(directorState?.redlineBand || 0),
        Number(directorState?.resourceStressBand || 0)
    );
    const scheduledRole = floor === 10 ? 'boss'
        : floor === 1 ? 'onboarding'
        : floor % 5 === 0 ? 'elite'
            : floor % 2 === 0 ? 'pressure_spike'
                : 'recovery';
    const directorForcesRecovery = !authoredFloor?.role
        && scheduledRole !== 'boss'
        && scheduledRole !== 'elite'
        && scheduledRole !== 'onboarding'
        && redlinePressureBand >= 2;
    const role = authoredFloor?.role || (directorForcesRecovery ? 'recovery' : scheduledRole);
    const prefersSafeResetRecovery = role === 'recovery' && redlinePressureBand >= 2;

    const requiredTacticalTags = authoredFloor?.requiredTacticalTags
        ? [...authoredFloor.requiredTacticalTags].sort()
        : role === 'pressure_spike'
            ? ['choke']
            : role === 'recovery'
                ? (prefersSafeResetRecovery ? ['safe_reset'] : ['hazard_lure'])
                : role === 'elite'
                    ? ['perch']
                    : role === 'boss'
                        ? ['boss_arena']
                    : [];

    const requiredNarrativeTags = authoredFloor?.requiredNarrativeTags
        ? [...authoredFloor.requiredNarrativeTags].sort()
        : role === 'pressure_spike'
            ? ['siege_breach']
            : role === 'recovery'
                ? (prefersSafeResetRecovery ? ['failed_escape'] : ['collapsed_crossing'])
                : role === 'elite'
                    ? ['watch_post']
                    : role === 'boss'
                        ? ['ritual_site']
                    : [];
    const chokeRatioBps = role === 'pressure_spike'
        ? Math.max(4500, 8000 - (redlinePressureBand * 1000))
        : role === 'boss'
            ? Math.max(8000, 9000 - (redlinePressureBand * 250))
            : Math.max(1500, 3000 - (redlinePressureBand * 500));
    const hazardLureDemand = role === 'boss'
        ? 1
        : role === 'recovery'
            ? (prefersSafeResetRecovery ? 0 : 1)
            : 0;
    const resetBudget = role === 'recovery'
        ? Math.min(4, 2 + redlinePressureBand)
        : redlinePressureBand >= 3
            ? 1
            : 0;
    const parTurnTarget = 8
        + floor
        + Number(directorState?.tensionBand || 0)
        + Number(directorState?.resourceStressBand || 0)
        + Number(directorState?.redlineBand || 0);
    const routeProfile = resolveRouteProfile(role, authoredFloor);

    return {
        floor,
        role,
        theme: options.theme || authoredFloor?.theme || FLOOR_THEMES[floor] || 'inferno',
        board: {
            width: options.width,
            height: options.height,
            mapShape: options.mapShape
        },
        requiredTacticalTags,
        forbiddenTacticalTags: [],
        requiredNarrativeTags,
        chokeRatioBps,
        flankDemand: role === 'elite' ? 2 : 1,
        perchDemand: role === 'elite' || role === 'boss' ? 1 : 0,
        hazardLureDemand,
        resetBudget,
        parTurnTarget,
        routeProfile
    };
};

export const resolveNarrativeSceneRequest = (
    intent: FloorIntentRequest,
    generationState: GenerationState
): NarrativeSceneRequest => {
    const motif = intent.requiredNarrativeTags[0]
        || (intent.role === 'pressure_spike' ? 'siege_breach'
            : intent.role === 'boss' ? 'ritual_site'
                : intent.role === 'elite' ? 'watch_post'
                : 'collapsed_crossing');
    const repeatedRecently = generationState.sceneSignatureHistory.some(scene => scene.motif === motif);
    const alternateMotif = motif === 'watch_post' ? 'failed_escape' : 'watch_post';

    return {
        motif: repeatedRecently && intent.role !== 'elite' && intent.role !== 'boss' ? alternateMotif : motif,
        mood: intent.role === 'pressure_spike' ? 'tense' : intent.role === 'elite' || intent.role === 'boss' ? 'alert' : 'grim',
        evidenceQuota: intent.role === 'onboarding' ? 1 : intent.role === 'boss' ? 3 : 2,
        encounterPosture: intent.role === 'pressure_spike'
            ? 'fortified_hold'
            : intent.role === 'boss'
                ? 'ritual_defense'
            : intent.role === 'elite'
                ? 'crossfire_screen'
                : 'predatory_lure'
    };
};

export const buildTopologicalBlueprint = (
    intent: FloorIntentRequest,
    authoredFloor?: AuthoredFloor
): TopologicalBlueprint => {
    const slots: TopologicalBlueprint['slots'] = [];
    const hasSufficientPinnedCoverage = (authoredFloor?.pinnedModules?.length || 0) >= 2;
    const secondaryAnchor = authoredFloor?.anchors?.secondary_slot;
    const secondaryPathOverride = authoredFloor?.pathOverrides?.secondary_slot;
    const hasPinnedSecondaryModule = Boolean(
        secondaryAnchor
        && authoredFloor?.pinnedModules?.some((placed) =>
            placed.anchor.q === secondaryAnchor.q && placed.anchor.r === secondaryAnchor.r
        )
    );
    const needsExplicitSecondarySlot = Boolean(
        !hasSufficientPinnedCoverage
        || secondaryPathOverride?.onPath
        || hasPinnedSecondaryModule
    );
    if (intent.requiredTacticalTags.length > 0) {
        slots.push({
            id: 'primary_slot',
            kind: intent.requiredTacticalTags[0],
            requiredTacticalTags: [...intent.requiredTacticalTags],
            requiredNarrativeTags: [...intent.requiredNarrativeTags],
            preferredAnchorKind: 'center' as const,
            adjacencyIds: [],
            onPathDefault: true,
            pathOrderDefault: 100
        });
    }
    if (needsExplicitSecondarySlot && (intent.role === 'elite' || intent.role === 'pressure_spike' || intent.role === 'boss')) {
        slots.push({
            id: 'secondary_slot',
            kind: intent.role === 'elite' ? 'perch' : intent.role === 'boss' ? 'objective' : 'hazard_field',
            requiredTacticalTags: intent.role === 'elite' ? ['perch'] : intent.role === 'boss' ? ['boss_arena'] : ['hazard_lure'],
            requiredNarrativeTags: intent.role === 'elite' ? ['watch_post'] : intent.role === 'boss' ? ['ritual_site'] : ['collapsed_crossing'],
            preferredAnchorKind: intent.role === 'elite' ? 'upper' : intent.role === 'boss' ? 'center' : 'right',
            adjacencyIds: ['primary_slot'],
            onPathDefault: false,
            pathOrderDefault: 200
        });
    }

    return {
        floor: intent.floor,
        role: intent.role,
        theme: intent.theme,
        slots,
        closedPaths: authoredFloor?.closedPaths || []
    };
};

export const reserveSpatialBudget = (
    arena: BaseArena,
    blueprint: TopologicalBlueprint,
    authoredFloor: AuthoredFloor | undefined
): SpatialBudget | GenerationFailure => {
    const freeCellsByParity = { even: 0, odd: 0 };
    for (const cell of arena.allHexes) {
        if (hexParity(cell) === 0) freeCellsByParity.even += 1;
        else freeCellsByParity.odd += 1;
    }

    const anchorById = collectAnchors(arena, authoredFloor);

    const closedPathOffsets: SpatialBudget['closedPathOffsets'] = {};
    for (const requirement of blueprint.closedPaths) {
        const entry = anchorById[requirement.entryAnchorId];
        const exit = anchorById[requirement.exitAnchorId];
        if (!entry || !exit) {
            return {
                stage: 'reserveSpatialBudget',
                code: 'SPEC_UNKNOWN_ANCHOR',
                severity: 'error',
                conflict: {
                    authoredId: requirement.id,
                    constraintType: 'SPEC_UNKNOWN_ANCHOR',
                    spatialContext: { hexes: [], anchorIds: [requirement.entryAnchorId, requirement.exitAnchorId] }
                },
                diagnostics: [`Closed path ${requirement.id} references an unknown anchor.`]
            };
        }
        const { offset, info } = buildParityOffset(requirement, entry, exit);
        closedPathOffsets[requirement.id] = info;
        if (info.requiresWiggle && arena.allHexes.length < requirement.requiredLength + offset) {
            return {
                stage: 'reserveSpatialBudget',
                code: 'PARITY_CLOSURE_UNSAT',
                severity: 'error',
                conflict: {
                    authoredId: requirement.id,
                    constraintType: 'PARITY_CLOSURE_UNSAT',
                    spatialContext: { hexes: [entry, exit] }
                },
                diagnostics: [`Closed path ${requirement.id} cannot absorb the required ${offset}-hex parity wiggle.`]
            };
        }
    }

    return {
        freeCellsByParity,
        connectorSeatsByParity: { ...freeCellsByParity },
        loopCandidateAnchorsByParity: {
            even: arena.allHexes.filter(cell => hexParity(cell) === 0).map(pointToKey),
            odd: arena.allHexes.filter(cell => hexParity(cell) === 1).map(pointToKey)
        },
        pinnedFootprints: (authoredFloor?.pinnedModules || []).map(item => item.id),
        closedPathOffsets
    };
};
