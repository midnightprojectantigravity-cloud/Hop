import type { Entity, FloorTheme, GameState, MapShape, Point, Room } from '../types';
import type { Tile } from '../systems/tiles/tile-types';
import { FLOOR_THEMES } from '../constants';
import { createHex, pointToKey } from '../hex';
import { isSpecialTile } from '../helpers';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';
import { createDailySeed, toDateKey } from '../systems/run-objectives';
import { resolveBiomeHazardTileId } from '../systems/biomes';
import { registerCompilerPassApi } from './session';
import { buildModuleRegistryIndex } from './modules';
import { hexDistanceInt, hasClearLosInt } from './math/hex-int';
import { createRng32, shuffleStable } from './rng32';
import { advanceGenerationStateFromCompletedFloor, buildDirectorEntropyKey, createGenerationState, ensureGenerationState, initializeFloorTelemetry } from './telemetry';
import { hashString, stableStringify } from './hash';
import {
    buildEdgesFromTileKeys,
    buildEdgeSignature,
    buildPathBendKeys,
    computeMaxStraightRun,
    isHazardousPathTile,
    isPathEligibleTile,
    parseKeyToHex,
    resolveTileRouteMembership,
    walkableNeighborKeys
} from './compiler-path-utils';
import {
    buildTacticalPathNetwork,
    buildVisualPathNetwork
} from './compiler-path-network';
import {
    collectAnchors,
    buildBaseArena,
    buildTopologicalBlueprint,
    expandMapConfigForAuthoredFloor,
    reserveSpatialBudget,
    resolveFloorIntent,
    resolveMapConfig,
    resolveNarrativeSceneRequest
} from './compiler-context';
import type { BaseArena } from './compiler-context';
import {
    registerSpatialClaims,
    realizeSceneEvidence,
    resolveModulePlan
} from './compiler-materialization';
import {
    buildArtifactDigest,
    buildPathDiagnostics,
    buildPathSummary,
    buildSceneSignature,
    encodeTileBaseIds,
    encodeTileEffects,
    emptyArtifact,
    rebuildEnemiesFromArtifact
} from './artifact-helpers';
import { generateFloorEnemies } from './enemy-generation';
import type {
    AuthoredPathOverride,
    AuthoredFloorFamilySpec,
    AuthoredFloorSpec,
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
    GenerationSpecInput,
    GenerationState,
    LocalHex,
    ModulePlan,
    ModulePlacement,
    NarrativeAnchor,
    PathEdge,
    PathLandmark,
    RouteMembership,
    SceneSignature,
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
    theme?: FloorTheme;
    contentTheme?: FloorTheme;
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

type AuthoredFloor = AuthoredFloorSpec;

interface ResolvedAuthoredFloor {
    familyId?: string;
    spec?: AuthoredFloor;
}

interface CompilerSessionRuntimeState extends CompilerSessionState {
    resolvedMap?: { width: number; height: number; mapShape: MapShape };
    theme?: string;
    contentTheme?: string;
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
    VOID: 3,
    TOXIC: 4
} as const;

const themeDefaultClosure = (theme: string): 'WALL' | 'VOID' =>
    theme === 'inferno' ? 'WALL' : 'VOID';

const resolveAuthoredBaseId = (baseId: string, appliedTheme?: FloorTheme): 'STONE' | 'WALL' | 'LAVA' | 'VOID' | 'TOXIC' => {
    if (baseId === 'HAZARD') return resolveBiomeHazardTileId(appliedTheme);
    return baseId as 'STONE' | 'WALL' | 'LAVA' | 'VOID' | 'TOXIC';
};

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

const createTile = (baseId: 'STONE' | 'WALL' | 'LAVA' | 'VOID' | 'TOXIC', position: Point): Tile => ({
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

const buildStraightRunHotspotKeys = (pathNetwork: GeneratedPathNetwork, minStraightRun: number): Set<string> => {
    const hotspots = new Set<string>();
    if (minStraightRun <= 0) return hotspots;
    const orderedTiles = new Set(pathNetwork.visualTileKeys.length > 0 ? pathNetwork.visualTileKeys : pathNetwork.tacticalTileKeys);
    const segments = pathNetwork.segments
        .filter(segment => segment.kind !== 'spur')
        .map(segment => segment.tileKeys)
        .filter(tileKeys => tileKeys.length > 0);

    for (const tileKeys of segments) {
        let runStart = 0;
        while (runStart < tileKeys.length) {
            let runEnd = runStart + 1;
            while (runEnd < tileKeys.length) {
                const previous = parseKeyToHex(tileKeys[runEnd - 1]!);
                const current = parseKeyToHex(tileKeys[runEnd]!);
                const before = runEnd - 2 >= runStart ? parseKeyToHex(tileKeys[runEnd - 2]!) : undefined;
                const direction = `${current.q - previous.q},${current.r - previous.r}`;
                const beforeDirection = before ? `${previous.q - before.q},${previous.r - before.r}` : undefined;
                if (beforeDirection && beforeDirection !== direction) break;
                runEnd += 1;
            }
            const runLength = runEnd - runStart;
            if (runLength >= minStraightRun) {
                for (let index = runStart; index < runEnd; index += 1) {
                    const key = tileKeys[index]!;
                    if (orderedTiles.has(key)) hotspots.add(key);
                }
            }
            runStart = runEnd;
        }
    }

    return hotspots;
};

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

const realizeArenaArtifact = (
    arena: BaseArena,
    map: { width: number; height: number; mapShape: MapShape },
    floor: number,
    _seed: string,
    modulePlan: ModulePlan,
    authoredFloor: AuthoredFloor | undefined,
    appliedTheme: FloorTheme
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
            tileMap.set(pointToKey(point), createTile(resolveAuthoredBaseId(stamp.baseId, appliedTheme), point));
        }
    }

    for (const stamp of authoredFloor?.tileStamps || []) {
        const point = createHex(stamp.dq, stamp.dr);
        if (!tileMap.has(pointToKey(point))) continue;
        reservedKeys.add(pointToKey(point));
        tileMap.set(pointToKey(point), createTile(resolveAuthoredBaseId(stamp.baseId, appliedTheme), point));
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

const applyEnvironmentalPressure = (
    arena: BaseArena,
    tiles: Map<string, Tile>,
    pathNetwork: GeneratedPathNetwork,
    intent: FloorIntentRequest,
    seed: string,
    authoredFloor?: AuthoredFloor,
    claims: SpatialClaim[] = [],
    appliedTheme?: FloorTheme
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
    const lavaPriority = intent.role === 'pressure_spike' || intent.role === 'elite'
        ? ['alternate', 'shared', 'primary'] as const
        : ['shared', 'alternate', 'primary'] as const;

    const isMutablePressureKey = (key: string): boolean =>
        !hardClaimKeys.has(key)
        && !specials.has(key)
        && !landmarkKeys.has(key)
        && !usedTileKeys.has(key);

    const resolvePressureRouteMembership = (key: string): Exclude<RouteMembership, 'hidden'> => {
        if (pathNetwork.visualTileKeys.includes(key)) {
            return resolveTileRouteMembership(pathNetwork, key);
        }
        const neighboringMemberships = walkableNeighborKeys(parseKeyToHex(key))
            .filter(neighborKey => pathNetwork.visualTileKeys.includes(neighborKey))
            .map(neighborKey => resolveTileRouteMembership(pathNetwork, neighborKey));
        if (neighboringMemberships.includes('shared')) return 'shared';
        if (neighboringMemberships.includes('alternate')) return 'alternate';
        return 'primary';
    };

    const prioritizeHexKeys = (
        keys: string[],
        priority: readonly ['primary' | 'alternate' | 'shared', 'primary' | 'alternate' | 'shared', 'primary' | 'alternate' | 'shared'],
        membershipResolver: (key: string) => Exclude<RouteMembership, 'hidden'> = (key) => resolveTileRouteMembership(pathNetwork, key)
    ): Point[] => priority.flatMap(routeMembership =>
        shuffleStable(
            keys
                .filter(key => membershipResolver(key) === routeMembership)
                .sort((left, right) => left.localeCompare(right))
                .map(parseKeyToHex),
            rng
        )
    );

    const pushObstacleCluster = (centerKey: string): boolean => {
        const center = parseKeyToHex(centerKey);
        const routeMembership = resolvePressureRouteMembership(centerKey);
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

    const pushLavaCluster = (centerKey: string): boolean => {
        const centerTile = nextTiles.get(centerKey);
        if (!centerTile || centerTile.baseId !== 'STONE' || tacticalRouteTileKeys.has(centerKey) || !isMutablePressureKey(centerKey)) {
            return false;
        }

        const routeMembership = resolveTileRouteMembership(pathNetwork, centerKey);
        const clusterKeys = [centerKey];
        nextTiles.set(centerKey, createTile(resolveBiomeHazardTileId(appliedTheme), centerTile.position));
        usedTileKeys.add(centerKey);

        const allowSecondTile = intent.role === 'pressure_spike' || intent.role === 'elite';
        if (allowSecondTile) {
            const secondaryKey = walkableNeighborKeys(centerTile.position)
                .sort((left, right) => left.localeCompare(right))
                .find(candidateKey => {
                    const tile = nextTiles.get(candidateKey);
                    return !!tile
                        && tile.baseId === 'STONE'
                        && !tacticalRouteTileKeys.has(candidateKey)
                        && isMutablePressureKey(candidateKey)
                    && resolvePressureRouteMembership(candidateKey) === routeMembership;
                });
            if (secondaryKey) {
                const secondaryTile = nextTiles.get(secondaryKey)!;
                nextTiles.set(secondaryKey, createTile(resolveBiomeHazardTileId(appliedTheme), secondaryTile.position));
                usedTileKeys.add(secondaryKey);
                clusterKeys.push(secondaryKey);
            }
        }

        clusters.push({
            id: `lava:${clusters.length}:${centerKey}`,
            kind: 'lava',
            routeMembership,
            tileKeys: clusterKeys
        });
        return true;
    };

    const trapTiles = prioritizeHexKeys(
        pathNetwork.visualTileKeys
            .filter(key => isMutablePressureKey(key)),
        trapPriority
    );
    const lavaCandidateKeys = Array.from(new Set(
        pathNetwork.visualTileKeys.flatMap(key => walkableNeighborKeys(parseKeyToHex(key)))
    ))
        .sort((left, right) => left.localeCompare(right))
        .filter(key => {
            const tile = nextTiles.get(key);
            return !!tile
                && tile.baseId === 'STONE'
                && !tacticalRouteTileKeys.has(key)
                && isMutablePressureKey(key)
                && (intent.role !== 'recovery' || resolvePressureRouteMembership(key) !== 'primary')
                && walkableNeighborKeys(parseKeyToHex(key)).some(neighborKey => tacticalRouteTileKeys.has(neighborKey));
        });

    const obstacleCenters = prioritizeHexKeys(clusterCenterKeys, obstaclePriority);
    if (!authoredFloor) {
        let obstacleCount = 0;
        for (const center of obstacleCenters) {
            if (obstacleCount >= profile.obstacleClusterBudget) break;
            if (pushObstacleCluster(pointToKey(center))) obstacleCount += 1;
        }
    }

    const lavaBudget = intent.theme === 'inferno'
        ? authoredFloor ? Math.min(1, profile.lavaClusterBudget) : profile.lavaClusterBudget
        : 0;
    let lavaCount = 0;
    for (const point of prioritizeHexKeys(lavaCandidateKeys, lavaPriority, resolvePressureRouteMembership)) {
        if (lavaCount >= lavaBudget) break;
        if (pushLavaCluster(pointToKey(point))) lavaCount += 1;
    }

    if (!authoredFloor) {
        let trapCount = 0;
        const trapBudget = Math.max(0, profile.trapClusterBudget - lavaCount);
        for (const point of trapTiles) {
            if (trapCount >= trapBudget) break;
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
    if (!state.resolvedMap || !state.theme || !state.contentTheme || !state.generationStateValue) {
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
            theme: state.theme,
            contentTheme: state.contentTheme
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
            const theme = (state.input.options?.theme || getFloorTheme(state.input.floor)) as FloorTheme;
            const contentTheme = (state.input.options?.contentTheme || state.input.options?.theme || getFloorTheme(state.input.floor)) as FloorTheme;
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
                contentTheme,
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
            if (!state.generationStateValue || !state.resolvedMap || !state.contentTheme) return state;
            return {
                ...state,
                intent: resolveFloorIntent(state.input.floor, state.generationStateValue, {
                    width: state.resolvedMap.width,
                    height: state.resolvedMap.height,
                    mapShape: state.resolvedMap.mapShape,
                    theme: state.contentTheme
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
            if (!state.arena || !state.blueprint || !state.contentTheme) return state;
            const embedded = embedSpatialPlan(state.arena, state.blueprint, state.authoredFloor, state.contentTheme, state.input.seed);
            if ('stage' in embedded) {
                return failRuntimeState(state, embedded);
            }
            const { spatialPlan } = embedded;
            return {
                ...state,
                spatialPlan
            } as CompilerSessionRuntimeState;
        case 'resolveModulePlan':
            if (!state.blueprint || !state.contentTheme || !state.arena || !state.spatialPlan) return state;
            const modulePlan = resolveModulePlan(
                state.blueprint,
                state.authoredFloor,
                state.contentTheme,
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
            if (!state.arena || !state.modulePlan || !state.resolvedMap || !state.theme) return state;
            const realized = realizeArenaArtifact(
                state.arena,
                state.resolvedMap,
                state.input.floor,
                state.input.seed,
                state.modulePlan,
                state.authoredFloor,
                state.theme as FloorTheme
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
            if (!state.realizedTiles || !state.contentTheme || !state.modulePlan) return state;
            return {
                ...state,
                realizedTiles: closeUnresolvedGaskets(state.realizedTiles, state.contentTheme, state.modulePlan, state.claims || [])
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
            if (!state.arena || !state.realizedTiles || !state.pathNetworkValue || !state.intent || !state.resolvedMap || !state.theme) return state;
            const pressured = applyEnvironmentalPressure(
                state.arena,
                state.realizedTiles,
                state.pathNetworkValue,
                state.intent,
                state.input.seed,
                state.authoredFloor,
                state.claims || [],
                state.theme as FloorTheme
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
            if (!state.resolvedMap || !state.theme || !state.contentTheme || !state.generationStateValue || !state.arena || !state.modulePlan || !state.realizedTiles || !state.spawnPositions || !state.rooms || !state.sceneSignature || !state.verificationReport || !state.verificationDigest || !state.artifactDigest || !state.pathNetworkValue) {
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
            const generatedEnemies = generateFloorEnemies(
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
                contentTheme: state.contentTheme || state.input.options?.contentTheme || state.input.options?.theme,
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
    const theme = (options?.theme || authoredFloor?.theme || getFloorTheme(floor)) as FloorTheme;
    const contentTheme = (options?.contentTheme || theme) as FloorTheme;
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
        artifact: emptyArtifact(floor, seed, { ...resolvedMap, theme, contentTheme }, generationState, 'floor_transition', debugSnapshot),
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
        theme: contentTheme
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

    const embedded = embedSpatialPlan(arena, blueprint, authoredFloor, contentTheme, seed);
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
    const modulePlan = resolveModulePlan(blueprint, authoredFloor, contentTheme, arena, spatialPlan, seed);
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
        authoredFloor,
        theme
    );
    const { anchors } = realizeSceneEvidence(sceneRequest, modulePlan, arena);
    const sceneSignature = buildSceneSignature(sceneRequest, intent, modulePlan);
    const closedTiles = closeUnresolvedGaskets(realizedTiles, contentTheme, modulePlan, claims);
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
        claims,
        theme
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

    const generatedEnemies = generateFloorEnemies(
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
        contentTheme,
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
        theme: context.themeId,
        contentTheme: context.contentThemeId || context.themeId,
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
        theme: context.themeId,
        contentTheme: context.contentThemeId || context.themeId,
        generationSpec: advancedGenerationState.spec,
        generationState: advancedGenerationState
    });
    return {
        ...result.artifact,
        mode: 'floor_transition',
        ...(context.includeDebug ? {} : { debugSnapshot: undefined })
    };
};
