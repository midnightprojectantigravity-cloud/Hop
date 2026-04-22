import type { Entity, MapShape, Point } from '../types';
import type { Tile } from '../systems/tiles/tile-types';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { createHex, getGridForShape, pointToKey } from '../hex';
import { getEnemyCatalogEntry, getEnemyCatalogSkillLoadout, getFloorSpawnProfile } from '../data/enemies';
import { getBaseUnitDefinitionBySubtype } from '../systems/entities/base-unit-registry';
import { instantiateActorFromDefinitionWithCursor } from '../systems/entities/propensity-instantiation';
import { createEnemy, getEnemySkillLoadout } from '../systems/entities/entity-factory';
import type {
    CompiledFloorArtifact,
    GeneratedPathNetwork,
    GenerationDebugSnapshot,
    GenerationMapShape,
    GenerationState,
    ModulePlan,
    PathSummary,
    SceneSignature
} from './schema';
import { hashString, stableStringify } from './hash';

const TILE_CODE_BY_ID = {
    STONE: 0,
    WALL: 1,
    LAVA: 2,
    VOID: 3,
    TOXIC: 4
} as const;

const TILE_ID_BY_CODE: Record<number, keyof typeof TILE_CODE_BY_ID> = {
    0: 'STONE',
    1: 'WALL',
    2: 'LAVA',
    3: 'VOID',
    4: 'TOXIC'
};

const createTile = (baseId: 'STONE' | 'WALL' | 'LAVA' | 'VOID' | 'TOXIC', position: Point): Tile => ({
    baseId,
    position,
    traits: new Set(BASE_TILES[baseId].defaultTraits),
    effects: []
});

const emptyGeneratedPathNetwork = (): GeneratedPathNetwork => ({
    landmarks: [],
    tacticalTileKeys: [],
    tacticalEdges: [],
    visualTileKeys: [],
    visualEdges: [],
    segments: [],
    routeCount: 0,
    junctionTileKeys: [],
    maxStraightRun: 0,
    environmentalPressureClusters: []
});

export const buildPathSummary = (pathNetwork: GeneratedPathNetwork): PathSummary => {
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
    const lavaClusterCount = pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'lava').length;

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
        lavaClusterCount,
        tacticalTileCount: pathNetwork.tacticalTileKeys.length,
        visualTileCount: pathNetwork.visualTileKeys.length
    };
};

export const buildPathDiagnostics = (pathNetwork: GeneratedPathNetwork): string[] => ([
    `main_landmarks=${pathNetwork.landmarks.filter(landmark => landmark.onPath).map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `primary_landmarks=${pathNetwork.landmarks.filter(landmark => landmark.routeMembership === 'primary' || landmark.routeMembership === 'shared').map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `alternate_landmarks=${pathNetwork.landmarks.filter(landmark => landmark.routeMembership === 'alternate' || landmark.routeMembership === 'shared').map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `hidden_landmarks=${pathNetwork.landmarks.filter(landmark => !landmark.onPath).map(landmark => landmark.id).sort().join(',') || 'none'}`,
    `route_count=${pathNetwork.routeCount}`,
    `junction_count=${pathNetwork.junctionTileKeys.length}`,
    `max_straight_run=${pathNetwork.maxStraightRun}`,
    `obstacle_clusters=${pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'obstacle').length}`,
    `trap_clusters=${pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'trap').length}`,
    `lava_clusters=${pathNetwork.environmentalPressureClusters.filter(cluster => cluster.kind === 'lava').length}`,
    `primary_route_tiles=${new Set(pathNetwork.segments.filter(segment => segment.routeMembership === 'primary' || segment.routeMembership === 'shared').flatMap(segment => segment.tileKeys)).size}`,
    `alternate_route_tiles=${new Set(pathNetwork.segments.filter(segment => segment.routeMembership === 'alternate' || segment.routeMembership === 'shared').flatMap(segment => segment.tileKeys)).size}`,
    `tactical_tiles=${pathNetwork.tacticalTileKeys.length}`,
    `visual_tiles=${pathNetwork.visualTileKeys.length}`,
    `segments=${pathNetwork.segments.map(segment => `${segment.kind}:${segment.fromLandmarkId}->${segment.toLandmarkId}`).join('|') || 'none'}`
]);

export const buildSceneSignature = (
    sceneRequest: { motif: string; mood: string },
    intent: { role: string; theme: string },
    modulePlan: ModulePlan
): SceneSignature => ({
    sceneId: hashString(stableStringify({
        role: intent.role,
        motif: sceneRequest.motif,
        modules: modulePlan.placements.map(item => item.moduleId)
    })),
    motif: sceneRequest.motif,
    mood: sceneRequest.mood,
    encounterPosture: (sceneRequest as any).encounterPosture,
    primaryEvidence: sceneRequest.motif,
    secondaryEvidence: modulePlan.placements[1]?.moduleId,
    hostileRosterDescriptor: intent.role === 'elite' ? 'elevated' : 'standard',
    terrainDescriptor: intent.theme,
    spatialDescriptor: modulePlan.placements.length > 1 ? 'layered' : 'focused'
});

export const buildArtifactDigest = (
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

export const emptyArtifact = (
    floor: number,
    seed: string,
    options: { width: number; height: number; mapShape: MapShape; theme: string; contentTheme?: string },
    generationState: GenerationState,
    mode: CompiledFloorArtifact['mode'] = 'floor_transition',
    debugSnapshot?: GenerationDebugSnapshot
): CompiledFloorArtifact => ({
    mode,
    runSeed: generationState.runSeed || seed,
    floor,
    theme: options.theme,
    ...(options.contentTheme ? { contentTheme: options.contentTheme } : {}),
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

export const encodeTileBaseIds = (
    tiles: Map<string, Tile>,
    width: number,
    height: number,
    mapShape: MapShape
): Uint8Array => {
    const grid = getGridForShape(width, height, mapShape)
        .sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
    return Uint8Array.from(grid.map(point => {
        const tile = tiles.get(pointToKey(point));
        const baseId = tile?.baseId === 'WALL' || tile?.baseId === 'LAVA' || tile?.baseId === 'VOID' || tile?.baseId === 'TOXIC'
            ? tile.baseId
            : 'STONE';
        return TILE_CODE_BY_ID[baseId];
    }));
};

export const encodeTileEffects = (tiles: Map<string, Tile>) =>
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
