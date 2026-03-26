import type { Entity, GameState, MapShape, Point, Room } from '../types';
import type { Tile } from '../systems/tiles/tile-types';
import { FLOOR_THEMES, GRID_HEIGHT, GRID_WIDTH } from '../constants';
import { createHex, getGridForShape, getMapRowBoundsForColumn, isTileInMapShape, pointToKey } from '../hex';
import { isSpecialTile } from '../helpers';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';
import { createRng, stableIdFromSeed } from '../systems/rng';
import { getEnemyCatalogEntry, getEnemyCatalogSkillLoadout, getFloorSpawnProfile } from '../data/enemies';
import { ensureTacticalDataBootstrapped } from '../systems/tactical-data-bootstrap';
import { getBaseUnitDefinitionBySubtype } from '../systems/entities/base-unit-registry';
import { instantiateActorFromDefinitionWithCursor, type PropensityRngCursor } from '../systems/entities/propensity-instantiation';
import { createEnemy, getEnemySkillLoadout } from '../systems/entities/entity-factory';
import { createDailySeed, toDateKey } from '../systems/run-objectives';
import { registerCompilerPassApi } from './session';
import { buildModuleRegistryIndex } from './modules';
import { hexDistanceInt, hasClearLosInt, hexParity, hexRaycastInt } from './math/hex-int';
import { createRng32, pickByIndex, shuffleStable } from './rng32';
import { advanceGenerationStateFromCompletedFloor, buildDirectorEntropyKey, createGenerationState, ensureGenerationState, initializeFloorTelemetry } from './telemetry';
import type {
    AuthoredPathOverride,
    AuthoredFloorFamilySpec,
    AuthoredFloorSpec,
    ClosedPathRequirement,
    CompiledFloorArtifact,
    CompilerPass,
    CompilerSessionInput,
    CompilerSessionResult,
    CompilerSessionState,
    ConflictTriple,
    CurrentFloorSummary,
    EnvironmentalPressureCluster,
    FloorIntentRequest,
    GeneratedPathNetwork,
    GenerationDebugSnapshot,
    GenerationFailure,
    GenerationMapShape,
    GenerationSpecInput,
    GenerationState,
    LocalHex,
    ModulePlan,
    ModulePlacement,
    NarrativeAnchor,
    NarrativeSceneRequest,
    PathEdge,
    PathLandmark,
    RouteMembership,
    RouteProfile,
    PathSegment,
    PathSummary,
    SceneSignature,
    SpatialBudget,
    SpatialClaim,
    SpatialClaimHardness,
    SpatialPlan,
    StartRunCompileContext,
    TopologicalBlueprint,
    TransitionCompileContext,
    VerificationReport
} from './schema';
import { DEFAULT_WORLDGEN_SPEC } from './specs/default-worldgen-spec';
import { lintGenerationSpecInput } from './validation';

export interface DungeonGenerationOptions {
    gridWidth?: number;
    gridHeight?: number;
    mapShape?: MapShape;
    generationSpec?: GenerationSpecInput;
    generationState?: GenerationState;
}

export interface DungeonResult {
    rooms: Room[];
    allHexes: Point[];
    stairsPosition: Point;
    shrinePosition?: Point;
    playerSpawn: Point;
    spawnPositions: Point[];
    tiles: Map<string, Tile>;
    artifactSummary?: CurrentFloorSummary;
    modulePlacements?: ModulePlacement[];
    logicAnchors?: NarrativeAnchor[];
    verificationDigest?: string;
}

export interface CompileStandaloneFloorResult {
    dungeon: DungeonResult;
    enemies: Entity[];
    generationState: GenerationState;
    verificationReport: VerificationReport;
    artifact: CompiledFloorArtifact;
    debugSnapshot?: GenerationDebugSnapshot;
    failure?: GenerationFailure;
}

interface BaseArena {
    allHexes: Point[];
    playerSpawn: Point;
    stairsPosition: Point;
    shrinePosition?: Point;
    center: Point;
}

type AuthoredFloor = AuthoredFloorSpec;

interface ResolvedAuthoredFloor {
    familyId?: string;
    spec?: AuthoredFloor;
}

interface CompilerSessionRuntimeState extends CompilerSessionState {
    resolvedMap?: { width: number; height: number; mapShape: MapShape };
    theme?: string;
    specSource?: GenerationSpecInput;
    generationStateValue?: GenerationState;
    familyId?: string;
    authoredFloor?: AuthoredFloor;
    arena?: BaseArena;
    directorEntropyKey?: string;
    occupied?: Set<string>;
    realizedTiles?: Map<string, Tile>;
    reservedKeys?: Set<string>;
    spawnPositions?: Point[];
    rooms?: Room[];
    authoredEnemySeeds?: Array<Point & { subtype: string }>;
    logicAnchors?: NarrativeAnchor[];
    pathNetworkValue?: GeneratedPathNetwork;
    pathDiagnosticsValue?: string[];
    sceneSignature?: SceneSignature;
    verificationDigest?: string;
    artifactDigest?: string;
    result?: CompilerSessionResult;
    debugSnapshotValue?: GenerationDebugSnapshot;
}

const TILE_CODE_BY_ID = {
    STONE: 0,
    WALL: 1,
    LAVA: 2,
    VOID: 3
} as const;

const TILE_ID_BY_CODE: Record<number, keyof typeof TILE_CODE_BY_ID> = {
    0: 'STONE',
    1: 'WALL',
    2: 'LAVA',
    3: 'VOID'
};

const themeDefaultClosure = (theme: string): 'WALL' | 'VOID' =>
    theme === 'inferno' ? 'WALL' : 'VOID';

const buildClaimKeySet = (
    claims: SpatialClaim[],
    hardness?: SpatialClaimHardness
): Set<string> => {
    const keys = new Set<string>();
    for (const claim of claims) {
        if (hardness && claim.hardness !== hardness) continue;
        for (const cell of claim.cells) {
            keys.add(pointToKey(cell));
        }
    }
    return keys;
};

const hashString = (value: string): string => {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
};

const stableStringify = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

const createTile = (baseId: 'STONE' | 'WALL' | 'LAVA' | 'VOID', position: Point): Tile => ({
    baseId,
    position,
    traits: new Set(BASE_TILES[baseId].defaultTraits),
    effects: []
});

const createGenerationTileState = (
    tiles: Map<string, Tile>,
    map: { width: number; height: number; mapShape: MapShape }
): GameState => ({
    tiles,
    gridWidth: map.width,
    gridHeight: map.height,
    mapShape: map.mapShape
} as GameState);

const isSpawnTraversalTile = (state: GameState, point: Point): boolean => {
    const tile = UnifiedTileService.getTileAt(state, point);
    if (tile.baseId === 'VOID') return false;
    return UnifiedTileService.isPassable(state, point);
};

const collectReachableSpawnKeys = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    map: { width: number; height: number; mapShape: MapShape }
): Set<string> => {
    const state = createGenerationTileState(tiles, map);
    const reachable = new Set<string>();
    const queue = [arena.playerSpawn];

    while (queue.length > 0) {
        const point = queue.shift()!;
        const key = pointToKey(point);
        if (reachable.has(key) || !isSpawnTraversalTile(state, point)) continue;
        reachable.add(key);
        for (const neighborKey of walkableNeighborKeys(point)) {
            const [q, r] = neighborKey.split(',').map(Number);
            queue.push(createHex(q, r));
        }
    }

    return reachable;
};

const resolveArenaSpawnPositions = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    map: { width: number; height: number; mapShape: MapShape },
    reservedKeys: ReadonlySet<string>
): { spawnPositions: Point[]; reachableKeys: Set<string> } => {
    const reachableKeys = collectReachableSpawnKeys(arena, tiles, map);
    const specials = {
        playerStart: arena.playerSpawn,
        stairsPosition: arena.stairsPosition,
        shrinePosition: arena.shrinePosition
    };
    const spawnPositions = arena.allHexes.filter(point =>
        reachableKeys.has(pointToKey(point))
        && !isSpecialTile(point, specials)
        && !reservedKeys.has(pointToKey(point))
        && hexDistanceInt(point, arena.playerSpawn) >= 3
    ).sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));

    return { spawnPositions, reachableKeys };
};

const filterAuthoredEnemySeeds = (
    seeds: Array<Point & { subtype: string }>,
    reachableKeys: ReadonlySet<string>
): Array<Point & { subtype: string }> =>
    seeds.filter(seed => reachableKeys.has(pointToKey(seed)));

const getFloorTheme = (floor: number): string => FLOOR_THEMES[floor] || 'inferno';

const defaultSpecForCompile = (spec?: GenerationSpecInput): GenerationSpecInput =>
    spec || DEFAULT_WORLDGEN_SPEC;

const mergeFloorSpec = (
    familyId: string | undefined,
    family: AuthoredFloorFamilySpec | undefined,
    floorSpec: AuthoredFloorSpec | undefined
): AuthoredFloor | undefined => {
    if (!family && !floorSpec) return undefined;
    return {
        ...(family || {}),
        ...(floorSpec || {}),
        floorFamilyId: floorSpec?.floorFamilyId || familyId,
        anchors: {
            ...(family?.anchors || {}),
            ...(floorSpec?.anchors || {})
        },
        pinnedModules: [...(family?.pinnedModules || []), ...(floorSpec?.pinnedModules || [])],
        closedPaths: floorSpec?.closedPaths || family?.closedPaths,
        preferredModuleIds: floorSpec?.preferredModuleIds || family?.preferredModuleIds,
        blockedModuleIds: [...(family?.blockedModuleIds || []), ...(floorSpec?.blockedModuleIds || [])],
        requiredTacticalTags: floorSpec?.requiredTacticalTags || family?.requiredTacticalTags,
        requiredNarrativeTags: floorSpec?.requiredNarrativeTags || family?.requiredNarrativeTags,
        enemySeeds: [...(family?.enemySeeds || []), ...(floorSpec?.enemySeeds || [])],
        tileStamps: [...(family?.tileStamps || []), ...(floorSpec?.tileStamps || [])],
        pathOverrides: {
            ...(family?.pathOverrides || {}),
            ...(floorSpec?.pathOverrides || {})
        }
    };
};

const resolveAuthoredFloor = (
    floor: number,
    spec?: GenerationSpecInput
): ResolvedAuthoredFloor => {
    const source = defaultSpecForCompile(spec);
    const familyId = source.authoredFloors?.[floor]?.floorFamilyId || source.floorFamilyAssignments?.[floor];
    const family = familyId ? source.authoredFloorFamilies?.[familyId] : undefined;
    return {
        familyId,
        spec: mergeFloorSpec(familyId, family, source.authoredFloors?.[floor])
    };
};

const chooseSpecialPoint = (anchors: AuthoredFloor['anchors'], id: string, fallback: Point): Point => {
    const source = anchors?.[id];
    return source ? createHex(source.q, source.r) : fallback;
};

const resolveMapConfig = (options?: DungeonGenerationOptions): { width: number; height: number; mapShape: MapShape } => {
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

const expandMapConfigForAuthoredFloor = (
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

const buildBaseArena = (
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

const resolveFloorIntent = (
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
        theme: authoredFloor?.theme || options.theme,
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

const resolveNarrativeSceneRequest = (
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

const buildTopologicalBlueprint = (
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

const reserveSpatialBudget = (
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

const chooseAnchorCandidates = (arena: BaseArena, kind: 'center' | 'upper' | 'lower' | 'left' | 'right'): Point[] => {
    const all = [...arena.allHexes].sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
    switch (kind) {
        case 'upper':
            return all.sort((a, b) => a.r - b.r || a.q - b.q);
        case 'lower':
            return all.sort((a, b) => b.r - a.r || a.q - b.q);
        case 'left':
            return all.sort((a, b) => a.q - b.q || a.r - b.r);
        case 'right':
            return all.sort((a, b) => b.q - a.q || a.r - b.r);
        default:
            return all.sort((a, b) =>
                hexDistanceInt(a, arena.center) - hexDistanceInt(b, arena.center)
                || pointToKey(a).localeCompare(pointToKey(b))
            );
    }
};

const toWorld = (anchor: Point, local: LocalHex): Point =>
    createHex(anchor.q + local.dq, anchor.r + local.dr);

const entryMatchesSlot = (
    entry: ReturnType<typeof buildModuleRegistryIndex>['entries'][number],
    slot: TopologicalBlueprint['slots'][number],
    theme: string,
    blockedIds: ReadonlySet<string>
): boolean =>
    entry.theme === theme
    && !blockedIds.has(entry.id)
    && slot.requiredTacticalTags.every(tag => entry.capability.tacticalTags.includes(tag))
    && slot.requiredNarrativeTags.every(tag => entry.capability.narrativeTags.includes(tag));

const getCandidateModuleEntriesForSlot = (
    slot: TopologicalBlueprint['slots'][number],
    authoredFloor: AuthoredFloor | undefined,
    theme: string,
    registry: ReturnType<typeof buildModuleRegistryIndex>,
    blockedIds: ReadonlySet<string>
) => {
    const authoredPreferred = (authoredFloor?.preferredModuleIds || [])
        .map(id => registry.entriesById[id])
        .filter((entry): entry is ReturnType<typeof buildModuleRegistryIndex>['entries'][number] => Boolean(entry))
        .filter(entry => entryMatchesSlot(entry, slot, theme, blockedIds));

    if (authoredPreferred.length > 0) {
        return authoredPreferred;
    }

    return registry.entries
        .filter(entry => entryMatchesSlot(entry, slot, theme, blockedIds))
        .sort((a, b) =>
            b.constraintDensityScore - a.constraintDensityScore
            || a.id.localeCompare(b.id)
        );
};

const fitsFootprint = (
    anchor: Point,
    footprint: LocalHex[],
    arena: BaseArena,
    occupied: ReadonlySet<string>,
    allowedOccupiedKeys: ReadonlySet<string> = new Set<string>()
): boolean => {
    const specials = {
        playerStart: arena.playerSpawn,
        stairsPosition: arena.stairsPosition,
        shrinePosition: arena.shrinePosition
    };
    return footprint.every(local => {
        const point = toWorld(anchor, local);
        const key = pointToKey(point);
        return arena.allHexes.some(cell => pointToKey(cell) === key)
            && (!occupied.has(key) || allowedOccupiedKeys.has(key))
            && !isSpecialTile(point, specials);
    });
};

const embedSpatialPlan = (
    arena: BaseArena,
    blueprint: TopologicalBlueprint,
    authoredFloor: AuthoredFloor | undefined,
    theme: string,
    rngSeed: string
): { spatialPlan: SpatialPlan; occupied: Set<string> } | GenerationFailure => {
    const rng = createRng32(`${rngSeed}:embed`);
    const occupied = new Set<string>();
    const anchorById: Record<string, Point> = collectAnchors(arena, authoredFloor);
    const slotPlacements = [];
    const gasketAnchors: Record<string, Point> = {};
    const registry = buildModuleRegistryIndex();
    const blockedIds = new Set(authoredFloor?.blockedModuleIds || []);

    Object.values(anchorById).forEach(anchor => occupied.add(pointToKey(anchor)));

    for (const slot of blueprint.slots) {
        const candidateEntries = getCandidateModuleEntriesForSlot(slot, authoredFloor, theme, registry, blockedIds);
        if (candidateEntries.length === 0 && slot.requiredTacticalTags.length > 0) {
            return {
                stage: 'embedSpatialPlan',
                code: 'EMBED_SLOT_UNSAT',
                severity: 'error',
                conflict: {
                    authoredId: slot.id,
                    constraintType: 'EMBED_SLOT_UNSAT',
                    spatialContext: { hexes: [], anchorIds: [slot.id] }
                },
                diagnostics: [`No module domain could satisfy slot ${slot.id} during embedding.`]
            };
        }
        const anchorFitsSlot = (anchor: Point) =>
            candidateEntries.some(entry =>
                fitsFootprint(anchor, entry.footprint, arena, occupied, new Set([pointToKey(anchor)]))
            );
        const existing = anchorById[slot.id];
        if (existing) {
            if (!anchorFitsSlot(existing)) {
                return {
                    stage: 'embedSpatialPlan',
                    code: 'EMBED_SLOT_UNSAT',
                    severity: 'error',
                    conflict: {
                        authoredId: slot.id,
                        constraintType: 'EMBED_SLOT_UNSAT',
                        spatialContext: { hexes: [existing], anchorIds: [slot.id] }
                    },
                    diagnostics: [`Slot ${slot.id} is pinned to ${pointToKey(existing)}, but no module footprint can fit there.`]
                };
            }
            slotPlacements.push({ slotId: slot.id, anchor: existing });
            gasketAnchors[slot.id] = existing;
            continue;
        }
        const candidates = chooseAnchorCandidates(arena, slot.preferredAnchorKind)
            .filter(anchor => !occupied.has(pointToKey(anchor)))
            .filter(anchorFitsSlot);
        if (candidates.length === 0) {
            return {
                stage: 'embedSpatialPlan',
                code: 'EMBED_SLOT_UNSAT',
                severity: 'error',
                conflict: {
                    authoredId: slot.id,
                    constraintType: 'EMBED_SLOT_UNSAT',
                    spatialContext: { hexes: [], anchorIds: [slot.id] }
                },
                diagnostics: [`No feasible anchor could satisfy slot ${slot.id} during embedding.`]
            };
        }
        const shuffled = shuffleStable(candidates, rng);
        const chosen = shuffled[0] || arena.center;
        anchorById[slot.id] = chosen;
        occupied.add(pointToKey(chosen));
        slotPlacements.push({ slotId: slot.id, anchor: chosen });
        gasketAnchors[slot.id] = chosen;
    }

    return {
        spatialPlan: {
            slotPlacements,
            anchorById,
            gasketAnchors,
            mainLandmarkIds: [],
            primaryLandmarkIds: [],
            alternateLandmarkIds: [],
            hiddenLandmarkIds: []
        },
        occupied
    };
};

const resolveModulePlan = (
    blueprint: TopologicalBlueprint,
    authoredFloor: AuthoredFloor | undefined,
    theme: string,
    arena: BaseArena,
    spatialPlan: SpatialPlan,
    rngSeed: string
): ModulePlan | GenerationFailure => {
    const registry = buildModuleRegistryIndex();
    const occupied = new Set<string>();
    occupied.add(pointToKey(arena.playerSpawn));
    occupied.add(pointToKey(arena.stairsPosition));
    if (arena.shrinePosition) {
        occupied.add(pointToKey(arena.shrinePosition));
    }
    const placements: ModulePlacement[] = [];
    const rng = createRng32(`${rngSeed}:modules`);
    const blockedIds = new Set(authoredFloor?.blockedModuleIds || []);

    const updateSlotAnchor = (slotId: string, anchor: Point) => {
        spatialPlan.anchorById[slotId] = anchor;
        const slotPlacement = spatialPlan.slotPlacements.find(item => item.slotId === slotId);
        if (slotPlacement) {
            slotPlacement.anchor = anchor;
        } else {
            spatialPlan.slotPlacements.push({ slotId, anchor });
        }
        spatialPlan.gasketAnchors[slotId] = anchor;
    };

    const candidateModuleIdsForSlot = (slot: TopologicalBlueprint['slots'][number]): string[] =>
        getCandidateModuleEntriesForSlot(slot, authoredFloor, theme, registry, blockedIds).map(entry => entry.id);

    const candidateAnchorsForSlot = (slot: TopologicalBlueprint['slots'][number]): Point[] => {
        const seen = new Set<string>();
        const preferred = spatialPlan.anchorById[slot.id];
        const otherCandidates = chooseAnchorCandidates(arena, slot.preferredAnchorKind);
        const shuffledOthers = shuffleStable(otherCandidates, rng);
        return [preferred, ...shuffledOthers]
            .filter((anchor): anchor is Point => Boolean(anchor))
            .filter(anchor => {
                const key = pointToKey(anchor);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
    };

    const placeModule = (moduleId: string, slotId: string, anchor: Point): GenerationFailure | undefined => {
        const module = registry.entriesById[moduleId];
        if (!module) {
            return {
                stage: 'resolveModulePlan',
                code: 'MODULE_NOT_FOUND',
                severity: 'error',
                conflict: {
                    authoredId: moduleId,
                    constraintType: 'MODULE_NOT_FOUND',
                    spatialContext: { hexes: [anchor], anchorIds: [slotId] }
                },
                diagnostics: [`Unknown module ${moduleId}.`]
            };
        }
        if (!fitsFootprint(anchor, module.footprint, arena, occupied, new Set([pointToKey(anchor)]))) {
            return {
                stage: 'resolveModulePlan',
                code: 'MODULE_FOOTPRINT_BLOCKED',
                severity: 'error',
                conflict: {
                    authoredId: moduleId,
                    constraintType: 'MODULE_FOOTPRINT_BLOCKED',
                    spatialContext: { hexes: [anchor], anchorIds: [slotId] }
                },
                diagnostics: [`Module ${moduleId} cannot fit at ${pointToKey(anchor)}.`]
            };
        }

        const footprintKeys = module.footprint.map(local => pointToKey(toWorld(anchor, local)));
        footprintKeys.forEach(key => occupied.add(key));
        placements.push({ moduleId, slotId, anchor, footprintKeys, onPath: false });
        return undefined;
    };

    for (const pinned of authoredFloor?.pinnedModules || []) {
        const anchor = createHex(pinned.anchor.q, pinned.anchor.r);
        const matchingSlotId = blueprint.slots.find(slot =>
            pointToKey(spatialPlan.anchorById[slot.id] || arena.center) === pointToKey(anchor)
            && !placements.some(item => item.slotId === slot.id)
        )?.id;
        const failure = placeModule(pinned.id, matchingSlotId || pinned.id, anchor);
        if (failure) return failure;
    }

    for (const slot of blueprint.slots) {
        if (placements.some(item => item.slotId === slot.id)) continue;
        const explicitCandidateIds = candidateModuleIdsForSlot(slot);

        if (explicitCandidateIds.length === 0) continue;
        const candidates = shuffleStable(explicitCandidateIds, rng);
        let placed = false;
        const anchorCandidates = candidateAnchorsForSlot(slot);
        let lastAnchor = spatialPlan.anchorById[slot.id] || arena.center;
        for (const anchor of anchorCandidates) {
            lastAnchor = anchor;
            for (const moduleId of candidates) {
                const failure = placeModule(moduleId, slot.id, anchor);
                if (!failure) {
                    updateSlotAnchor(slot.id, anchor);
                    placed = true;
                    break;
                }
            }
            if (placed) {
                break;
            }
        }
        if (!placed && slot.requiredTacticalTags.length > 0) {
            return {
                stage: 'resolveModulePlan',
                code: 'SEARCH_BUDGET_EXCEEDED',
                severity: 'error',
                conflict: {
                    authoredId: slot.id,
                    constraintType: 'SEARCH_BUDGET_EXCEEDED',
                    spatialContext: { hexes: [lastAnchor], anchorIds: [slot.id] }
                },
                diagnostics: [`No candidate module could satisfy slot ${slot.id}.`]
            };
        }
    }

    return { placements };
};

const registerSpatialClaims = (modulePlan: ModulePlan): SpatialClaim[] => {
    const registry = buildModuleRegistryIndex();
    const claims: SpatialClaim[] = [];
    for (const placement of modulePlan.placements) {
        const module = registry.entriesById[placement.moduleId];
        const anchor = placement.anchor;
        for (const template of module.claimTemplates || []) {
            const from = toWorld(anchor, template.from);
            const to = toWorld(anchor, template.to);
            claims.push({
                id: `${placement.slotId}:${template.id}`,
                kind: template.kind,
                hardness: template.hardness,
                sourceModuleId: placement.moduleId,
                from,
                to,
                cells: hexRaycastInt(from, to)
            });
        }
    }
    return claims.sort((a, b) => a.id.localeCompare(b.id));
};

const realizeSceneEvidence = (
    scene: NarrativeSceneRequest,
    plan: ModulePlan,
    arena: BaseArena
): { anchors: NarrativeAnchor[]; evidence: Array<{ id: string; tag: string; point: Point }> } => {
    const anchors: NarrativeAnchor[] = [];
    const evidence: Array<{ id: string; tag: string; point: Point }> = [];
    const preferredPoint = plan.placements[0]?.anchor || arena.center;
    anchors.push({
        id: `scene_anchor_${scene.motif}`,
        kind: scene.motif,
        point: preferredPoint
    });
    evidence.push({
        id: `evidence_primary_${scene.motif}`,
        tag: scene.motif,
        point: preferredPoint
    });
    if (scene.evidenceQuota > 1 && arena.shrinePosition) {
        evidence.push({
            id: `evidence_secondary_${scene.encounterPosture}`,
            tag: scene.encounterPosture,
            point: arena.shrinePosition
        });
    }
    return { anchors, evidence };
};

const realizeArenaArtifact = (
    arena: BaseArena,
    map: { width: number; height: number; mapShape: MapShape },
    floor: number,
    _seed: string,
    modulePlan: ModulePlan,
    authoredFloor: AuthoredFloor | undefined
): {
    tiles: Map<string, Tile>;
    spawnPositions: Point[];
    rooms: Room[];
    reservedKeys: Set<string>;
    authoredEnemySeeds: Array<Point & { subtype: string }>;
} => {
    const tileMap = new Map<string, Tile>();
    const reservedKeys = new Set<string>();

    for (const hex of arena.allHexes) {
        tileMap.set(pointToKey(hex), createTile('STONE', hex));
    }

    const registry = buildModuleRegistryIndex();
    for (const placement of modulePlan.placements) {
        const module = registry.entriesById[placement.moduleId];
        for (const local of module.footprint) {
            reservedKeys.add(pointToKey(toWorld(placement.anchor, local)));
        }
        for (const stamp of module.tileStamps) {
            const point = toWorld(placement.anchor, stamp);
            tileMap.set(pointToKey(point), createTile(stamp.baseId, point));
        }
    }

    for (const stamp of authoredFloor?.tileStamps || []) {
        const point = createHex(stamp.dq, stamp.dr);
        if (!tileMap.has(pointToKey(point))) continue;
        reservedKeys.add(pointToKey(point));
        tileMap.set(pointToKey(point), createTile(stamp.baseId, point));
    }

    const { spawnPositions } = resolveArenaSpawnPositions(arena, tileMap, map, reservedKeys);

    const rooms: Room[] = [{
        id: 'arena',
        type: floor % 5 === 0 ? 'boss' : 'combat',
        center: arena.center,
        hexes: arena.allHexes,
        connections: []
    }];

    const authoredEnemySeeds = (authoredFloor?.enemySeeds || []).map(seedDef => ({
        q: seedDef.q,
        r: seedDef.r,
        s: seedDef.s,
        subtype: seedDef.subtype
    }));

    return { tiles: tileMap, spawnPositions, rooms, reservedKeys, authoredEnemySeeds };
};

const closeUnresolvedGaskets = (
    tiles: Map<string, Tile>,
    theme: string,
    modulePlan: ModulePlan,
    claims: SpatialClaim[]
): Map<string, Tile> => {
    const registry = buildModuleRegistryIndex();
    const nextTiles = new Map(tiles);
    const hardClaimKeys = buildClaimKeySet(claims, 'hard');

    for (const placement of modulePlan.placements) {
        const module = registry.entriesById[placement.moduleId];
        for (const gasket of module.gaskets || []) {
            if (gasket.state !== 'open_optional') continue;
            const point = toWorld(placement.anchor, gasket);
            const key = pointToKey(point);
            const overlapsHardClaim = hardClaimKeys.has(key);
            if (overlapsHardClaim && nextTiles.has(key)) continue;
            const closureBaseId = themeDefaultClosure(theme);
            nextTiles.set(key, createTile(closureBaseId, point));
        }
    }

    return nextTiles;
};

const walkableNeighborKeys = (point: Point): string[] => ([
    createHex(point.q + 1, point.r),
    createHex(point.q + 1, point.r - 1),
    createHex(point.q, point.r - 1),
    createHex(point.q - 1, point.r),
    createHex(point.q - 1, point.r + 1),
    createHex(point.q, point.r + 1)
]).map(pointToKey);

const emptyGeneratedPathNetwork = (): GeneratedPathNetwork => ({
    landmarks: [],
    tacticalTileKeys: [],
    tacticalEdges: [],
    visualTileKeys: [],
    visualEdges: [],
    segments: [],
    routeCount: 1,
    junctionTileKeys: [],
    maxStraightRun: 0,
    environmentalPressureClusters: []
});

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
                saferRouteBias: 'none',
                riskierRouteBias: 'none'
            };
    }
};

const parseKeyToHex = (key: string): Point => {
    const [q, r] = key.split(',').map(Number);
    return createHex(q, r);
};

const canonicalPathEdge = (left: string, right: string): PathEdge =>
    left.localeCompare(right) <= 0
        ? { fromKey: left, toKey: right }
        : { fromKey: right, toKey: left };

const buildEdgeSignature = (edge: PathEdge): string => `${edge.fromKey}|${edge.toKey}`;

const buildEdgesFromTileKeys = (tileKeys: string[]): PathEdge[] => {
    const seen = new Set<string>();
    const edges: PathEdge[] = [];
    for (let index = 1; index < tileKeys.length; index += 1) {
        const previous = tileKeys[index - 1];
        const current = tileKeys[index];
        if (!previous || !current || previous === current) continue;
        const edge = canonicalPathEdge(previous, current);
        const signature = buildEdgeSignature(edge);
        if (seen.has(signature)) continue;
        seen.add(signature);
        edges.push(edge);
    }
    return edges;
};

const sortPathEdges = (edges: Iterable<PathEdge>): PathEdge[] =>
    Array.from(edges).sort((left, right) =>
        left.fromKey.localeCompare(right.fromKey) || left.toKey.localeCompare(right.toKey)
    );

const buildPathSummary = (pathNetwork: GeneratedPathNetwork): PathSummary => {
    const mainLandmarkIds = pathNetwork.landmarks
        .filter(landmark => landmark.onPath)
        .map(landmark => landmark.id)
        .sort();
    const primaryLandmarkIds = pathNetwork.landmarks
        .filter(landmark => landmark.routeMembership === 'primary' || landmark.routeMembership === 'shared')
        .map(landmark => landmark.id)
        .sort();
    const alternateLandmarkIds = pathNetwork.landmarks
        .filter(landmark => landmark.routeMembership === 'alternate' || landmark.routeMembership === 'shared')
        .map(landmark => landmark.id)
        .sort();
    const hiddenLandmarkIds = pathNetwork.landmarks
        .filter(landmark => !landmark.onPath)
        .map(landmark => landmark.id)
        .sort();
    const obstacleClusterCount = pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'obstacle').length;
    const trapClusterCount = pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'trap').length;

    return {
        mainLandmarkIds,
        primaryLandmarkIds,
        alternateLandmarkIds,
        hiddenLandmarkIds,
        routeCount: pathNetwork.routeCount,
        junctionCount: pathNetwork.junctionTileKeys.length,
        maxStraightRun: pathNetwork.maxStraightRun,
        obstacleClusterCount,
        trapClusterCount,
        tacticalTileCount: pathNetwork.tacticalTileKeys.length,
        visualTileCount: pathNetwork.visualTileKeys.length
    };
};

const buildPathDiagnostics = (pathNetwork: GeneratedPathNetwork): string[] => ([
    `main_landmarks=${pathNetwork.landmarks.filter(landmark => landmark.onPath).map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `primary_landmarks=${pathNetwork.landmarks.filter(landmark => landmark.routeMembership === 'primary' || landmark.routeMembership === 'shared').map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `alternate_landmarks=${pathNetwork.landmarks.filter(landmark => landmark.routeMembership === 'alternate' || landmark.routeMembership === 'shared').map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `hidden_landmarks=${pathNetwork.landmarks.filter(landmark => !landmark.onPath).map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `route_count=${pathNetwork.routeCount}`,
    `junction_count=${pathNetwork.junctionTileKeys.length}`,
    `max_straight_run=${pathNetwork.maxStraightRun}`,
    `obstacle_clusters=${pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'obstacle').length}`,
    `trap_clusters=${pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'trap').length}`,
    `primary_route_tiles=${new Set(pathNetwork.segments.filter(segment => segment.routeMembership === 'primary' || segment.routeMembership === 'shared').flatMap(segment => segment.tileKeys)).size}`,
    `alternate_route_tiles=${new Set(pathNetwork.segments.filter(segment => segment.routeMembership === 'alternate' || segment.routeMembership === 'shared').flatMap(segment => segment.tileKeys)).size}`,
    `tactical_tiles=${pathNetwork.tacticalTileKeys.length}`,
    `visual_tiles=${pathNetwork.visualTileKeys.length}`,
    `segments=${pathNetwork.segments.map(segment => `${segment.kind}:${segment.fromLandmarkId}->${segment.toLandmarkId}`).join('|') || 'none'}`
]);

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

const isPathEligibleTile = (tile: Tile | undefined): boolean =>
    !!tile && tile.baseId !== 'VOID' && !tile.traits.has('BLOCKS_MOVEMENT');

const isHazardousPathTile = (tile: Tile | undefined): boolean =>
    !!tile && tile.traits.has('HAZARDOUS');

const buildPathLandmarks = (
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

    const pointToModule = new Map<string, ModulePlacement>();
    modulePlacements.forEach(placement => {
        pointToModule.set(pointToKey(placement.anchor), placement);
        placement.footprintKeys.forEach(key => pointToModule.set(key, placement));
    });

    const resolveContainingPlacement = (point: Point): ModulePlacement | undefined => {
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

const buildSegmentDirectionKey = (fromKey: string, toKey: string): string => {
    const from = parseKeyToHex(fromKey);
    const to = parseKeyToHex(toKey);
    return `${to.q - from.q},${to.r - from.r}`;
};

const buildPathBendKeys = (pathNetwork: GeneratedPathNetwork): Set<string> => {
    const bendKeys = new Set<string>();
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .forEach(segment => {
            for (let index = 1; index < segment.tileKeys.length - 1; index += 1) {
                const previousKey = segment.tileKeys[index - 1]!;
                const currentKey = segment.tileKeys[index]!;
                const nextKey = segment.tileKeys[index + 1]!;
                if (buildSegmentDirectionKey(previousKey, currentKey) !== buildSegmentDirectionKey(currentKey, nextKey)) {
                    bendKeys.add(currentKey);
                }
            }
        });
    return bendKeys;
};

const computeMaxStraightRun = (
    pathNetwork: GeneratedPathNetwork,
    additionalBreakKeys: ReadonlySet<string> = new Set<string>()
): number => {
    const breakKeys = new Set<string>([
        ...pathNetwork.junctionTileKeys,
        ...Array.from(buildPathBendKeys(pathNetwork)),
        ...Array.from(additionalBreakKeys)
    ]);
    let maxStraightRun = 0;
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .forEach(segment => {
            if (segment.tileKeys.length === 0) return;
            maxStraightRun = Math.max(maxStraightRun, 1);
            let lastDirection = '';
            let runLength = 1;
            for (let index = 1; index < segment.tileKeys.length; index += 1) {
                const previousKey = segment.tileKeys[index - 1]!;
                const currentKey = segment.tileKeys[index]!;
                if (breakKeys.has(previousKey) || breakKeys.has(currentKey)) {
                    lastDirection = '';
                    runLength = 1;
                    maxStraightRun = Math.max(maxStraightRun, runLength);
                    continue;
                }
                const nextDirection = buildSegmentDirectionKey(previousKey, currentKey);
                if (nextDirection === lastDirection) {
                    runLength += 1;
                } else {
                    runLength = 2;
                    lastDirection = nextDirection;
                }
                maxStraightRun = Math.max(maxStraightRun, runLength);
            }
        });
    return maxStraightRun;
};

const buildStraightRunHotspotKeys = (
    pathNetwork: Pick<GeneratedPathNetwork, 'segments'>,
    minimumRunLength: number
): Set<string> => {
    const hotspots = new Set<string>();
    if (minimumRunLength < 3) return hotspots;

    for (const segment of pathNetwork.segments) {
        if (segment.kind === 'spur' || segment.tileKeys.length < minimumRunLength) continue;

        let runStartIndex = 0;
        let currentDirection = buildSegmentDirectionKey(segment.tileKeys[0], segment.tileKeys[1]);

        const flushRun = (endIndexExclusive: number) => {
            const runTileKeys = segment.tileKeys.slice(runStartIndex, endIndexExclusive);
            if (runTileKeys.length >= minimumRunLength) {
                hotspots.add(runTileKeys[Math.floor(runTileKeys.length / 2)]!);
            }
        };

        for (let index = 1; index < segment.tileKeys.length - 1; index += 1) {
            const nextDirection = buildSegmentDirectionKey(segment.tileKeys[index], segment.tileKeys[index + 1]);
            if (nextDirection === currentDirection) continue;
            flushRun(index + 1);
            runStartIndex = index;
            currentDirection = nextDirection;
        }

        flushRun(segment.tileKeys.length);
    }

    return hotspots;
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

const buildTacticalPathNetwork = (
    tiles: Map<string, Tile>,
    landmarks: PathLandmark[],
    routeProfile: RouteProfile
): { pathNetwork: GeneratedPathNetwork; diagnostics: string[] } | GenerationFailure => {
    const mainChain = buildOrderedMainLandmarks(landmarks, tiles);
    if ('stage' in mainChain) return mainChain;

    const landmarkById = new Map(landmarks.map(landmark => [landmark.id, landmark]));
    const mainTileKeys = new Set<string>();
    const tacticalTileKeys = new Set<string>();
    const mainEdges = new Map<string, PathEdge>();
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
            const signature = buildEdgeSignature(edge);
            mainEdges.set(signature, edge);
            tacticalEdges.set(signature, edge);
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

const buildVisualPathNetwork = (
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

const resolveTileRouteMembership = (
    pathNetwork: GeneratedPathNetwork,
    tileKey: string
): Exclude<RouteMembership, 'hidden'> => {
    const memberships = new Set<Exclude<RouteMembership, 'hidden'>>();
    pathNetwork.segments
        .filter(segment => segment.kind !== 'spur' && segment.tileKeys.includes(tileKey))
        .forEach(segment => memberships.add(segment.routeMembership));
    if (memberships.has('shared')) return 'shared';
    if (memberships.has('primary') && memberships.has('alternate')) return 'shared';
    if (memberships.has('alternate')) return 'alternate';
    return 'primary';
};

const applyEnvironmentalPressure = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    pathNetwork: GeneratedPathNetwork,
    intent: FloorIntentRequest,
    seed: string,
    authoredFloor?: AuthoredFloor,
    claims: SpatialClaim[] = []
): { tiles: Map<string, Tile>; pathNetwork: GeneratedPathNetwork; diagnostics: string[] } => {
    const nextTiles = new Map(tiles);
    const clusters: EnvironmentalPressureCluster[] = [];
    const hardClaimKeys = buildClaimKeySet(claims, 'hard');
    const specials = new Set<string>([
        pointToKey(arena.playerSpawn),
        pointToKey(arena.stairsPosition),
        ...(arena.shrinePosition ? [pointToKey(arena.shrinePosition)] : [])
    ]);
    const landmarkKeys = new Set(pathNetwork.landmarks.map(landmark => pointToKey(landmark.point)));
    const tacticalRouteTileKeys = new Set(pathNetwork.tacticalTileKeys);
    const usedTileKeys = new Set<string>();
    const bendKeys = Array.from(buildPathBendKeys(pathNetwork)).sort();
    const rng = createRng32(`${seed}:route-pressure`);
    const profile = intent.routeProfile;
    const straightRunHotspots = Array.from(buildStraightRunHotspotKeys(pathNetwork, Math.max(3, profile.maxStraightRun))).sort();
    const clusterCenterKeys = Array.from(new Set([...pathNetwork.junctionTileKeys, ...bendKeys, ...straightRunHotspots])).sort();
    const mutablePathNetwork: GeneratedPathNetwork = {
        ...pathNetwork,
        environmentalPressureClusters: [],
        maxStraightRun: pathNetwork.maxStraightRun
    };

    const trapPriority = intent.role === 'recovery'
        ? ['alternate', 'shared', 'primary'] as const
        : profile.saferRouteBias === 'strong' || profile.riskierRouteBias === 'strong'
            ? ['alternate', 'shared', 'primary'] as const
            : ['shared', 'alternate', 'primary'] as const;
    const obstaclePriority = intent.role === 'recovery'
        ? ['alternate', 'shared', 'primary'] as const
        : intent.role === 'pressure_spike' || intent.role === 'elite'
            ? ['shared', 'primary', 'alternate'] as const
            : ['shared', 'alternate', 'primary'] as const;

    const prioritizeHexKeys = (
        keys: string[],
        priority: readonly ['primary' | 'alternate' | 'shared', 'primary' | 'alternate' | 'shared', 'primary' | 'alternate' | 'shared']
    ): Point[] => priority.flatMap(routeMembership =>
        shuffleStable(
            keys
                .filter(key => resolveTileRouteMembership(pathNetwork, key) === routeMembership)
                .sort((left, right) => left.localeCompare(right))
                .map(parseKeyToHex),
            rng
        )
    );

    const pushObstacleCluster = (centerKey: string): boolean => {
        const center = parseKeyToHex(centerKey);
        const routeMembership = resolveTileRouteMembership(pathNetwork, centerKey);
        const candidateKeys = walkableNeighborKeys(center)
            .sort((left, right) => left.localeCompare(right))
            .filter(key =>
                !hardClaimKeys.has(key)
                && !tacticalRouteTileKeys.has(key)
                && !specials.has(key)
                && !landmarkKeys.has(key)
                && !usedTileKeys.has(key)
            );
        const clusterKeys: string[] = [];
        for (const candidateKey of candidateKeys) {
            const tile = nextTiles.get(candidateKey);
            if (!tile || tile.baseId !== 'STONE' || tile.traits.has('BLOCKS_MOVEMENT')) continue;
            nextTiles.set(candidateKey, createTile('WALL', tile.position));
            usedTileKeys.add(candidateKey);
            clusterKeys.push(candidateKey);
            if (clusterKeys.length >= 2) break;
        }
        if (clusterKeys.length === 0) return false;
        clusters.push({
            id: `obstacle:${clusters.length}:${centerKey}`,
            kind: 'obstacle',
            routeMembership,
            tileKeys: clusterKeys
        });
        return true;
    };

    const trapTiles = prioritizeHexKeys(
        pathNetwork.visualTileKeys
            .filter(key =>
                !hardClaimKeys.has(key)
                && !specials.has(key)
                && !landmarkKeys.has(key)
                && !usedTileKeys.has(key)
            ),
        trapPriority
    );

    const obstacleCenters = prioritizeHexKeys(clusterCenterKeys, obstaclePriority);
    if (!authoredFloor) {
        let obstacleCount = 0;
        for (const center of obstacleCenters) {
            if (obstacleCount >= profile.obstacleClusterBudget) break;
            if (pushObstacleCluster(pointToKey(center))) obstacleCount += 1;
        }

        let trapCount = 0;
        for (const point of trapTiles) {
            if (trapCount >= profile.trapClusterBudget) break;
            const key = pointToKey(point);
            const tile = nextTiles.get(key);
            if (!tile || tile.baseId !== 'STONE') continue;
            if (tile.effects.some(effect => effect.id === 'SNARE' || effect.id === 'FIRE')) continue;
            const effectId = trapCount % 2 === 0 ? 'SNARE' : 'FIRE';
            nextTiles.set(key, {
                ...tile,
                effects: [...tile.effects, { id: effectId, duration: -1, potency: 1 }]
            });
            usedTileKeys.add(key);
            clusters.push({
                id: `trap:${clusters.length}:${key}`,
                kind: 'trap',
                routeMembership: resolveTileRouteMembership(pathNetwork, key),
                tileKeys: [key],
                trapKind: effectId === 'SNARE' ? 'snare_surface' : 'fire_surface'
            });
            trapCount += 1;
        }
    }

    mutablePathNetwork.environmentalPressureClusters = clusters.sort((left, right) => left.id.localeCompare(right.id));
    mutablePathNetwork.maxStraightRun = computeMaxStraightRun(
        mutablePathNetwork,
        new Set(mutablePathNetwork.environmentalPressureClusters.flatMap(cluster => cluster.tileKeys))
    );

    return {
        tiles: nextTiles,
        pathNetwork: mutablePathNetwork,
        diagnostics: buildPathDiagnostics(mutablePathNetwork)
    };
};

const verifyArenaArtifact = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    modulePlan: ModulePlan,
    claims: SpatialClaim[],
    pathNetwork: GeneratedPathNetwork,
    sceneSignature: SceneSignature,
    intent: FloorIntentRequest,
    authoredFloor?: AuthoredFloor
): VerificationReport => {
    const blockers = new Set<string>();
    const losBlockers = new Set<string>();
    const walkable = new Set<string>();
    tiles.forEach((tile, key) => {
        if (tile.traits.has('BLOCKS_MOVEMENT')) blockers.add(key);
        if (tile.traits.has('BLOCKS_LOS')) losBlockers.add(key);
        if (isPathEligibleTile(tile)) walkable.add(key);
    });

    const visited = new Set<string>();
    const queue = [pointToKey(arena.playerSpawn)];
    while (queue.length > 0) {
        const key = queue.shift()!;
        if (visited.has(key) || !walkable.has(key)) continue;
        visited.add(key);
        const [q, r] = key.split(',').map(Number);
        for (const neighbor of walkableNeighborKeys(createHex(q, r))) {
            if (!visited.has(neighbor)) queue.push(neighbor);
        }
    }

    if (!visited.has(pointToKey(arena.stairsPosition))) {
        const conflict: ConflictTriple = {
            authoredId: modulePlan.placements[0]?.moduleId || 'base_arena',
            constraintType: 'CONNECTIVITY_BROKEN',
            spatialContext: { hexes: [arena.playerSpawn, arena.stairsPosition] }
        };
        return {
            stage: 'verifyArenaArtifact',
            code: 'CONNECTIVITY_BROKEN',
            severity: 'error',
            conflict,
            sceneSignature,
            diagnostics: ['Player spawn cannot reach the stairs after module realization.']
        };
    }

    const landmarkById = new Map(pathNetwork.landmarks.map(landmark => [landmark.id, landmark]));
    const entryLandmark = landmarkById.get('entry');
    const exitLandmark = landmarkById.get('exit');
    if (!entryLandmark || !exitLandmark || !entryLandmark.onPath || !exitLandmark.onPath) {
        return {
            stage: 'verifyArenaArtifact',
            code: 'TACTICAL_PATH_START_EXIT_UNREACHABLE',
            severity: 'error',
            conflict: {
                authoredId: 'arena',
                constraintType: 'TACTICAL_PATH_START_EXIT_UNREACHABLE',
                spatialContext: { hexes: [arena.playerSpawn, arena.stairsPosition], anchorIds: ['entry', 'exit'] }
            },
            sceneSignature,
            diagnostics: ['Path network dropped entry or exit from the main route.']
        };
    }
    const tacticalTileSet = new Set(pathNetwork.tacticalTileKeys);
    const tacticalEdgeSet = new Set(pathNetwork.tacticalEdges.map(buildEdgeSignature));
    const visualTileSet = new Set(pathNetwork.visualTileKeys);
    const visualEdgeSet = new Set(pathNetwork.visualEdges.map(buildEdgeSignature));

    for (const tileKey of pathNetwork.tacticalTileKeys) {
        if (!walkable.has(tileKey)) {
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                severity: 'error',
                conflict: {
                    authoredId: 'arena',
                    constraintType: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                    spatialContext: { hexes: [parseKeyToHex(tileKey)] }
                },
                sceneSignature,
                diagnostics: [`Path tile ${tileKey} is not walkable in the final arena.`]
            };
        }
    }

    for (const edge of pathNetwork.tacticalEdges) {
        if (hexDistanceInt(parseKeyToHex(edge.fromKey), parseKeyToHex(edge.toKey)) !== 1) {
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                severity: 'error',
                conflict: {
                    authoredId: 'arena',
                    constraintType: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                    spatialContext: { hexes: [parseKeyToHex(edge.fromKey), parseKeyToHex(edge.toKey)] }
                },
                sceneSignature,
                diagnostics: [`Path edge ${edge.fromKey} -> ${edge.toKey} is not adjacent.`]
            };
        }
    }

    for (const tileKey of visualTileSet) {
        if (!tacticalTileSet.has(tileKey)) {
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                severity: 'error',
                conflict: {
                    authoredId: 'arena',
                    constraintType: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                    spatialContext: { hexes: [parseKeyToHex(tileKey)] }
                },
                sceneSignature,
                diagnostics: [`Visual path tile ${tileKey} is not present in the tactical network.`]
            };
        }
    }

    for (const edgeSignature of visualEdgeSet) {
        if (!tacticalEdgeSet.has(edgeSignature)) {
            const [fromKey, toKey] = edgeSignature.split('|');
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                severity: 'error',
                conflict: {
                    authoredId: 'arena',
                    constraintType: 'TACTICAL_PATH_NONWALKABLE_SEGMENT',
                    spatialContext: { hexes: [parseKeyToHex(fromKey), parseKeyToHex(toKey)] }
                },
                sceneSignature,
                diagnostics: [`Visual path edge ${edgeSignature} is not present in the tactical network.`]
            };
        }
    }

    const mainTileSet = new Set(pathNetwork.visualTileKeys);
    const spurByLandmarkId = new Set(
        pathNetwork.segments
            .filter(segment => segment.kind === 'spur')
            .map(segment => segment.toLandmarkId)
    );
    for (const landmark of pathNetwork.landmarks) {
        const landmarkKey = pointToKey(landmark.point);
        if (landmark.onPath && !mainTileSet.has(landmarkKey)) {
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                severity: 'error',
                conflict: {
                    authoredId: landmark.id,
                    constraintType: 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                    spatialContext: { hexes: [landmark.point], anchorIds: [landmark.id] }
                },
                sceneSignature,
                diagnostics: [`Main-path landmark ${landmark.id} is missing from the visual route.`]
            };
        }
        if (!landmark.onPath && !tacticalTileSet.has(landmarkKey) && !spurByLandmarkId.has(landmark.id)) {
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_OFFPATH_UNREACHABLE',
                severity: 'error',
                conflict: {
                    authoredId: landmark.id,
                    constraintType: 'TACTICAL_PATH_OFFPATH_UNREACHABLE',
                    spatialContext: { hexes: [landmark.point], anchorIds: [landmark.id] }
                },
                sceneSignature,
                diagnostics: [`Off-path landmark ${landmark.id} is unreachable from the main route.`]
            };
        }
    }

    for (const [targetId, override] of Object.entries(authoredFloor?.pathOverrides || {}).sort((a, b) => a[0].localeCompare(b[0]))) {
        if (!override.onPath) continue;
        const landmark = landmarkById.get(targetId);
        if (!landmark || !landmark.onPath) {
            return {
                stage: 'verifyArenaArtifact',
                code: 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                severity: 'error',
                conflict: {
                    authoredId: targetId,
                    constraintType: 'TACTICAL_PATH_MAIN_LANDMARK_UNREACHABLE',
                    spatialContext: { hexes: landmark ? [landmark.point] : [], anchorIds: [targetId] }
                },
                sceneSignature,
                diagnostics: [`Authored path override for ${targetId} was not preserved in the final path network.`]
            };
        }
    }

    for (const claim of claims) {
        if ((claim.kind === 'los_corridor' || claim.kind === 'choke_visibility') && !hasClearLosInt(claim.from, claim.to, losBlockers)) {
            if (claim.hardness === 'soft') continue;
            return {
                stage: 'verifyArenaArtifact',
                code: 'GASKET_AFFORDANCE_BROKEN',
                severity: 'error',
                conflict: {
                    authoredId: claim.sourceModuleId || claim.id,
                    constraintType: 'GASKET_AFFORDANCE_BROKEN',
                    spatialContext: { hexes: claim.cells, anchorIds: [claim.id] }
                },
                sceneSignature,
                diagnostics: [`Hard claim ${claim.id} lost line of sight after gasket closure.`]
            };
        }
        if ((claim.kind === 'movement_corridor' || claim.kind === 'reset_access' || claim.kind === 'gasket_opening')
            && claim.cells.some(cell => blockers.has(pointToKey(cell)))) {
            if (claim.hardness === 'soft') continue;
            return {
                stage: 'verifyArenaArtifact',
                code: 'CLAIM_BLOCKED',
                severity: 'error',
                conflict: {
                    authoredId: claim.sourceModuleId || claim.id,
                    constraintType: 'CLAIM_BLOCKED',
                    spatialContext: { hexes: claim.cells, anchorIds: [claim.id] }
                },
                sceneSignature,
                diagnostics: [`Hard claim ${claim.id} is blocked after gasket closure.`]
            };
        }
        if ((claim.kind === 'los_corridor' || claim.kind === 'choke_visibility')
            && !hasClearLosInt(claim.from, claim.to, losBlockers)) {
                return {
                    stage: 'verifyArenaArtifact',
                    code: 'GASKET_AFFORDANCE_BROKEN',
                    severity: 'error',
                    conflict: {
                        authoredId: claim.sourceModuleId || claim.id,
                        constraintType: 'GASKET_AFFORDANCE_BROKEN',
                        spatialContext: { hexes: claim.cells, anchorIds: [claim.id] }
                    },
                    sceneSignature,
                    suggestedRelaxations: ['ALLOW_GASKET_RESHAPE'],
                    diagnostics: [`Claim ${claim.id} lost line of sight after gasket closure.`]
                };
        }
    }

    const coveredTags = new Set(
        modulePlan.placements.flatMap(placement =>
            buildModuleRegistryIndex().entriesById[placement.moduleId].capability.tacticalTags
        )
    );
    const missingTag = intent.requiredTacticalTags.find(tag => !coveredTags.has(tag));
    if (missingTag) {
        return {
            stage: 'verifyArenaArtifact',
            code: 'MODULE_CAPABILITY_MISSING',
            severity: 'error',
            conflict: {
                authoredId: missingTag,
                constraintType: 'MODULE_CAPABILITY_MISSING',
                spatialContext: { hexes: [arena.center] }
            },
            sceneSignature,
            diagnostics: [`No realized module satisfied required tactical tag ${missingTag}.`]
        };
    }

    return {
        stage: 'verifyArenaArtifact',
        code: 'OK',
        severity: 'info',
        sceneSignature,
        diagnostics: ['Arena artifact verified successfully.']
    };
};

const buildSceneSignature = (
    sceneRequest: NarrativeSceneRequest,
    intent: FloorIntentRequest,
    modulePlan: ModulePlan
): SceneSignature => ({
    sceneId: hashString(stableStringify({
        role: intent.role,
        motif: sceneRequest.motif,
        modules: modulePlan.placements.map(item => item.moduleId)
    })),
    motif: sceneRequest.motif,
    mood: sceneRequest.mood,
    encounterPosture: sceneRequest.encounterPosture,
    primaryEvidence: sceneRequest.motif,
    secondaryEvidence: modulePlan.placements[1]?.moduleId,
    hostileRosterDescriptor: intent.role === 'elite' ? 'elevated' : 'standard',
    terrainDescriptor: intent.theme,
    spatialDescriptor: modulePlan.placements.length > 1 ? 'layered' : 'focused'
});

const buildArtifactDigest = (
    modulePlan: ModulePlan,
    tiles: Map<string, Tile>,
    scene: SceneSignature,
    pathNetwork: GeneratedPathNetwork
): string => {
    const tileSignature = Array.from(tiles.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, tile]) => `${key}:${tile.baseId}:${tile.effects.map(effect => `${effect.id}:${effect.duration}:${effect.potency}`).join('&')}`)
        .join('|');
    return hashString(stableStringify({
        modules: modulePlan.placements.map(item => item.moduleId),
        tileSignature,
        scene,
        pathNetwork: {
            landmarks: pathNetwork.landmarks.map(landmark => ({
                id: landmark.id,
                onPath: landmark.onPath,
                routeMembership: landmark.routeMembership,
                reachable: landmark.reachable
            })),
            tacticalTileKeys: pathNetwork.tacticalTileKeys,
            visualTileKeys: pathNetwork.visualTileKeys,
            routeCount: pathNetwork.routeCount,
            junctionTileKeys: pathNetwork.junctionTileKeys,
            maxStraightRun: pathNetwork.maxStraightRun,
            environmentalPressureClusters: pathNetwork.environmentalPressureClusters,
            segments: pathNetwork.segments.map(segment => ({
                id: segment.id,
                kind: segment.kind,
                routeMembership: segment.routeMembership,
                fromLandmarkId: segment.fromLandmarkId,
                toLandmarkId: segment.toLandmarkId,
                tileKeys: segment.tileKeys
            }))
        }
    }));
};

const emptyArtifact = (
    floor: number,
    seed: string,
    options: { width: number; height: number; mapShape: MapShape; theme: string },
    generationState: GenerationState,
    mode: CompiledFloorArtifact['mode'] = 'floor_transition',
    debugSnapshot?: GenerationDebugSnapshot
): CompiledFloorArtifact => ({
    mode,
    runSeed: generationState.runSeed || seed,
    floor,
    theme: options.theme,
    gridWidth: options.width,
    gridHeight: options.height,
    mapShape: options.mapShape as GenerationMapShape,
    playerSpawn: createHex(Math.floor(options.width / 2), Math.max(0, options.height - 1)),
    stairsPosition: createHex(Math.floor(options.width / 2), 0),
    tileBaseIds: new Uint8Array(0),
    enemySpawns: [],
    rooms: [],
    generationDelta: generationState,
    modulePlacements: [],
    logicAnchors: [],
    pathNetwork: emptyGeneratedPathNetwork(),
    verificationDigest: 'invalid',
    artifactDigest: 'invalid',
    ...(debugSnapshot ? { debugSnapshot } : {})
});

const encodeTileBaseIds = (
    tiles: Map<string, Tile>,
    width: number,
    height: number,
    mapShape: MapShape
): Uint8Array => {
    const grid = getGridForShape(width, height, mapShape)
        .sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
    return Uint8Array.from(grid.map(point => {
        const tile = tiles.get(pointToKey(point));
        const baseId = tile?.baseId === 'WALL' || tile?.baseId === 'LAVA' || tile?.baseId === 'VOID'
            ? tile.baseId
            : 'STONE';
        return TILE_CODE_BY_ID[baseId];
    }));
};

const encodeTileEffects = (tiles: Map<string, Tile>) =>
    Array.from(tiles.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .flatMap(([key, tile]) => tile.effects.length > 0
            ? [{
                key,
                effects: tile.effects.map(effect => ({
                    id: effect.id,
                    duration: effect.duration,
                    potency: effect.potency
                }))
            }]
            : []
        );

export const rebuildTilesFromArtifact = (artifact: CompiledFloorArtifact): Map<string, Tile> => {
    const grid = getGridForShape(artifact.gridWidth, artifact.gridHeight, artifact.mapShape as MapShape)
        .sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
    const tiles = new Map<string, Tile>();
    for (let index = 0; index < grid.length; index += 1) {
        const point = grid[index];
        if (!point) continue;
        const baseId = TILE_ID_BY_CODE[artifact.tileBaseIds[index] ?? 0] || 'STONE';
        tiles.set(pointToKey(point), createTile(baseId, point));
    }
    for (const effectEntry of artifact.tileEffects || []) {
        const tile = tiles.get(effectEntry.key);
        if (!tile) continue;
        tiles.set(effectEntry.key, {
            ...tile,
            effects: effectEntry.effects.map(effect => ({
                id: effect.id as any,
                duration: effect.duration,
                potency: effect.potency
            }))
        });
    }
    return tiles;
};

export const rebuildEnemiesFromArtifact = (artifact: CompiledFloorArtifact): Entity[] =>
    artifact.enemySpawns
        .map((spawn) => {
            const catalogEntry = getEnemyCatalogEntry(spawn.subtype as any);
            if (!catalogEntry) return undefined;
            const stats = catalogEntry.bestiary.stats;
            const unitDef = getBaseUnitDefinitionBySubtype(spawn.subtype as any);
            if (unitDef) {
                return instantiateActorFromDefinitionWithCursor({
                    rngSeed: `${artifact.runSeed}:artifact:${spawn.id}`,
                    rngCounter: 0
                }, unitDef, {
                    actorId: spawn.id,
                    position: spawn.position,
                    subtype: spawn.subtype,
                    factionId: 'enemy'
                }).actor;
            }
            return createEnemy({
                id: spawn.id,
                subtype: spawn.subtype,
                position: spawn.position,
                speed: stats.speed || 1,
                skills: getEnemyCatalogSkillLoadout(spawn.subtype as any, { source: 'runtime', includePassive: true }).length > 0
                    ? getEnemyCatalogSkillLoadout(spawn.subtype as any, { source: 'runtime', includePassive: true })
                    : getEnemySkillLoadout(spawn.subtype as any),
                weightClass: stats.weightClass || 'Standard',
                armorBurdenTier: catalogEntry.contract.metabolicProfile.armorBurdenTier,
                enemyType: stats.type as 'melee' | 'ranged'
            });
        })
        .filter((enemy): enemy is Entity => !!enemy)
        .sort((a, b) => a.id.localeCompare(b.id));

const countSpawnTags = (subtypes: string[]) => subtypes.reduce((acc, subtype) => {
    const entry = getEnemyCatalogEntry(subtype as any);
    if (!entry) return acc;
    if (entry.contract.balanceTags.includes('frontline')) acc.frontline += 1;
    if (entry.contract.balanceTags.includes('flanker')) acc.flanker += 1;
    if (entry.contract.balanceTags.includes('support')) acc.support += 1;
    if (entry.contract.combatRole === 'hazard_setter') acc.hazardSetter += 1;
    if (entry.contract.combatRole === 'boss_anchor') acc.bossAnchor += 1;
    if (entry.bestiary.stats.type === 'ranged' || entry.bestiary.stats.type === 'boss') acc.ranged += 1;
    return acc;
}, {
    frontline: 0,
    ranged: 0,
    hazardSetter: 0,
    flanker: 0,
    support: 0,
    bossAnchor: 0
});

const spawnProfileAllowsSubtype = (
    profile: ReturnType<typeof getFloorSpawnProfile>,
    selectedSubtypes: string[],
    candidateSubtype: string
): boolean => {
    const nextCounts = countSpawnTags([...selectedSubtypes, candidateSubtype]);
    const { composition } = profile;
    return nextCounts.frontline <= composition.frontlineMax
        && nextCounts.ranged <= composition.rangedMax
        && nextCounts.hazardSetter <= composition.hazardSetterMax
        && nextCounts.flanker <= composition.flankerMax
        && nextCounts.support <= composition.supportMax
        && nextCounts.bossAnchor <= composition.bossAnchorMax;
};

const chooseWeightedSubtype = (
    subtypeIds: string[],
    floorRole: ReturnType<typeof getFloorSpawnProfile>['role'],
    rng: ReturnType<typeof createRng>
): string | undefined => {
    const weighted = subtypeIds.map(subtype => ({
        subtype,
        weight: Math.max(1, getEnemyCatalogEntry(subtype)?.contract.spawnProfile.spawnRoleWeights[floorRole] ?? 1)
    }));
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return weighted[0]?.subtype;
    let roll = rng.next() * total;
    for (const entry of weighted) {
        roll -= entry.weight;
        if (roll <= 0) return entry.subtype;
    }
    return weighted[weighted.length - 1]?.subtype;
};

const generateFloorEnemiesInternal = (
    floor: number,
    spawnPositions: Point[],
    seed: string,
    forcedSeeds: Array<Point & { subtype: string }> = []
): Entity[] => {
    ensureTacticalDataBootstrapped();
    const rng = createRng(`${seed}:enemies`);
    const spawnProfile = getFloorSpawnProfile(floor);
    let remainingBudget = spawnProfile.budget;
    let propensityCursor: PropensityRngCursor = {
        rngSeed: `${seed}:enemy-propensity`,
        rngCounter: 0
    };
    const usedKeys = new Set<string>();
    const enemies: Entity[] = [];
    const selectedSubtypes: string[] = [];

    const instantiateSeed = (subtype: string, position: Point): Entity | undefined => {
        const catalogEntry = getEnemyCatalogEntry(subtype as any);
        if (!catalogEntry) return undefined;
        const stats = catalogEntry.bestiary.stats;
        const enemySeedCounter = (propensityCursor.rngCounter << 8) + enemies.length;
        const enemyId = `enemy_${enemies.length}_${stableIdFromSeed(seed, enemySeedCounter, 6, subtype)}`;
        const unitDef = getBaseUnitDefinitionBySubtype(subtype as any);
        let enemy: Entity;

        if (unitDef) {
            const instantiated = instantiateActorFromDefinitionWithCursor(propensityCursor, unitDef, {
                actorId: enemyId,
                position,
                subtype,
                factionId: 'enemy'
            });
            propensityCursor = instantiated.nextCursor;
            enemy = instantiated.actor;
        } else {
                enemy = createEnemy({
                    id: enemyId,
                    subtype,
                    position,
                    speed: stats.speed || 1,
                    skills: getEnemyCatalogSkillLoadout(subtype as any, { source: 'runtime', includePassive: true }).length > 0
                        ? getEnemyCatalogSkillLoadout(subtype as any, { source: 'runtime', includePassive: true })
                        : getEnemySkillLoadout(subtype as any),
                    weightClass: stats.weightClass || 'Standard',
                    armorBurdenTier: catalogEntry.contract.metabolicProfile.armorBurdenTier,
                    enemyType: stats.type as 'melee' | 'ranged'
                });
            }

        return {
            ...enemy,
            subtype,
            enemyType: stats.type as 'melee' | 'ranged' | 'boss',
            actionCooldown: stats.actionCooldown ?? enemy.actionCooldown,
            isVisible: true
        };
    };

    for (const forced of forcedSeeds.sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)))) {
        const entry = getEnemyCatalogEntry(forced.subtype as any);
        if (!entry || remainingBudget < entry.bestiary.stats.cost) continue;
        const key = pointToKey(forced);
        if (usedKeys.has(key)) continue;
        const enemy = instantiateSeed(forced.subtype, forced);
        if (!enemy) continue;
        usedKeys.add(key);
        enemies.push(enemy);
        selectedSubtypes.push(forced.subtype);
        remainingBudget -= entry.bestiary.stats.cost;
    }

    while (remainingBudget > 0 && usedKeys.size < spawnPositions.length) {
        const affordableTypes = spawnProfile.allowedSubtypes.filter((subtype) => {
            const entry = getEnemyCatalogEntry(subtype);
            return !!entry
                && entry.bestiary.stats.cost <= remainingBudget
                && spawnProfileAllowsSubtype(spawnProfile, selectedSubtypes, subtype);
        });
        if (affordableTypes.length === 0) break;
        const currentCounts = countSpawnTags(selectedSubtypes);
        const frontlineCandidates = affordableTypes.filter(subtype =>
            getEnemyCatalogEntry(subtype)?.contract.balanceTags.includes('frontline')
        );
        const candidatePool = currentCounts.frontline < spawnProfile.composition.frontlineMin && frontlineCandidates.length > 0
            ? frontlineCandidates
            : affordableTypes;
        const enemyType = chooseWeightedSubtype(candidatePool, spawnProfile.role, rng);
        if (!enemyType) break;
        const entry = getEnemyCatalogEntry(enemyType);
        if (!entry) break;
        const availablePositions = spawnPositions.filter(position => !usedKeys.has(pointToKey(position)));
        if (availablePositions.length === 0) break;
        const position = availablePositions[Math.floor(rng.next() * availablePositions.length)];
        const enemy = instantiateSeed(enemyType, position);
        if (!enemy) break;
        usedKeys.add(pointToKey(position));
        enemies.push(enemy);
        selectedSubtypes.push(enemyType);
        remainingBudget -= entry.bestiary.stats.cost;
    }

    return enemies;
};

const buildVerificationFromFailure = (
    failure: GenerationFailure
): VerificationReport => ({
    stage: failure.stage,
    code: failure.code,
    severity: failure.severity,
    conflict: failure.conflict,
    sceneSignature: failure.sceneSignature,
    suggestedRelaxations: failure.suggestedRelaxations,
    diagnostics: failure.diagnostics
});

const buildDebugSnapshotFromRuntime = (
    state: CompilerSessionRuntimeState,
    failureOverride?: GenerationFailure
): GenerationDebugSnapshot | undefined => {
    if (!state.intent || !state.sceneRequest || !state.blueprint || !state.spatialBudget || !state.spatialPlan || !state.modulePlan || !state.sceneSignature || !state.verificationReport) {
        return undefined;
    }

    return {
        intent: state.intent,
        sceneRequest: state.sceneRequest,
        blueprint: state.blueprint,
        spatialBudget: state.spatialBudget,
        spatialPlan: state.spatialPlan,
        modulePlan: state.modulePlan,
        claims: state.claims || [],
        pathNetwork: state.pathNetworkValue || emptyGeneratedPathNetwork(),
        pathDiagnostics: state.pathDiagnosticsValue || [],
        sceneSignature: state.sceneSignature,
        verificationReport: state.verificationReport,
        ...(failureOverride || state.failure ? { failure: failureOverride || state.failure } : {})
    };
};

const failRuntimeState = (
    state: CompilerSessionRuntimeState,
    failure: GenerationFailure
): CompilerSessionRuntimeState => {
    if (!state.resolvedMap || !state.theme || !state.generationStateValue) {
        throw new Error(`Cannot finalize compiler failure ${failure.code} before normalizeSpec.`);
    }

    const generationState: GenerationState = {
        ...state.generationStateValue,
        currentFloorIndex: state.input.floor,
        directorEntropyKey: state.directorEntropyKey
    };
    const verificationReport = buildVerificationFromFailure(failure);
    const nextState: CompilerSessionRuntimeState = {
        ...state,
        generationStateValue: generationState,
        failure,
        verificationReport
    };
    const debugSnapshot = buildDebugSnapshotFromRuntime(nextState, failure);
    const artifact = emptyArtifact(
        state.input.floor,
        state.input.seed,
        {
            ...state.resolvedMap,
            theme: state.theme
        },
        generationState,
        'floor_transition',
        debugSnapshot
    );

    return {
        ...nextState,
        artifact,
        debugSnapshotValue: debugSnapshot,
        result: {
            artifact,
            debugSnapshot,
            generationState,
            verificationReport,
            failure
        }
    };
};

const initializeCompilerSessionState = (
    input: CompilerSessionInput
): CompilerSessionRuntimeState => ({
    input,
    currentPass: 'normalizeSpec'
});

const runCompilerPass = (
    baseState: CompilerSessionState,
    pass: CompilerPass
): CompilerSessionState => {
    const state = {
        ...(baseState as CompilerSessionRuntimeState),
        currentPass: pass
    } satisfies CompilerSessionRuntimeState;

    if (state.result) return state;

    switch (pass) {
        case 'normalizeSpec': {
            const theme = getFloorTheme(state.input.floor);
            const spec = defaultSpecForCompile(state.input.options?.generationSpec || state.input.options?.generationState?.spec);
            const lintFindings = lintGenerationSpecInput(spec);
            const generationState = ensureGenerationState(
                state.input.options?.generationState,
                state.input.options?.generationState?.runSeed || state.input.seed,
                spec
            );
            const { familyId, spec: authoredFloor } = resolveAuthoredFloor(state.input.floor, spec);
            const resolvedMap = expandMapConfigForAuthoredFloor(resolveMapConfig(state.input.options), authoredFloor);
            const directorEntropyKey = buildDirectorEntropyKey(
                generationState.runSeed,
                generationState.specHash,
                state.input.floor,
                generationState.recentOutcomeQueue,
                familyId
            );
            const arena = buildBaseArena(state.input.floor, state.input.seed, resolvedMap, authoredFloor);
            const nextState: CompilerSessionRuntimeState = {
                ...state,
                resolvedMap,
                theme,
                specSource: spec,
                generationStateValue: generationState,
                familyId,
                authoredFloor,
                directorEntropyKey,
                arena
            };
            if (lintFindings.some(finding => finding.severity === 'error')) {
                const finding = lintFindings[0]!;
                return failRuntimeState(nextState, {
                    stage: 'normalizeSpec',
                    code: finding.code,
                    severity: finding.severity,
                    conflict: {
                        authoredId: finding.familyId || `floor_${finding.floor || state.input.floor}`,
                        constraintType: finding.code,
                        spatialContext: {
                            hexes: finding.hexes || [],
                            anchorIds: finding.anchorIds
                        }
                    },
                    diagnostics: [finding.message]
                });
            }
            return nextState;
        }
        case 'accumulateFloorTelemetry':
        case 'quantizeFloorOutcome':
        case 'updateRunDirectorState':
        case 'emitPathProgram':
            return state;
        case 'resolveFloorIntent':
            if (!state.generationStateValue || !state.resolvedMap || !state.theme) return state;
            return {
                ...state,
                intent: resolveFloorIntent(state.input.floor, state.generationStateValue, {
                    width: state.resolvedMap.width,
                    height: state.resolvedMap.height,
                    mapShape: state.resolvedMap.mapShape,
                    theme: state.theme
                }, state.authoredFloor)
            };
        case 'resolveNarrativeSceneRequest':
            if (!state.intent || !state.generationStateValue) return state;
            return {
                ...state,
                sceneRequest: resolveNarrativeSceneRequest(state.intent, state.generationStateValue)
            };
        case 'buildTopologicalBlueprint':
            if (!state.intent) return state;
            return {
                ...state,
                blueprint: buildTopologicalBlueprint(state.intent, state.authoredFloor)
            };
        case 'reserveSpatialBudget':
            if (!state.arena || !state.blueprint) return state;
            const budget = reserveSpatialBudget(state.arena, state.blueprint, state.authoredFloor);
            if ('stage' in budget) {
                return failRuntimeState(state, budget);
            }
            return {
                ...state,
                spatialBudget: budget
            };
        case 'embedSpatialPlan':
            if (!state.arena || !state.blueprint) return state;
            const embedded = embedSpatialPlan(state.arena, state.blueprint, state.authoredFloor, state.theme || 'inferno', state.input.seed);
            if ('stage' in embedded) {
                return failRuntimeState(state, embedded);
            }
            const { spatialPlan } = embedded;
            return {
                ...state,
                spatialPlan
            } as CompilerSessionRuntimeState;
        case 'resolveModulePlan':
            if (!state.blueprint || !state.theme || !state.arena || !state.spatialPlan) return state;
            const modulePlan = resolveModulePlan(
                state.blueprint,
                state.authoredFloor,
                state.theme,
                state.arena,
                state.spatialPlan,
                state.input.seed
            );
            if ('stage' in modulePlan) {
                return failRuntimeState(state, modulePlan);
            }
            return {
                ...state,
                modulePlan
            };
        case 'registerSpatialClaims':
            if (!state.modulePlan) return state;
            return {
                ...state,
                claims: registerSpatialClaims(state.modulePlan)
            };
        case 'realizeArenaArtifact':
            if (!state.arena || !state.modulePlan || !state.resolvedMap) return state;
            const realized = realizeArenaArtifact(
                state.arena,
                state.resolvedMap,
                state.input.floor,
                state.input.seed,
                state.modulePlan,
                state.authoredFloor
            );
            return {
                ...state,
                realizedTiles: realized.tiles,
                reservedKeys: realized.reservedKeys,
                spawnPositions: realized.spawnPositions,
                rooms: realized.rooms,
                authoredEnemySeeds: realized.authoredEnemySeeds
            } as CompilerSessionRuntimeState;
        case 'realizeSceneEvidence':
            if (!state.sceneRequest || !state.modulePlan || !state.arena || !state.intent) return state;
            const evidence = realizeSceneEvidence(state.sceneRequest, state.modulePlan, state.arena);
            return {
                ...state,
                logicAnchors: evidence.anchors,
                sceneSignature: buildSceneSignature(state.sceneRequest, state.intent, state.modulePlan)
            } as CompilerSessionRuntimeState;
        case 'closeUnresolvedGaskets':
            if (!state.realizedTiles || !state.theme || !state.modulePlan) return state;
            return {
                ...state,
                realizedTiles: closeUnresolvedGaskets(state.realizedTiles, state.theme, state.modulePlan, state.claims || [])
            } as CompilerSessionRuntimeState;
        case 'classifyPathLandmarks':
            if (!state.arena || !state.blueprint || !state.spatialPlan || !state.modulePlan || !state.realizedTiles) return state;
            const classified = buildPathLandmarks(
                state.arena,
                state.realizedTiles,
                state.blueprint,
                state.spatialPlan,
                state.modulePlan,
                state.logicAnchors || [],
                state.authoredFloor
            );
            return {
                ...state,
                spatialPlan: classified.spatialPlan,
                modulePlan: classified.modulePlan,
                logicAnchors: classified.logicAnchors,
                pathNetworkValue: {
                    ...emptyGeneratedPathNetwork(),
                    landmarks: classified.landmarks
                },
                pathDiagnosticsValue: buildPathDiagnostics({
                    ...emptyGeneratedPathNetwork(),
                    landmarks: classified.landmarks
                })
            } as CompilerSessionRuntimeState;
        case 'buildTacticalPathNetwork':
            if (!state.arena || !state.realizedTiles || !state.pathNetworkValue || !state.intent) return state;
            const tacticalPath = buildTacticalPathNetwork(
                state.realizedTiles,
                state.pathNetworkValue.landmarks,
                state.intent.routeProfile
            );
            if ('stage' in tacticalPath) {
                return failRuntimeState(state, tacticalPath);
            }
            return {
                ...state,
                pathNetworkValue: tacticalPath.pathNetwork,
                pathDiagnosticsValue: tacticalPath.diagnostics
            } as CompilerSessionRuntimeState;
        case 'buildVisualPathNetwork':
            if (!state.pathNetworkValue) return state;
            const visualPath = buildVisualPathNetwork(state.pathNetworkValue);
            return {
                ...state,
                pathNetworkValue: visualPath.pathNetwork,
                pathDiagnosticsValue: visualPath.diagnostics
            } as CompilerSessionRuntimeState;
        case 'applyEnvironmentalPressure':
            if (!state.arena || !state.realizedTiles || !state.pathNetworkValue || !state.intent || !state.resolvedMap) return state;
            const pressured = applyEnvironmentalPressure(
                state.arena,
                state.realizedTiles,
                state.pathNetworkValue,
                state.intent,
                state.input.seed,
                state.authoredFloor,
                state.claims || []
            );
            const pressuredSpawnTopology = resolveArenaSpawnPositions(
                state.arena,
                pressured.tiles,
                state.resolvedMap,
                state.reservedKeys || new Set<string>()
            );
            return {
                ...state,
                realizedTiles: pressured.tiles,
                spawnPositions: pressuredSpawnTopology.spawnPositions,
                pathNetworkValue: pressured.pathNetwork,
                pathDiagnosticsValue: pressured.diagnostics
            } as CompilerSessionRuntimeState;
        case 'verifyArenaArtifact':
            if (!state.arena || !state.realizedTiles || !state.modulePlan || !state.intent || !state.pathNetworkValue) return state;
            const sceneSignature = state.sceneSignature || (state.sceneRequest
                ? buildSceneSignature(state.sceneRequest, state.intent, state.modulePlan)
                : undefined);
            if (!sceneSignature) return state;
            const verificationReport = verifyArenaArtifact(
                state.arena,
                state.realizedTiles,
                state.modulePlan,
                state.claims || [],
                state.pathNetworkValue,
                sceneSignature,
                state.intent,
                state.authoredFloor
            );
            return {
                ...state,
                sceneSignature,
                verificationReport,
                artifactDigest: buildArtifactDigest(state.modulePlan, state.realizedTiles, sceneSignature, state.pathNetworkValue),
                verificationDigest: hashString(stableStringify({
                    code: verificationReport.code,
                    severity: verificationReport.severity,
                    diagnostics: verificationReport.diagnostics
                }))
            } as CompilerSessionRuntimeState;
        case 'finalizeGenerationState':
            if (!state.resolvedMap || !state.theme || !state.generationStateValue || !state.arena || !state.modulePlan || !state.realizedTiles || !state.spawnPositions || !state.rooms || !state.sceneSignature || !state.verificationReport || !state.verificationDigest || !state.artifactDigest || !state.pathNetworkValue) {
                return state;
            }
            const pathSummary = buildPathSummary(state.pathNetworkValue);
            const floorSummary: CurrentFloorSummary = {
                floor: state.input.floor,
                role: state.intent?.role || 'onboarding',
                theme: state.theme,
                floorFamilyId: state.familyId,
                parTurnTarget: state.intent?.parTurnTarget || 0,
                moduleIds: state.modulePlan.placements.map(placement => placement.moduleId),
                directorEntropyKey: state.directorEntropyKey,
                sceneSignature: state.sceneSignature,
                pathSummary,
                verificationDigest: state.verificationDigest,
                artifactDigest: state.artifactDigest
            };
            const nextGenerationState: GenerationState = {
                ...state.generationStateValue,
                currentFloorIndex: state.input.floor,
                directorEntropyKey: state.directorEntropyKey,
                currentFloorSummary: floorSummary,
                artifactDigest: state.artifactDigest
            };
            const finalReachableSpawnKeys = collectReachableSpawnKeys(
                state.arena,
                state.realizedTiles,
                state.resolvedMap
            );
            const generatedEnemies = generateFloorEnemiesInternal(
                state.input.floor,
                state.spawnPositions,
                state.input.seed,
                filterAuthoredEnemySeeds(state.authoredEnemySeeds || [], finalReachableSpawnKeys)
            );
            const enemySpawns = generatedEnemies
                .map(enemy => ({
                    id: enemy.id,
                    subtype: enemy.subtype || 'bandit_grunt',
                    position: enemy.position
                }))
                .sort((a, b) => a.id.localeCompare(b.id));
            const baseArtifact: CompiledFloorArtifact = {
                mode: state.input.floor === 1 && nextGenerationState.recentOutcomeQueue.length === 0 ? 'start_run' : 'floor_transition',
                runSeed: nextGenerationState.runSeed,
                floor: state.input.floor,
                theme: state.theme,
                gridWidth: state.resolvedMap.width,
                gridHeight: state.resolvedMap.height,
                mapShape: state.resolvedMap.mapShape,
                playerSpawn: state.arena.playerSpawn,
                stairsPosition: state.arena.stairsPosition,
                shrinePosition: state.arena.shrinePosition,
                tileBaseIds: encodeTileBaseIds(state.realizedTiles, state.resolvedMap.width, state.resolvedMap.height, state.resolvedMap.mapShape),
                tileEffects: encodeTileEffects(state.realizedTiles),
                enemySpawns,
                rooms: state.rooms,
                generationDelta: nextGenerationState,
                modulePlacements: state.modulePlan.placements,
                logicAnchors: state.logicAnchors || [],
                pathNetwork: state.pathNetworkValue,
                verificationDigest: state.verificationDigest,
                artifactDigest: state.artifactDigest
            };
            const failure = state.verificationReport.severity === 'error'
                ? {
                    stage: state.verificationReport.stage,
                    code: state.verificationReport.code,
                    severity: state.verificationReport.severity,
                    conflict: state.verificationReport.conflict || {
                        authoredId: 'arena',
                        constraintType: state.verificationReport.code,
                        spatialContext: { hexes: [state.arena.center] }
                    },
                    sceneSignature: state.sceneSignature,
                    suggestedRelaxations: state.verificationReport.suggestedRelaxations,
                    diagnostics: state.verificationReport.diagnostics
                } satisfies GenerationFailure
                : undefined;
            const debugSnapshot = buildDebugSnapshotFromRuntime({
                ...state,
                generationStateValue: nextGenerationState,
                artifact: baseArtifact,
                failure
            }, failure);
            const artifact = {
                ...baseArtifact,
                ...(debugSnapshot ? { debugSnapshot } : {})
            };
            return {
                ...state,
                artifact,
                generationStateValue: nextGenerationState,
                failure,
                debugSnapshotValue: debugSnapshot,
                result: {
                    artifact,
                    debugSnapshot,
                    generationState: nextGenerationState,
                    verificationReport: state.verificationReport,
                    ...(failure ? { failure } : {})
                }
            } as CompilerSessionRuntimeState;
        default:
            return state;
    }
};

registerCompilerPassApi({
    initializeState: initializeCompilerSessionState,
    runPass: runCompilerPass,
    getResult: (state) => (state as CompilerSessionRuntimeState).result,
    getDebugSnapshot: (state) => (state as CompilerSessionRuntimeState).debugSnapshotValue
});

export const compileStandaloneFloor = (
    floor: number,
    seed: string,
    options?: DungeonGenerationOptions
): CompileStandaloneFloorResult => {
    const spec = defaultSpecForCompile(options?.generationSpec || options?.generationState?.spec);
    const { familyId, spec: authoredFloor } = resolveAuthoredFloor(floor, spec);
    const resolvedMap = expandMapConfigForAuthoredFloor(resolveMapConfig(options), authoredFloor);
    const theme = getFloorTheme(floor);
    const lintFindings = lintGenerationSpecInput(spec);
    const generationState = ensureGenerationState(
        options?.generationState,
        options?.generationState?.runSeed || seed,
        spec
    );
    const directorEntropyKey = buildDirectorEntropyKey(
        generationState.runSeed,
        generationState.specHash,
        floor,
        generationState.recentOutcomeQueue,
        familyId
    );
    const arena = buildBaseArena(floor, seed, resolvedMap, authoredFloor);

    const failWith = (
        failure: GenerationFailure,
        debugSnapshot?: GenerationDebugSnapshot
    ): CompileStandaloneFloorResult => ({
        dungeon: {
            rooms: [],
            allHexes: arena.allHexes,
            stairsPosition: arena.stairsPosition,
            shrinePosition: arena.shrinePosition,
            playerSpawn: arena.playerSpawn,
            spawnPositions: [],
            tiles: new Map()
        },
        enemies: [],
        generationState: {
            ...generationState,
            currentFloorIndex: floor,
            directorEntropyKey
        },
        verificationReport: {
            stage: failure.stage,
            code: failure.code,
            severity: failure.severity,
            conflict: failure.conflict,
            sceneSignature: failure.sceneSignature,
            suggestedRelaxations: failure.suggestedRelaxations,
            diagnostics: failure.diagnostics
        },
        artifact: emptyArtifact(floor, seed, { ...resolvedMap, theme }, generationState, 'floor_transition', debugSnapshot),
        ...(debugSnapshot ? { debugSnapshot } : {}),
        failure
    });

    if (lintFindings.some(finding => finding.severity === 'error')) {
        const finding = lintFindings[0]!;
        return failWith({
            stage: 'normalizeSpec',
            code: finding.code,
            severity: finding.severity,
            conflict: {
                authoredId: finding.familyId || `floor_${finding.floor || floor}`,
                constraintType: finding.code,
                spatialContext: {
                    hexes: finding.hexes || [],
                    anchorIds: finding.anchorIds
                }
            },
            diagnostics: [finding.message]
        });
    }

    const intent = resolveFloorIntent(floor, generationState, {
        width: resolvedMap.width,
        height: resolvedMap.height,
        mapShape: resolvedMap.mapShape,
        theme
    }, authoredFloor);
    const sceneRequest = resolveNarrativeSceneRequest(intent, generationState);
    const blueprint = buildTopologicalBlueprint(intent, authoredFloor);
    const budget = reserveSpatialBudget(arena, blueprint, authoredFloor);
    if ('stage' in budget) {
        const sceneSignature = buildSceneSignature(sceneRequest, intent, { placements: [] });
        return failWith(budget, {
            intent,
            sceneRequest,
            blueprint,
            spatialBudget: {
                freeCellsByParity: { even: 0, odd: 0 },
                connectorSeatsByParity: { even: 0, odd: 0 },
                loopCandidateAnchorsByParity: { even: [], odd: [] },
                pinnedFootprints: [],
                closedPathOffsets: {}
            },
            spatialPlan: {
                slotPlacements: [],
                anchorById: {},
                gasketAnchors: {},
                mainLandmarkIds: [],
                primaryLandmarkIds: [],
                alternateLandmarkIds: [],
                hiddenLandmarkIds: []
            },
            modulePlan: { placements: [] },
            claims: [],
            pathNetwork: emptyGeneratedPathNetwork(),
            pathDiagnostics: [],
            sceneSignature,
            verificationReport: {
                stage: budget.stage,
                code: budget.code,
                severity: budget.severity,
                conflict: budget.conflict,
                diagnostics: budget.diagnostics
            },
            failure: budget
        });
    }

    const embedded = embedSpatialPlan(arena, blueprint, authoredFloor, theme, seed);
    if ('stage' in embedded) {
        const sceneSignature = buildSceneSignature(sceneRequest, intent, { placements: [] });
        return failWith(embedded, {
            intent,
            sceneRequest,
            blueprint,
            spatialBudget: budget,
            spatialPlan: {
                slotPlacements: [],
                anchorById: {},
                gasketAnchors: {},
                mainLandmarkIds: [],
                primaryLandmarkIds: [],
                alternateLandmarkIds: [],
                hiddenLandmarkIds: []
            },
            modulePlan: { placements: [] },
            claims: [],
            pathNetwork: emptyGeneratedPathNetwork(),
            pathDiagnostics: [],
            sceneSignature,
            verificationReport: {
                stage: embedded.stage,
                code: embedded.code,
                severity: embedded.severity,
                conflict: embedded.conflict,
                diagnostics: embedded.diagnostics
            },
            failure: embedded
        });
    }
    const { spatialPlan } = embedded;
    const modulePlan = resolveModulePlan(blueprint, authoredFloor, theme, arena, spatialPlan, seed);
    if ('stage' in modulePlan) {
        const sceneSignature = buildSceneSignature(sceneRequest, intent, { placements: [] });
        return failWith(modulePlan, {
            intent,
            sceneRequest,
            blueprint,
            spatialBudget: budget,
            spatialPlan,
            modulePlan: { placements: [] },
            claims: [],
            pathNetwork: emptyGeneratedPathNetwork(),
            pathDiagnostics: [],
            sceneSignature,
            verificationReport: {
                stage: modulePlan.stage,
                code: modulePlan.code,
                severity: modulePlan.severity,
                conflict: modulePlan.conflict,
                diagnostics: modulePlan.diagnostics
            },
            failure: modulePlan
        });
    }

    const claims = registerSpatialClaims(modulePlan);
    const { tiles: realizedTiles, rooms, reservedKeys, authoredEnemySeeds } = realizeArenaArtifact(
        arena,
        resolvedMap,
        floor,
        seed,
        modulePlan,
        authoredFloor
    );
    const { anchors } = realizeSceneEvidence(sceneRequest, modulePlan, arena);
    const sceneSignature = buildSceneSignature(sceneRequest, intent, modulePlan);
    const closedTiles = closeUnresolvedGaskets(realizedTiles, theme, modulePlan, claims);
    const classified = buildPathLandmarks(arena, closedTiles, blueprint, spatialPlan, modulePlan, anchors, authoredFloor);
    const tacticalPath = buildTacticalPathNetwork(closedTiles, classified.landmarks, intent.routeProfile);
    if ('stage' in tacticalPath) {
        return failWith(tacticalPath, {
            intent,
            sceneRequest,
            blueprint,
            spatialBudget: budget,
            spatialPlan: classified.spatialPlan,
            modulePlan: classified.modulePlan,
            claims,
            pathNetwork: emptyGeneratedPathNetwork(),
            pathDiagnostics: [],
            sceneSignature,
            verificationReport: buildVerificationFromFailure(tacticalPath),
            failure: tacticalPath
        });
    }
    const visualPath = buildVisualPathNetwork(tacticalPath.pathNetwork);
    const pressured = applyEnvironmentalPressure(
        arena,
        closedTiles,
        visualPath.pathNetwork,
        intent,
        seed,
        authoredFloor,
        claims
    );
    const pathNetwork = pressured.pathNetwork;
    const pathDiagnostics = pressured.diagnostics;
    const pressuredTiles = pressured.tiles;
    const finalSpawnTopology = resolveArenaSpawnPositions(arena, pressuredTiles, resolvedMap, reservedKeys);
    const spawnPositions = finalSpawnTopology.spawnPositions;
    const verificationReport = verifyArenaArtifact(
        arena,
        pressuredTiles,
        classified.modulePlan,
        claims,
        pathNetwork,
        sceneSignature,
        intent,
        authoredFloor
    );
    const artifactDigest = buildArtifactDigest(classified.modulePlan, pressuredTiles, sceneSignature, pathNetwork);
    const verificationDigest = hashString(stableStringify({
        code: verificationReport.code,
        severity: verificationReport.severity,
        diagnostics: verificationReport.diagnostics
    }));
    const pathSummary = buildPathSummary(pathNetwork);

    const floorSummary: CurrentFloorSummary = {
        floor,
        role: intent.role,
        theme,
        floorFamilyId: familyId,
        parTurnTarget: intent.parTurnTarget,
        moduleIds: classified.modulePlan.placements.map(placement => placement.moduleId),
        directorEntropyKey,
        sceneSignature,
        pathSummary,
        verificationDigest,
        artifactDigest
    };

    const nextGenerationState = {
        ...generationState,
        currentFloorIndex: floor,
        directorEntropyKey,
        currentFloorSummary: floorSummary,
        artifactDigest
    };

    const generatedEnemies = generateFloorEnemiesInternal(
        floor,
        spawnPositions,
        seed,
        filterAuthoredEnemySeeds(authoredEnemySeeds, finalSpawnTopology.reachableKeys)
    );
    const enemySpawns = generatedEnemies
        .map(enemy => ({
            id: enemy.id,
            subtype: enemy.subtype || 'bandit_grunt',
            position: enemy.position
        }))
        .sort((a, b) => a.id.localeCompare(b.id));

    const artifact: CompiledFloorArtifact = {
        mode: floor === 1 && generationState.recentOutcomeQueue.length === 0 ? 'start_run' : 'floor_transition',
        runSeed: nextGenerationState.runSeed,
        floor,
        theme,
        gridWidth: resolvedMap.width,
        gridHeight: resolvedMap.height,
        mapShape: resolvedMap.mapShape,
        playerSpawn: arena.playerSpawn,
        stairsPosition: arena.stairsPosition,
        shrinePosition: arena.shrinePosition,
        tileBaseIds: encodeTileBaseIds(pressuredTiles, resolvedMap.width, resolvedMap.height, resolvedMap.mapShape),
        tileEffects: encodeTileEffects(pressuredTiles),
        enemySpawns,
        rooms,
        generationDelta: nextGenerationState,
        modulePlacements: classified.modulePlan.placements,
        logicAnchors: classified.logicAnchors,
        pathNetwork,
        verificationDigest,
        artifactDigest
    };

    const failure = verificationReport.severity === 'error'
        ? {
            stage: verificationReport.stage,
            code: verificationReport.code,
            severity: verificationReport.severity,
            conflict: verificationReport.conflict || {
                authoredId: 'arena',
                constraintType: verificationReport.code,
                spatialContext: { hexes: [arena.center] }
            },
            sceneSignature,
            suggestedRelaxations: verificationReport.suggestedRelaxations,
            diagnostics: verificationReport.diagnostics
        } satisfies GenerationFailure
        : undefined;

    const debugSnapshot: GenerationDebugSnapshot = {
        intent,
        sceneRequest,
        blueprint,
        spatialBudget: budget,
        spatialPlan: classified.spatialPlan,
        modulePlan: classified.modulePlan,
        claims,
        pathNetwork,
        pathDiagnostics,
        sceneSignature,
        verificationReport,
        ...(failure ? { failure } : {})
    };

    const dungeon: DungeonResult = {
        rooms,
        allHexes: arena.allHexes,
        stairsPosition: arena.stairsPosition,
        shrinePosition: arena.shrinePosition,
        playerSpawn: arena.playerSpawn,
        spawnPositions,
        tiles: pressuredTiles,
        artifactSummary: floorSummary,
        modulePlacements: classified.modulePlan.placements,
        logicAnchors: classified.logicAnchors,
        verificationDigest
    };

    return {
        dungeon,
        enemies: rebuildEnemiesFromArtifact(artifact),
        generationState: nextGenerationState,
        verificationReport,
        artifact: {
            ...artifact,
            debugSnapshot
        },
        debugSnapshot,
        failure
    };
};

export const generateFloorEnemies = (
    floor: number,
    spawnPositions: Point[],
    seed: string
): Entity[] => generateFloorEnemiesInternal(floor, spawnPositions, seed);

export const initializeGenerationForState = (
    baseState: GenerationState | undefined,
    runSeed: string,
    spec: GenerationSpecInput | undefined,
    state: Pick<GameState, 'floor' | 'turnsSpent' | 'hazardBreaches' | 'kills' | 'combatScoreEvents' | 'player' | 'runTelemetry'>
): GenerationState => initializeFloorTelemetry(
    ensureGenerationState(baseState, runSeed, spec),
    state
);

export const createInitialCompilerGenerationState = (
    runSeed: string,
    spec?: GenerationSpecInput
): GenerationState => createGenerationState(runSeed, spec);

export const compileStartRunArtifact = (
    context: StartRunCompileContext
): CompiledFloorArtifact => {
    const resolvedMap = resolveMapConfig({
        gridWidth: context.mapSize?.width,
        gridHeight: context.mapSize?.height,
        mapShape: context.mapShape as MapShape | undefined
    });
    const resolvedDate = context.mode === 'daily' ? toDateKey(context.date) : context.date;
    const runSeed = context.mode === 'daily'
        ? (context.seed || createDailySeed(resolvedDate!))
        : (context.seed || String(Date.now()));
    const initialGenerationState = createGenerationState(runSeed, context.generationSpec);
    const result = compileStandaloneFloor(1, runSeed, {
        gridWidth: resolvedMap.width,
        gridHeight: resolvedMap.height,
        mapShape: resolvedMap.mapShape,
        generationSpec: context.generationSpec,
        generationState: initialGenerationState
    });
    return {
        ...result.artifact,
        mode: 'start_run',
        runSeed,
        loadoutId: context.loadoutId,
        runMode: context.mode || 'normal',
        runDate: resolvedDate,
        rulesetOverrides: context.rulesetOverrides,
        ...(context.includeDebug ? {} : { debugSnapshot: undefined })
    };
};

export const compilePendingFloorArtifact = (
    context: TransitionCompileContext
): CompiledFloorArtifact => {
    const advancedGenerationState = advanceGenerationStateFromCompletedFloor({
        floor: context.floor - 1,
        turnsSpent: context.playerCarryover.turnsSpent || 0,
        hazardBreaches: context.playerCarryover.hazardBreaches || 0,
        kills: context.playerCarryover.kills || 0,
        combatScoreEvents: (context.playerCarryover.combatScoreEvents || []) as GameState['combatScoreEvents'],
        player: {
            id: 'player',
            type: 'player',
            position: createHex(0, 0),
            hp: context.playerCarryover.hp,
            maxHp: context.playerCarryover.maxHp,
            speed: 1,
            factionId: 'player',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [],
            components: new Map()
        },
        runTelemetry: context.runTelemetry,
        generationState: context.generationState
    });
    const floorSeed = `${advancedGenerationState.runSeed}:${context.floor}`;
    const result = compileStandaloneFloor(context.floor, floorSeed, {
        gridWidth: context.mapSize.width,
        gridHeight: context.mapSize.height,
        mapShape: context.mapShape as MapShape,
        generationSpec: advancedGenerationState.spec,
        generationState: advancedGenerationState
    });
    return {
        ...result.artifact,
        mode: 'floor_transition',
        ...(context.includeDebug ? {} : { debugSnapshot: undefined })
    };
};
