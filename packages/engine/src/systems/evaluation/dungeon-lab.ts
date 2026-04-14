import { DEFAULT_START_RUN_MAP_SHAPE, DEFAULT_START_RUN_MAP_SIZE, resolveStartRunMapConfig } from '../../constants';
import { pointToKey } from '../../hex';
import { fingerprintFromState, gameReducer, generateInitialState } from '../../logic';
import { hydrateLoadedState } from '../../logic-rules';
import { createActiveSkill, SkillRegistry } from '../../skillRegistry';
import type {
    Action,
    Actor,
    GameState,
    GenericAiGoal,
    GridSize,
    MapShape,
    Point,
    Skill,
    WeightClass
} from '../../types';
import type { AilmentID } from '../../types/registry';
import type { TileID } from '../../types/registry';
import { getAilmentDefinition } from '../../data/ailments';
import { deriveEnemyBestiaryStats } from '../../data/enemies';
import { MVP_ENEMY_CONTENT } from '../../data/packs/mvp-enemy-content';
import { BASE_TILES } from '../tiles/tile-registry';
import type { Tile, TileEffectState } from '../tiles/tile-types';
import { buildInitiativeQueue, isPlayerTurn } from '../initiative';
import { SpatialSystem } from '../spatial-system';
import { recomputeVisibilityFromScratch } from '../visibility';
import { createEntity } from '../entities/entity-factory';
import type { TrinityStats } from '../combat/trinity-resolver';
import { computeScore } from '../score';
import { DEFAULT_LOADOUTS } from '../loadout';
import { computeSkillPowerProfileMap } from './balance-skill-power';
import { computeUnitPowerProfile } from './balance-unit-power';
import { simulateHarnessRunDetailed } from './harness-simulation';
import type { BotPolicy, RunResult } from './harness-types';
import { selectHarnessPlayerAction, resolvePending } from '../ai/player/selector';
import { getGenericAiGoalProfile } from '../ai/player/policy';
import type { GenericUnitAiSelectionSummary } from '../ai/generic-unit-ai';
import type { ReplayEnvelopeV3 } from '../replay-validation';
import { validateReplayEnvelopeV3 } from '../replay-validation';

export type DungeonLabActorSide = 'player' | 'enemy';
export type DungeonLabSpawnFillPolicy = 'fill_remaining_spawn_slots' | 'none';

export interface LabEntityDefinitionV1 {
    id: string;
    name: string;
    visualAssetRef?: string;
    trinity: TrinityStats;
    skillIds: string[];
}

export interface LabActorOverridesV1 {
    trinity?: TrinityStats;
    skillIds?: string[];
}

export interface LabPrefabTileEditV1 {
    dq: number;
    dr: number;
    baseId: TileID;
    effects?: TileEffectState[];
}

export interface LabPrefabActorPlacementV1 {
    id: string;
    entityId: string;
    side: DungeonLabActorSide;
    dq: number;
    dr: number;
    goal?: GenericAiGoal;
    subtypeRef?: string;
    overrides?: LabActorOverridesV1;
}

export interface LabPrefabDefinitionV1 {
    id: string;
    name: string;
    tileEdits: LabPrefabTileEditV1[];
    actorPlacements: LabPrefabActorPlacementV1[];
}

export interface LabFloorPrefabPlacementV1 {
    id: string;
    prefabId: string;
    anchor: Point;
}

export interface LabFloorActorPlacementV1 {
    id: string;
    entityId: string;
    side: DungeonLabActorSide;
    position: Point;
    goal?: GenericAiGoal;
    subtypeRef?: string;
    overrides?: LabActorOverridesV1;
}

export interface DungeonLabObjectiveOverridesV1 {
    stairsPosition?: Point;
    shrinePosition?: Point | null;
}

export interface LabFloorDefinitionV1 {
    id: string;
    name: string;
    seed: string;
    floor: number;
    biomeId?: string;
    themeId?: string;
    mapSize?: GridSize;
    mapShape?: MapShape;
    prefabPlacements: LabFloorPrefabPlacementV1[];
    looseActorPlacements: LabFloorActorPlacementV1[];
    objectiveOverrides?: DungeonLabObjectiveOverridesV1;
    spawnFillPolicy?: DungeonLabSpawnFillPolicy;
}

export interface DungeonLabLibraryBundleV1 {
    version: 'dungeon-lab-library-v1';
    entities: LabEntityDefinitionV1[];
    prefabs: LabPrefabDefinitionV1[];
    floors: LabFloorDefinitionV1[];
}

export interface DungeonLabSimulationSettingsV1 {
    policy: BotPolicy;
    policyProfileId?: string;
    goalBySide?: Partial<Record<DungeonLabActorSide, GenericAiGoal>>;
    batchCount: number;
    maxTurns: number;
    delayMs?: number;
    focusActorId?: string;
}

export interface DungeonLabActorReferenceV1 {
    sourceActorId: string;
    compiledActorId: string;
    entityId: string;
    side: DungeonLabActorSide;
    subtypeRef?: string;
}

export interface DungeonLabScenarioV1 {
    version: 'dungeon-lab-scenario-v1';
    floorId: string;
    floor: LabFloorDefinitionV1;
    entitiesById: Record<string, LabEntityDefinitionV1>;
    prefabsById: Record<string, LabPrefabDefinitionV1>;
    actorReferences: Record<string, DungeonLabActorReferenceV1>;
    simulation: DungeonLabSimulationSettingsV1;
}

export type DungeonLabIssueCode =
    | 'MISSING_ENTITY_REFERENCE'
    | 'MISSING_PREFAB_REFERENCE'
    | 'UNKNOWN_FLOOR'
    | 'UNKNOWN_SKILL'
    | 'FORBIDDEN_ENTITY_OVERRIDE'
    | 'OUT_OF_BOUNDS_TILE_EDIT'
    | 'OUT_OF_BOUNDS_ACTOR'
    | 'DUPLICATE_ACTOR_ID'
    | 'MAP_PATHING_ERROR';

export interface DungeonLabValidationIssueV1 {
    code: DungeonLabIssueCode;
    severity: 'warning' | 'error';
    message: string;
    context?: Record<string, unknown>;
}

export interface DungeonLabValidationResultV1 {
    valid: boolean;
    issues: DungeonLabValidationIssueV1[];
}

export type DungeonLabPreviewMarkerKindV1 =
    | 'missing_entity'
    | 'stairs_unreachable'
    | 'shrine_unreachable';

export interface DungeonLabPreviewMarkerV1 {
    kind: DungeonLabPreviewMarkerKindV1;
    severity: 'warning' | 'error';
    point: Point;
    label: string;
    actorId?: string;
    entityId?: string;
}

export interface DungeonLabEntityProjectionV1 {
    hp: number;
    maxHp: number;
    speed: number;
    damage: number;
    range: number;
    type: 'melee' | 'ranged' | 'boss';
    actionCooldown: number;
    powerBand: ReturnType<typeof computeUnitPowerProfile>['powerBand'];
    intrinsicPowerScore: number;
    rationale: string[];
}

export interface DungeonLabSkillSynergyWarningV1 {
    ailment: AilmentID;
    conflictsWith: AilmentID;
    sourceSkillIds: string[];
    message: string;
}

export interface DungeonLabEntityAnalysisV1 {
    entity: LabEntityDefinitionV1;
    projection: DungeonLabEntityProjectionV1;
    skillPowerSummaries: ReturnType<typeof computeSkillPowerProfileMap>[string][];
    synergyWarnings: DungeonLabSkillSynergyWarningV1[];
}

export interface DungeonLabCheckpointV1 {
    actionIndex: number;
    state: GameState;
    fingerprint: string;
}

export interface DungeonLabFocusedMetricsV1 {
    sourceActorId: string;
    compiledActorId: string;
    endedAlive: boolean;
    runResult: RunResult['result'];
    finalGameStatus: GameState['gameStatus'];
    survivalTurns: number;
    damageDealt: number;
    damageTaken: number;
    finalHp: number;
    maxHp: number;
}

export interface DungeonLabRunMetricsV1 {
    damageDealt: number;
    damageTaken: number;
    firstContactTurn: number;
    firstDamageTurn: number;
    focus?: DungeonLabFocusedMetricsV1;
}

export interface DungeonLabRunArtifactV1 {
    version: 'dungeon-lab-run-artifact-v1';
    scenario: DungeonLabScenarioV1;
    seed: string;
    initialState: GameState;
    finalState: GameState;
    run: RunResult;
    metrics: DungeonLabRunMetricsV1;
    actionLog: Action[];
    checkpoints: DungeonLabCheckpointV1[];
    finalFingerprint: string;
    replayEnvelope: ReplayEnvelopeV3;
    retainedReason?: 'single' | 'median' | 'majority_outlier' | 'extreme_survival';
}

export interface DungeonLabBatchRunSummaryV1 {
    seed: string;
    result: RunResult['result'];
    turnsSpent: number;
    finalFingerprint: string;
    damageDealt: number;
    damageTaken: number;
    survived: boolean;
    focus?: DungeonLabFocusedMetricsV1;
}

export interface DungeonLabBatchSummaryV1 {
    version: 'dungeon-lab-batch-v1';
    scenario: DungeonLabScenarioV1;
    games: number;
    winRate: number;
    timeoutRate: number;
    medianSurvivalTurns: number;
    p95DamageDealt: number;
    p95DamageTaken: number;
    avgFirstContactTurn: number;
    avgFirstDamageTurn: number;
    focusActorMetrics?: {
        sourceActorId: string;
        endedAliveRate: number;
        survivalRate: number;
        medianSurvivalTurns: number;
        p95DamageDealt: number;
        p95DamageTaken: number;
        resultCounts: Record<RunResult['result'], number>;
    };
    runs: DungeonLabBatchRunSummaryV1[];
    retainedArtifacts: DungeonLabRunArtifactV1[];
}

export interface DungeonLabPreviewOptionsV1 {
    allowEntityFallback?: boolean;
}

export interface DungeonLabPreviewInspectionV1 {
    state: GameState;
    issues: DungeonLabValidationIssueV1[];
    markers: DungeonLabPreviewMarkerV1[];
}

export interface DungeonLabBatchOptionsV1 {
    onProgress?: (completed: number, total: number) => void;
    checkpointInterval?: number;
}

export interface DungeonLabLiveStepV1 {
    actionIndex: number;
    actingSide: 'player' | 'system';
    action: Action;
    state: GameState;
    selectionSummary?: GenericUnitAiSelectionSummary;
}

const DUNGEON_LAB_LIBRARY_VERSION = 'dungeon-lab-library-v1' as const;
const DUNGEON_LAB_SCENARIO_VERSION = 'dungeon-lab-scenario-v1' as const;
const DUNGEON_LAB_RUN_ARTIFACT_VERSION = 'dungeon-lab-run-artifact-v1' as const;
const DUNGEON_LAB_BATCH_VERSION = 'dungeon-lab-batch-v1' as const;
const DUNGEON_LAB_DEFAULT_POLICY_PROFILE = 'sp-v1-default';
const DUNGEON_LAB_CHECKPOINT_INTERVAL = 25;
const DUNGEON_LAB_DEBUG_DUMMY_ENTITY_ID = '__debug_training_dummy__';
const DUNGEON_LAB_DEBUG_DUMMY_NAME = 'Debug Training Dummy';
const FORBIDDEN_ENTITY_OVERRIDE_KEYS = new Set([
    'hp',
    'maxHp',
    'damage',
    'range',
    'speed',
    'actionCooldown',
    'weightClass'
]);

const clonePoint = (point: Point): Point => ({
    q: point.q,
    r: point.r,
    s: point.s
});

const normalizePoint = (point: Point): Point => ({
    q: Math.round(Number(point.q || 0)),
    r: Math.round(Number(point.r || 0)),
    s: Math.round(Number(point.s ?? (-Number(point.q || 0) - Number(point.r || 0))))
});

const cloneTileEffects = (effects: TileEffectState[] | undefined): TileEffectState[] =>
    (effects || []).map(effect => ({
        ...effect,
        metadata: effect.metadata ? { ...effect.metadata } : undefined
    }));

const cloneTrinity = (trinity: TrinityStats): TrinityStats => ({
    body: Number(trinity.body || 0),
    instinct: Number(trinity.instinct || 0),
    mind: Number(trinity.mind || 0)
});

const cloneSkillIds = (skillIds: string[]): string[] =>
    [...skillIds];

const createTile = (baseId: TileID, position: Point, effects?: TileEffectState[]): Tile => ({
    baseId,
    position: clonePoint(position),
    traits: new Set(BASE_TILES[baseId].defaultTraits),
    effects: cloneTileEffects(effects)
});

const cloneSkill = (skill: Skill): Skill => ({
    ...skill,
    activeUpgrades: [...(skill.activeUpgrades || [])],
    upgrades: [...(skill.upgrades || [])]
});

const createRuntimeSkills = (skillIds: string[]): Skill[] =>
    skillIds
        .map(skillId => createActiveSkill(skillId))
        .filter((skill): skill is Skill => Boolean(skill))
        .map(cloneSkill);

const buildCombatSkillLoadout = (skillIds: string[]) => {
    const base: string[] = [];
    const passive: string[] = [];

    for (const skillId of skillIds) {
        const definition = SkillRegistry.get(skillId);
        if (!definition) continue;
        if (definition.slot === 'passive' || skillId === 'BASIC_MOVE' || skillId === 'AUTO_ATTACK') {
            passive.push(skillId);
            continue;
        }
        base.push(skillId);
    }

    return { base, passive };
};

const buildDefaultGoalMap = (
    goalBySide?: Partial<Record<DungeonLabActorSide, GenericAiGoal>>
): Record<DungeonLabActorSide, GenericAiGoal> => ({
    player: goalBySide?.player || 'explore',
    enemy: goalBySide?.enemy || 'engage'
});

const buildDebugTrainingDummyDefinition = (): LabEntityDefinitionV1 => ({
    id: DUNGEON_LAB_DEBUG_DUMMY_ENTITY_ID,
    name: DUNGEON_LAB_DEBUG_DUMMY_NAME,
    trinity: {
        body: 8,
        instinct: 8,
        mind: 8
    },
    skillIds: ['BASIC_MOVE', 'BASIC_ATTACK']
});

const percentile = (values: number[], ratio: number): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1));
    return sorted[index] || 0;
};

const median = (values: number[]): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 1) return sorted[middle] || 0;
    return ((sorted[middle - 1] || 0) + (sorted[middle] || 0)) / 2;
};

const average = (values: number[]): number =>
    values.length > 0
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : 0;

const buildReplayEnvelope = (
    initialState: GameState,
    actionLog: Action[],
    finalState: GameState
): ReplayEnvelopeV3 => {
    const envelope: ReplayEnvelopeV3 = {
        version: 3,
        run: {
            seed: initialState.rngSeed || initialState.initialSeed || 'dungeon-lab',
            initialSeed: initialState.initialSeed || initialState.rngSeed || 'dungeon-lab',
            loadoutId: initialState.player.archetype,
            startFloor: initialState.floor,
            mapSize: {
                width: initialState.gridWidth,
                height: initialState.gridHeight
            },
            mapShape: initialState.mapShape || 'diamond',
            mode: initialState.dailyRunDate ? 'daily' : 'normal',
            date: initialState.dailyRunDate,
            combatVersion: finalState.ruleset?.combat?.version
        },
        actions: [...actionLog],
        meta: {
            recordedAt: new Date().toISOString(),
            source: 'manual',
            diagnostics: {
                actionCount: actionLog.length,
                hasTurnAdvance: actionLog.some(action => action.type === 'ADVANCE_TURN'),
                hasPendingResolve: actionLog.some(action => action.type === 'RESOLVE_PENDING'),
                suspiciouslyShort: actionLog.length < 3
            },
            final: {
                score: finalState.completedRun?.score || finalState.kills || 0,
                floor: finalState.floor,
                fingerprint: fingerprintFromState(finalState),
                gameStatus: finalState.gameStatus === 'won' ? 'won' : 'lost'
            }
        }
    };

    const validation = validateReplayEnvelopeV3(envelope);
    if (!validation.valid || !validation.envelope) {
        throw new Error(`Dungeon Lab generated an invalid replay envelope: ${validation.errors.join(' | ')}`);
    }

    return validation.envelope;
};

const bfsReachable = (state: GameState, origin: Point, destination: Point): boolean => {
    const originKey = pointToKey(origin);
    const destinationKey = pointToKey(destination);
    if (originKey === destinationKey) return true;

    const visited = new Set<string>([originKey]);
    const queue: Point[] = [clonePoint(origin)];

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) continue;

        for (const neighbor of SpatialSystem.getNeighbors(current)) {
            if (!SpatialSystem.isWithinBounds(state, neighbor)) continue;
            const key = pointToKey(neighbor);
            if (visited.has(key)) continue;
            const tile = state.tiles.get(key);
            if (!tile) continue;
            if (key !== destinationKey && !tile.traits.has('WALKABLE')) continue;
            visited.add(key);
            if (key === destinationKey) return true;
            queue.push(clonePoint(neighbor));
        }
    }

    return false;
};

const copyBaseStateWithoutGeneratedRoster = (baseState: GameState): GameState => {
    const baseGoal = baseState.player.behaviorState?.goal;
    return {
        ...baseState,
        player: {
            ...baseState.player,
            behaviorState: {
                overlays: [...(baseState.player.behaviorState?.overlays || [])],
                anchorActorId: baseState.player.behaviorState?.anchorActorId,
                anchorPoint: baseState.player.behaviorState?.anchorPoint,
                goal: baseGoal
            }
        },
        enemies: [],
        actionLog: [],
        commandLog: [],
        undoStack: [],
        visualEvents: [],
        timelineEvents: [],
        simulationEvents: [],
        combatScoreEvents: [],
        intentPreview: undefined,
        visibility: undefined,
        initiativeQueue: undefined,
        message: []
    };
};

const ensureBehaviorGoal = (actor: Actor, goal: GenericAiGoal): Actor => ({
    ...actor,
    behaviorState: {
        overlays: [...(actor.behaviorState?.overlays || [])],
        anchorActorId: actor.behaviorState?.anchorActorId,
        anchorPoint: actor.behaviorState?.anchorPoint,
        goal
    }
});

const resolvePlayerArchetypeId = (entityDefinition: LabEntityDefinitionV1): string | undefined => {
    const candidateKeys = [
        String(entityDefinition.id || '').trim().toUpperCase(),
        String(entityDefinition.name || '').trim().replace(/\s+/g, '').toUpperCase()
    ].filter(Boolean);
    return candidateKeys.find(candidate => Boolean(DEFAULT_LOADOUTS[candidate]));
};

const resolveEntityProjection = (entity: LabEntityDefinitionV1): DungeonLabEntityProjectionV1 => {
    const derived = deriveEnemyBestiaryStats({
        trinity: entity.trinity,
        bestiarySkills: buildCombatSkillLoadout(entity.skillIds),
        runtimeSkills: buildCombatSkillLoadout(entity.skillIds),
        cost: 1,
        weightClass: 'Standard'
    });
    const skillProfilesById = computeSkillPowerProfileMap();
    const unitProfile = computeUnitPowerProfile({
        unitId: entity.id,
        unitKind: 'enemy',
        skillIds: entity.skillIds,
        trinity: entity.trinity,
        hp: derived.hp,
        maxHp: derived.maxHp,
        speed: derived.speed,
        weightClass: 'Standard',
        baseDamage: derived.damage,
        baseRange: derived.range,
        actionCooldown: derived.actionCooldown
    }, skillProfilesById);

    return {
        hp: derived.hp,
        maxHp: derived.maxHp,
        speed: derived.speed,
        damage: derived.damage,
        range: derived.range,
        type: derived.type,
        actionCooldown: derived.actionCooldown,
        powerBand: unitProfile.powerBand,
        intrinsicPowerScore: unitProfile.intrinsicPowerScore,
        rationale: [...unitProfile.rationale]
    };
};

const probeSkillAilmentEmissions = (() => {
    const cache = new Map<string, AilmentID[]>();
    let probeBaseState: GameState | null = null;

    const getBaseState = (): GameState => {
        if (probeBaseState) return probeBaseState;
        probeBaseState = generateInitialState(
            1,
            'dungeon-lab-ailment-probe',
            'dungeon-lab-ailment-probe',
            undefined,
            undefined,
            DEFAULT_START_RUN_MAP_SIZE,
            DEFAULT_START_RUN_MAP_SHAPE
        );
        return probeBaseState;
    };

    return (skillId: string): AilmentID[] => {
        if (cache.has(skillId)) return [...(cache.get(skillId) || [])];
        const definition = SkillRegistry.get(skillId);
        if (!definition) {
            cache.set(skillId, []);
            return [];
        }

        try {
            const baseState = getBaseState();
            const actor = createEntity({
                id: 'player',
                type: 'player',
                position: normalizePoint({ q: 4, r: 8, s: -12 }),
                speed: 1,
                factionId: 'player',
                activeSkills: createRuntimeSkills(['BASIC_MOVE', 'BASIC_ATTACK', skillId]),
                trinity: {
                    body: 12,
                    instinct: 12,
                    mind: 12
                },
                weightClass: 'Standard'
            });
            const targetEnemy = createEntity({
                id: 'probe_enemy',
                type: 'enemy',
                subtype: 'footman',
                position: normalizePoint({ q: 4, r: 7, s: -11 }),
                speed: 1,
                factionId: 'enemy',
                activeSkills: createRuntimeSkills(['BASIC_MOVE', 'BASIC_ATTACK']),
                trinity: {
                    body: 12,
                    instinct: 8,
                    mind: 4
                },
                weightClass: 'Standard'
            });
            const withActors = {
                ...baseState,
                player: actor,
                enemies: [targetEnemy]
            };
            const probeState = recomputeVisibilityFromScratch({
                ...withActors,
                occupancyMask: SpatialSystem.refreshOccupancyMask(withActors)
            });
            const target = definition.getValidTargets?.(probeState, actor.position)?.[0]
                || targetEnemy.position;
            const result = definition.execute(probeState, actor, target);
            const ailments = result.effects
                .flatMap(effect => {
                    if (effect.type === 'ApplyAilment') return [effect.ailment];
                    if (effect.type === 'DepositAilmentCounters') return [effect.ailment];
                    return [];
                })
                .filter((ailment): ailment is AilmentID => Boolean(ailment));
            const unique = Array.from(new Set(ailments)).sort();
            cache.set(skillId, unique);
            return [...unique];
        } catch {
            cache.set(skillId, []);
            return [];
        }
    };
})();

const buildEntitySynergyWarnings = (entity: LabEntityDefinitionV1): DungeonLabSkillSynergyWarningV1[] => {
    const ailmentToSkillIds = new Map<AilmentID, string[]>();

    for (const skillId of entity.skillIds) {
        const emitted = probeSkillAilmentEmissions(skillId);
        for (const ailment of emitted) {
            const existing = ailmentToSkillIds.get(ailment) || [];
            ailmentToSkillIds.set(ailment, [...existing, skillId]);
        }
    }

    const warnings: DungeonLabSkillSynergyWarningV1[] = [];
    for (const [ailment, sourceSkillIds] of ailmentToSkillIds.entries()) {
        const definition = getAilmentDefinition(ailment);
        for (const interaction of definition?.interactions || []) {
            const opposingSkillIds = ailmentToSkillIds.get(interaction.target) || [];
            if (opposingSkillIds.length === 0) continue;
            warnings.push({
                ailment,
                conflictsWith: interaction.target,
                sourceSkillIds: [...new Set([...sourceSkillIds, ...opposingSkillIds])].sort(),
                message: `${ailment} annihilates against ${interaction.target} under ACAE.`
            });
        }
    }

    return warnings.sort((left, right) =>
        left.ailment.localeCompare(right.ailment)
        || left.conflictsWith.localeCompare(right.conflictsWith)
    );
};

export const analyzeDungeonLabEntity = (entity: LabEntityDefinitionV1): DungeonLabEntityAnalysisV1 => {
    const projection = resolveEntityProjection(entity);
    const skillProfilesById = computeSkillPowerProfileMap();
    const skillPowerSummaries = entity.skillIds
        .map(skillId => skillProfilesById[skillId])
        .filter((profile): profile is ReturnType<typeof computeSkillPowerProfileMap>[string] => Boolean(profile))
        .sort((left, right) =>
            right.intrinsicPowerScore - left.intrinsicPowerScore
            || left.skillId.localeCompare(right.skillId)
        );

    return {
        entity,
        projection,
        skillPowerSummaries,
        synergyWarnings: buildEntitySynergyWarnings(entity)
    };
};

const buildEntityMaps = (
    bundle: DungeonLabLibraryBundleV1
): {
    entitiesById: Record<string, LabEntityDefinitionV1>;
    prefabsById: Record<string, LabPrefabDefinitionV1>;
    floorsById: Record<string, LabFloorDefinitionV1>;
} => ({
    entitiesById: Object.fromEntries(bundle.entities.map(entity => [entity.id, entity])),
    prefabsById: Object.fromEntries(bundle.prefabs.map(prefab => [prefab.id, prefab])),
    floorsById: Object.fromEntries(bundle.floors.map(floor => [floor.id, floor]))
});

const validateEntityDefinition = (
    entity: LabEntityDefinitionV1,
    issues: DungeonLabValidationIssueV1[]
): void => {
    const candidate = entity as unknown as Record<string, unknown>;
    for (const key of FORBIDDEN_ENTITY_OVERRIDE_KEYS) {
        if (key in candidate) {
            issues.push({
                code: 'FORBIDDEN_ENTITY_OVERRIDE',
                severity: 'error',
                message: `Entity "${entity.id}" may not author "${key}". Combat stats are derived.`,
                context: { entityId: entity.id, key }
            });
        }
    }

    for (const skillId of entity.skillIds || []) {
        if (!SkillRegistry.get(skillId)) {
            issues.push({
                code: 'UNKNOWN_SKILL',
                severity: 'error',
                message: `Entity "${entity.id}" references unknown skill "${skillId}".`,
                context: { entityId: entity.id, skillId }
            });
        }
    }
};

const validateActorOverrides = (
    actorId: string,
    overrides: LabActorOverridesV1 | undefined,
    issues: DungeonLabValidationIssueV1[]
): void => {
    if (!overrides) return;
    const candidate = overrides as unknown as Record<string, unknown>;
    for (const key of FORBIDDEN_ENTITY_OVERRIDE_KEYS) {
        if (key in candidate) {
            issues.push({
                code: 'FORBIDDEN_ENTITY_OVERRIDE',
                severity: 'error',
                message: `Actor override "${actorId}" may not author "${key}". Combat stats are derived.`,
                context: { actorId, key }
            });
        }
    }

    for (const skillId of overrides.skillIds || []) {
        if (!SkillRegistry.get(skillId)) {
            issues.push({
                code: 'UNKNOWN_SKILL',
                severity: 'error',
                message: `Actor override "${actorId}" references unknown skill "${skillId}".`,
                context: { actorId, skillId }
            });
        }
    }
};

const validateScenarioReferences = (
    scenario: DungeonLabScenarioV1,
    options: DungeonLabPreviewOptionsV1 = {}
): DungeonLabValidationIssueV1[] => {
    const issues: DungeonLabValidationIssueV1[] = [];
    const mapConfig = resolveStartRunMapConfig(scenario.floor.mapSize, scenario.floor.mapShape);
    const previewAllowsEntityFallback = options.allowEntityFallback === true;

    for (const entity of Object.values(scenario.entitiesById)) {
        if (entity.id === DUNGEON_LAB_DEBUG_DUMMY_ENTITY_ID) continue;
        validateEntityDefinition(entity, issues);
    }

    const seenActorIds = new Set<string>();
    for (const placement of scenario.floor.looseActorPlacements) {
        if (!scenario.entitiesById[placement.entityId]) {
            issues.push({
                code: 'MISSING_ENTITY_REFERENCE',
                severity: previewAllowsEntityFallback ? 'warning' : 'error',
                message: `Loose actor "${placement.id}" references missing entity "${placement.entityId}".`,
                context: { placementId: placement.id, entityId: placement.entityId }
            });
        }
        if (seenActorIds.has(placement.id)) {
            issues.push({
                code: 'DUPLICATE_ACTOR_ID',
                severity: 'error',
                message: `Duplicate loose actor id "${placement.id}".`,
                context: { actorId: placement.id }
            });
        }
        seenActorIds.add(placement.id);
        if (placement.position.q < 0 || placement.position.r < 0 || placement.position.q >= mapConfig.width || placement.position.r >= mapConfig.height) {
            issues.push({
                code: 'OUT_OF_BOUNDS_ACTOR',
                severity: 'error',
                message: `Loose actor "${placement.id}" is out of bounds.`,
                context: { actorId: placement.id, position: placement.position }
            });
        }
        validateActorOverrides(placement.id, placement.overrides, issues);
    }

    for (const prefabPlacement of scenario.floor.prefabPlacements) {
        const prefab = scenario.prefabsById[prefabPlacement.prefabId];
        if (!prefab) {
            issues.push({
                code: 'MISSING_PREFAB_REFERENCE',
                severity: 'error',
                message: `Floor placement "${prefabPlacement.id}" references missing prefab "${prefabPlacement.prefabId}".`,
                context: { placementId: prefabPlacement.id, prefabId: prefabPlacement.prefabId }
            });
            continue;
        }

        for (const tileEdit of prefab.tileEdits) {
            const point = normalizePoint({
                q: prefabPlacement.anchor.q + tileEdit.dq,
                r: prefabPlacement.anchor.r + tileEdit.dr,
                s: 0
            });
            if (point.q < 0 || point.r < 0 || point.q >= mapConfig.width || point.r >= mapConfig.height) {
                issues.push({
                    code: 'OUT_OF_BOUNDS_TILE_EDIT',
                    severity: 'error',
                    message: `Prefab "${prefab.id}" stamps a tile out of bounds at "${point.q},${point.r}".`,
                    context: { prefabPlacementId: prefabPlacement.id, prefabId: prefab.id, point }
                });
            }
        }

        for (const actorPlacement of prefab.actorPlacements) {
            const sourceActorId = `${prefabPlacement.id}/${actorPlacement.id}`;
            if (!scenario.entitiesById[actorPlacement.entityId]) {
                issues.push({
                    code: 'MISSING_ENTITY_REFERENCE',
                    severity: previewAllowsEntityFallback ? 'warning' : 'error',
                    message: `Prefab actor "${sourceActorId}" references missing entity "${actorPlacement.entityId}".`,
                    context: { sourceActorId, entityId: actorPlacement.entityId }
                });
            }
            if (seenActorIds.has(sourceActorId)) {
                issues.push({
                    code: 'DUPLICATE_ACTOR_ID',
                    severity: 'error',
                    message: `Duplicate prefab actor id "${sourceActorId}".`,
                    context: { actorId: sourceActorId }
                });
            }
            seenActorIds.add(sourceActorId);
            const point = normalizePoint({
                q: prefabPlacement.anchor.q + actorPlacement.dq,
                r: prefabPlacement.anchor.r + actorPlacement.dr,
                s: 0
            });
            if (point.q < 0 || point.r < 0 || point.q >= mapConfig.width || point.r >= mapConfig.height) {
                issues.push({
                    code: 'OUT_OF_BOUNDS_ACTOR',
                    severity: 'error',
                    message: `Prefab actor "${sourceActorId}" is out of bounds.`,
                    context: { actorId: sourceActorId, position: point }
                });
            }
            validateActorOverrides(sourceActorId, actorPlacement.overrides, issues);
        }
    }

    return issues;
};

const resolveMissingEntityIssuePoint = (
    scenario: DungeonLabScenarioV1,
    issue: DungeonLabValidationIssueV1
): Point | null => {
    const placementId = typeof issue.context?.placementId === 'string'
        ? issue.context.placementId
        : typeof issue.context?.sourceActorId === 'string'
            ? issue.context.sourceActorId
            : null;
    if (!placementId) return null;

    const looseActor = scenario.floor.looseActorPlacements.find(placement => placement.id === placementId);
    if (looseActor) return normalizePoint(looseActor.position);

    const [prefabPlacementId, actorPlacementId] = placementId.split('/', 2);
    if (!prefabPlacementId || !actorPlacementId) return null;
    const floorPlacement = scenario.floor.prefabPlacements.find(placement => placement.id === prefabPlacementId);
    if (!floorPlacement) return null;
    const prefab = scenario.prefabsById[floorPlacement.prefabId];
    const actorPlacement = prefab?.actorPlacements.find(placement => placement.id === actorPlacementId);
    if (!actorPlacement) return null;
    return normalizePoint({
        q: floorPlacement.anchor.q + actorPlacement.dq,
        r: floorPlacement.anchor.r + actorPlacement.dr,
        s: 0
    });
};

const buildPreviewMarkersFromIssues = (
    scenario: DungeonLabScenarioV1,
    issues: DungeonLabValidationIssueV1[],
    state: GameState
): DungeonLabPreviewMarkerV1[] => {
    const markers: DungeonLabPreviewMarkerV1[] = [];

    for (const issue of issues) {
        if (issue.code === 'MISSING_ENTITY_REFERENCE') {
            const point = resolveMissingEntityIssuePoint(scenario, issue);
            if (!point) continue;
            markers.push({
                kind: 'missing_entity',
                severity: issue.severity,
                point,
                label: issue.message,
                actorId: typeof issue.context?.placementId === 'string'
                    ? issue.context.placementId
                    : typeof issue.context?.sourceActorId === 'string'
                        ? issue.context.sourceActorId
                        : undefined,
                entityId: typeof issue.context?.entityId === 'string' ? issue.context.entityId : undefined
            });
            continue;
        }

        if (issue.code === 'MAP_PATHING_ERROR') {
            const target = typeof issue.context?.stairs === 'object' && issue.context?.stairs
                ? issue.context.stairs as Point
                : typeof issue.context?.shrine === 'object' && issue.context?.shrine
                    ? issue.context.shrine as Point
                    : null;
            if (!target) continue;
            markers.push({
                kind: issue.message.includes('shrine') ? 'shrine_unreachable' : 'stairs_unreachable',
                severity: issue.severity,
                point: normalizePoint(target),
                label: issue.message
            });
        }
    }

    if (markers.length === 0 && state.player.position && state.stairsPosition) {
        return markers;
    }

    return markers;
};

export const validateDungeonLabLibraryBundle = (
    bundle: DungeonLabLibraryBundleV1
): DungeonLabValidationResultV1 => {
    const issues: DungeonLabValidationIssueV1[] = [];

    if (bundle.version !== DUNGEON_LAB_LIBRARY_VERSION) {
        issues.push({
            code: 'UNKNOWN_FLOOR',
            severity: 'error',
            message: `Unsupported Dungeon Lab bundle version "${String(bundle.version)}".`
        });
    }

    const { entitiesById, prefabsById, floorsById } = buildEntityMaps(bundle);
    for (const entity of bundle.entities) {
        validateEntityDefinition(entity, issues);
    }
    for (const floor of bundle.floors) {
        const scenario: DungeonLabScenarioV1 = {
            version: DUNGEON_LAB_SCENARIO_VERSION,
            floorId: floor.id,
            floor,
            entitiesById,
            prefabsById,
            actorReferences: {},
            simulation: {
                policy: 'heuristic',
                batchCount: 1,
                maxTurns: 40,
                goalBySide: buildDefaultGoalMap()
            }
        };
        issues.push(...validateScenarioReferences(scenario));
    }

    for (const floor of bundle.floors) {
        if (!floorsById[floor.id]) {
            issues.push({
                code: 'UNKNOWN_FLOOR',
                severity: 'error',
                message: `Unknown floor "${floor.id}".`
            });
        }
    }

    return {
        valid: !issues.some(issue => issue.severity === 'error'),
        issues
    };
};

export const compileDungeonLabScenario = (
    bundle: DungeonLabLibraryBundleV1,
    floorId: string,
    simulation: Partial<DungeonLabSimulationSettingsV1> = {}
): DungeonLabScenarioV1 => {
    const { entitiesById, prefabsById, floorsById } = buildEntityMaps(bundle);
    const floor = floorsById[floorId];
    if (!floor) {
        throw new Error(`Unknown Dungeon Lab floor "${floorId}".`);
    }

    const actorReferences: Record<string, DungeonLabActorReferenceV1> = {};
    let sawPrimaryPlayer = false;

    for (const placement of floor.looseActorPlacements) {
        const compiledActorId = !sawPrimaryPlayer && placement.side === 'player'
            ? 'player'
            : placement.id;
        if (placement.side === 'player' && !sawPrimaryPlayer) {
            sawPrimaryPlayer = true;
        }
        actorReferences[placement.id] = {
            sourceActorId: placement.id,
            compiledActorId,
            entityId: placement.entityId,
            side: placement.side,
            subtypeRef: placement.subtypeRef
        };
    }

    for (const prefabPlacement of floor.prefabPlacements) {
        const prefab = prefabsById[prefabPlacement.prefabId];
        if (!prefab) continue;
        for (const actorPlacement of prefab.actorPlacements) {
            const sourceActorId = `${prefabPlacement.id}/${actorPlacement.id}`;
            const compiledActorId = !sawPrimaryPlayer && actorPlacement.side === 'player'
                ? 'player'
                : sourceActorId;
            if (actorPlacement.side === 'player' && !sawPrimaryPlayer) {
                sawPrimaryPlayer = true;
            }
            actorReferences[sourceActorId] = {
                sourceActorId,
                compiledActorId,
                entityId: actorPlacement.entityId,
                side: actorPlacement.side,
                subtypeRef: actorPlacement.subtypeRef
            };
        }
    }

    return {
        version: DUNGEON_LAB_SCENARIO_VERSION,
        floorId,
        floor,
        entitiesById: {
            ...entitiesById,
            [DUNGEON_LAB_DEBUG_DUMMY_ENTITY_ID]: buildDebugTrainingDummyDefinition()
        },
        prefabsById,
        actorReferences,
        simulation: {
            policy: simulation.policy || 'heuristic',
            policyProfileId: simulation.policyProfileId || DUNGEON_LAB_DEFAULT_POLICY_PROFILE,
            goalBySide: buildDefaultGoalMap(simulation.goalBySide),
            batchCount: Math.max(1, Number(simulation.batchCount || 1)),
            maxTurns: Math.max(1, Number(simulation.maxTurns || 60)),
            ...(simulation.delayMs !== undefined ? { delayMs: Math.max(0, Number(simulation.delayMs || 0)) } : {}),
            ...(simulation.focusActorId ? { focusActorId: simulation.focusActorId } : {})
        }
    };
};

const resolveEntityForPlacement = (
    scenario: DungeonLabScenarioV1,
    entityId: string,
    allowFallback: boolean
): LabEntityDefinitionV1 => {
    const entity = scenario.entitiesById[entityId];
    if (entity) return entity;
    if (!allowFallback) {
        throw new Error(`Dungeon Lab placement references missing entity "${entityId}".`);
    }
    return scenario.entitiesById[DUNGEON_LAB_DEBUG_DUMMY_ENTITY_ID];
};

const resolveEntityDefinitionForPlacement = (
    scenario: DungeonLabScenarioV1,
    entityId: string,
    overrides: LabActorOverridesV1 | undefined,
    allowFallback: boolean
): LabEntityDefinitionV1 => {
    const base = resolveEntityForPlacement(scenario, entityId, allowFallback);
    return {
        ...base,
        trinity: overrides?.trinity ? cloneTrinity(overrides.trinity) : cloneTrinity(base.trinity),
        skillIds: overrides?.skillIds !== undefined ? cloneSkillIds(overrides.skillIds) : cloneSkillIds(base.skillIds)
    };
};

const createAuthoredActor = ({
    scenario,
    sourceActorId,
    compiledActorId,
    entityDefinition,
    side,
    point,
    goal,
    subtypeRef
}: {
    scenario: DungeonLabScenarioV1;
    sourceActorId: string;
    compiledActorId: string;
    entityDefinition: LabEntityDefinitionV1;
    side: DungeonLabActorSide;
    point: Point;
    goal?: GenericAiGoal;
    subtypeRef?: string;
}): Actor => {
    const subtypeContent = subtypeRef
        ? (MVP_ENEMY_CONTENT as Record<string, (typeof MVP_ENEMY_CONTENT)[keyof typeof MVP_ENEMY_CONTENT]>)[subtypeRef]
        : undefined;
    const derived = deriveEnemyBestiaryStats({
        trinity: entityDefinition.trinity,
        bestiarySkills: buildCombatSkillLoadout(entityDefinition.skillIds),
        runtimeSkills: buildCombatSkillLoadout(entityDefinition.skillIds),
        cost: subtypeContent?.bestiary.stats.cost || 1,
        weightClass: subtypeContent?.bestiary.stats.weightClass || 'Standard'
    });
    const runtimeSkills = createRuntimeSkills(entityDefinition.skillIds);
    const resolvedGoal = goal || scenario.simulation.goalBySide?.[side] || (side === 'player' ? 'explore' : 'engage');
    const actorType = compiledActorId === 'player' ? 'player' : 'enemy';
    const inferredArchetype = actorType === 'player' ? resolvePlayerArchetypeId(entityDefinition) : undefined;
      const actor = createEntity({
          id: compiledActorId,
          type: actorType,
          subtype: subtypeRef,
          visualAssetRef: entityDefinition.visualAssetRef,
          position: point,
          hp: derived.hp,
        maxHp: derived.maxHp,
        speed: derived.speed,
        factionId: side === 'enemy' ? 'enemy' : 'player',
        activeSkills: runtimeSkills,
        trinity: entityDefinition.trinity,
        weightClass: (subtypeContent?.bestiary.stats.weightClass || 'Standard') as WeightClass,
        ...(inferredArchetype ? { archetype: inferredArchetype } : {})
    });

    return {
        ...ensureBehaviorGoal({
            ...actor,
            previousPosition: clonePoint(point),
            actionCooldown: derived.actionCooldown,
            enemyType: derived.type,
            subtype: subtypeRef || sourceActorId
        }, resolvedGoal),
        statusEffects: [...(actor.statusEffects || [])],
        activeSkills: runtimeSkills
    };
};

const applyTileEdit = (
    state: GameState,
    point: Point,
    baseId: TileID,
    effects?: TileEffectState[]
): GameState => {
    const key = pointToKey(point);
    const nextTiles = new Map(state.tiles);
    nextTiles.set(key, createTile(baseId, point, effects));
    return {
        ...state,
        tiles: nextTiles
    };
};

const finalizeDungeonLabStateInternal = (state: GameState): GameState => {
    const withPositions = {
        ...state,
        player: {
            ...state.player,
            previousPosition: clonePoint(state.player.position)
        },
        enemies: state.enemies.map(enemy => ({
            ...enemy,
            previousPosition: clonePoint(enemy.position)
        })),
        actionLog: [],
        commandLog: [],
        undoStack: [],
        visualEvents: [],
        timelineEvents: [],
        simulationEvents: [],
        combatScoreEvents: [],
        intentPreview: undefined,
        message: []
    };
    const withQueue = {
        ...withPositions,
        occupancyMask: SpatialSystem.refreshOccupancyMask(withPositions),
        initiativeQueue: buildInitiativeQueue(withPositions)
    };
    return recomputeVisibilityFromScratch(withQueue);
};

const collectDungeonLabPathingIssues = (
    scenario: DungeonLabScenarioV1,
    finalized: GameState
): DungeonLabValidationIssueV1[] => {
    const reachabilityFailures: DungeonLabValidationIssueV1[] = [];

    if (!bfsReachable(finalized, finalized.player.position, finalized.stairsPosition)) {
        reachabilityFailures.push({
            code: 'MAP_PATHING_ERROR',
            severity: 'error',
            message: 'Map Pathing Error: player cannot reach the stairs from the current start.',
            context: {
                player: finalized.player.position,
                stairs: finalized.stairsPosition,
                floorId: scenario.floorId
            }
        });
    }
    if (finalized.shrinePosition && !bfsReachable(finalized, finalized.player.position, finalized.shrinePosition)) {
        reachabilityFailures.push({
            code: 'MAP_PATHING_ERROR',
            severity: 'error',
            message: 'Map Pathing Error: player cannot reach the shrine from the current start.',
            context: {
                player: finalized.player.position,
                shrine: finalized.shrinePosition,
                floorId: scenario.floorId
            }
        });
    }

    return reachabilityFailures;
};

export const buildDungeonLabBaseFloor = (
    scenario: DungeonLabScenarioV1,
    seedOverride?: string
): GameState => {
    const resolvedMap = resolveStartRunMapConfig(scenario.floor.mapSize, scenario.floor.mapShape);
    const seed = seedOverride || scenario.floor.seed;
    return generateInitialState(
        scenario.floor.floor,
        seed,
        seed,
        undefined,
        undefined,
        resolvedMap,
        resolvedMap.mapShape
    );
};

export const buildDungeonLabBaseState = (
    scenario: DungeonLabScenarioV1,
    seedOverride?: string
): GameState =>
    copyBaseStateWithoutGeneratedRoster(buildDungeonLabBaseFloor(scenario, seedOverride));

export const applyDungeonLabOverlay = (
    scenario: DungeonLabScenarioV1,
    baseState: GameState,
    options: DungeonLabPreviewOptionsV1 = {}
): GameState => {
    const allowFallback = options.allowEntityFallback === true;
    const issues = validateScenarioReferences(scenario, options);
    const blocking = issues.filter(issue => issue.severity === 'error');
    if (blocking.length > 0) {
        throw new Error(blocking.map(issue => issue.message).join(' | '));
    }

    const generatedFillCandidates = baseState.enemies.map(enemy => ({
        ...enemy,
        position: clonePoint(enemy.position),
        previousPosition: clonePoint(enemy.position)
    }));

    let state = copyBaseStateWithoutGeneratedRoster(baseState);

    for (const prefabPlacement of scenario.floor.prefabPlacements) {
        const prefab = scenario.prefabsById[prefabPlacement.prefabId];
        if (!prefab) continue;
        for (const tileEdit of prefab.tileEdits) {
            const target = normalizePoint({
                q: prefabPlacement.anchor.q + tileEdit.dq,
                r: prefabPlacement.anchor.r + tileEdit.dr,
                s: 0
            });
            state = applyTileEdit(state, target, tileEdit.baseId, tileEdit.effects);
        }
    }

    const authoredActors: Actor[] = [];
    let authoredPlayer: Actor | null = null;
    const occupiedKeys = new Set<string>();

    const adoptActor = (actor: Actor): void => {
        occupiedKeys.add(pointToKey(actor.position));
        if (actor.id === 'player' && !authoredPlayer) {
            authoredPlayer = actor;
            return;
        }
        authoredActors.push(actor);
    };

    for (const prefabPlacement of scenario.floor.prefabPlacements) {
        const prefab = scenario.prefabsById[prefabPlacement.prefabId];
        if (!prefab) continue;
        for (const actorPlacement of prefab.actorPlacements) {
            const sourceActorId = `${prefabPlacement.id}/${actorPlacement.id}`;
            const reference = scenario.actorReferences[sourceActorId];
            const point = normalizePoint({
                q: prefabPlacement.anchor.q + actorPlacement.dq,
                r: prefabPlacement.anchor.r + actorPlacement.dr,
                s: 0
            });
            const entity = resolveEntityDefinitionForPlacement(
                scenario,
                actorPlacement.entityId,
                actorPlacement.overrides,
                allowFallback
            );
            adoptActor(createAuthoredActor({
                scenario,
                sourceActorId,
                compiledActorId: reference?.compiledActorId || sourceActorId,
                entityDefinition: entity,
                side: actorPlacement.side,
                point,
                goal: actorPlacement.goal,
                subtypeRef: actorPlacement.subtypeRef
            }));
        }
    }

    for (const looseActor of scenario.floor.looseActorPlacements) {
        const reference = scenario.actorReferences[looseActor.id];
        const entity = resolveEntityDefinitionForPlacement(
            scenario,
            looseActor.entityId,
            looseActor.overrides,
            allowFallback
        );
        adoptActor(createAuthoredActor({
            scenario,
            sourceActorId: looseActor.id,
            compiledActorId: reference?.compiledActorId || looseActor.id,
            entityDefinition: entity,
            side: looseActor.side,
            point: normalizePoint(looseActor.position),
            goal: looseActor.goal,
            subtypeRef: looseActor.subtypeRef
        }));
    }

    const playerGoal = scenario.simulation.goalBySide?.player || 'explore';
    state = {
        ...state,
        player: authoredPlayer
            ? authoredPlayer
            : ensureBehaviorGoal({
                ...state.player,
                previousPosition: clonePoint(state.player.position)
            }, playerGoal),
        enemies: authoredActors
    };

    if (scenario.floor.objectiveOverrides?.stairsPosition) {
        state = {
            ...state,
            stairsPosition: normalizePoint(scenario.floor.objectiveOverrides.stairsPosition)
        };
    }
    if (scenario.floor.objectiveOverrides?.shrinePosition !== undefined) {
        state = {
            ...state,
            shrinePosition: scenario.floor.objectiveOverrides.shrinePosition === null
                ? undefined
                : normalizePoint(scenario.floor.objectiveOverrides.shrinePosition)
        };
    }

    if ((scenario.floor.spawnFillPolicy || 'fill_remaining_spawn_slots') === 'fill_remaining_spawn_slots') {
        const filledActors: Actor[] = [...state.enemies];
        for (const candidate of generatedFillCandidates) {
            const key = pointToKey(candidate.position);
            const tile = state.tiles.get(key);
            if (!tile?.traits.has('WALKABLE')) continue;
            if (occupiedKeys.has(key)) continue;
            if (!bfsReachable(state, state.player.position, candidate.position)) continue;
            filledActors.push(candidate);
            occupiedKeys.add(key);
        }
        state = {
            ...state,
            enemies: filledActors
        };
    }

    return state;
};

export const finalizeDungeonLabState = (
    scenario: DungeonLabScenarioV1,
    state: GameState
): GameState => {
    const finalized = finalizeDungeonLabStateInternal(state);
    const reachabilityFailures = collectDungeonLabPathingIssues(scenario, finalized);
    if (reachabilityFailures.length > 0) {
        throw new Error(reachabilityFailures.map(issue => issue.message).join(' | '));
    }

    return finalized;
};

export const inspectDungeonLabPreview = (
    scenario: DungeonLabScenarioV1,
    options: DungeonLabPreviewOptionsV1 = {},
    seedOverride?: string
): DungeonLabPreviewInspectionV1 => {
    const issues = validateScenarioReferences(scenario, options);
    const blockingIssues = issues.filter(issue => issue.severity === 'error');
    if (blockingIssues.length > 0) {
        throw new Error(blockingIssues.map(issue => issue.message).join(' | '));
    }

    const baseState = buildDungeonLabBaseFloor(scenario, seedOverride);
    const overlaid = applyDungeonLabOverlay(scenario, baseState, options);
    const finalized = finalizeDungeonLabStateInternal(overlaid);
    const pathingIssues = collectDungeonLabPathingIssues(scenario, finalized);
    const combinedIssues = [...issues, ...pathingIssues];

    return {
        state: finalized,
        issues: combinedIssues,
        markers: buildPreviewMarkersFromIssues(scenario, combinedIssues, finalized)
    };
};

export const compileDungeonLabState = (
    scenario: DungeonLabScenarioV1,
    options: DungeonLabPreviewOptionsV1 = {},
    seedOverride?: string
): GameState => {
    const preview = inspectDungeonLabPreview(scenario, options, seedOverride);
    const blockingIssues = preview.issues.filter(issue => issue.severity === 'error');
    if (blockingIssues.length > 0) {
        throw new Error(blockingIssues.map(issue => issue.message).join(' | '));
    }
    return preview.state;
};

const resolveFocusActorRuntimeId = (
    scenario: DungeonLabScenarioV1
): { sourceActorId: string; compiledActorId: string } | null => {
    if (!scenario.simulation.focusActorId) return null;
    const reference = scenario.actorReferences[scenario.simulation.focusActorId];
    if (!reference) return null;
    return {
        sourceActorId: reference.sourceActorId,
        compiledActorId: reference.compiledActorId
    };
};

const replayActionLogWithCheckpoints = (
    initialState: GameState,
    actionLog: Action[],
    checkpointInterval = DUNGEON_LAB_CHECKPOINT_INTERVAL,
    focusActorId?: string
): {
    finalState: GameState;
    checkpoints: DungeonLabCheckpointV1[];
    focusSurvivalTurns: number;
    playerDamage: { damageDealt: number; damageTaken: number };
    focusDamage?: { damageDealt: number; damageTaken: number };
    focusMaxHp: number;
} => {
    const hydrated = hydrateLoadedState(initialState);
    const checkpoints: DungeonLabCheckpointV1[] = [{
        actionIndex: 0,
        state: hydrateLoadedState(initialState),
        fingerprint: fingerprintFromState(initialState)
    }];
    let current = hydrated;
    let focusSurvivalTurns = current.turnsSpent || 0;
    let focusAlive = !focusActorId || current.player.id === focusActorId || current.enemies.some(enemy => enemy.id === focusActorId && enemy.hp > 0);
    let playerDamageDealt = 0;
    let playerDamageTaken = 0;
    let focusDamageDealt = 0;
    let focusDamageTaken = 0;
    let previousSimulationEventCount = current.simulationEvents?.length || 0;
    const initialFocusActor = focusActorId
        ? (current.player.id === focusActorId
            ? current.player
            : current.enemies.find(enemy => enemy.id === focusActorId))
        : null;
    const focusMaxHp = initialFocusActor?.maxHp || 0;

    actionLog.forEach((action, index) => {
        current = resolvePending(gameReducer(current, action));
        const simulationEvents = current.simulationEvents || [];
        const stepEvents = simulationEvents.slice(previousSimulationEventCount);
        previousSimulationEventCount = simulationEvents.length;
        const stepPlayerDamage = computeDamageMetricsFromEvents(stepEvents, current.player.id);
        playerDamageDealt += stepPlayerDamage.damageDealt;
        playerDamageTaken += stepPlayerDamage.damageTaken;
        if (focusActorId) {
            const stepFocusDamage = computeDamageMetricsFromEvents(stepEvents, focusActorId);
            focusDamageDealt += stepFocusDamage.damageDealt;
            focusDamageTaken += stepFocusDamage.damageTaken;
        }
        if (focusActorId && focusAlive) {
            const focusActor = current.player.id === focusActorId
                ? current.player
                : current.enemies.find(enemy => enemy.id === focusActorId);
            if (!focusActor || focusActor.hp <= 0) {
                focusAlive = false;
                focusSurvivalTurns = current.turnsSpent || focusSurvivalTurns;
            }
        }
        const actionIndex = index + 1;
        if (actionIndex % checkpointInterval === 0 || actionIndex === actionLog.length) {
            checkpoints.push({
                actionIndex,
                state: hydrateLoadedState(current),
                fingerprint: fingerprintFromState(current)
            });
        }
    });

    if (focusActorId && focusAlive) {
        focusSurvivalTurns = current.turnsSpent || focusSurvivalTurns;
    }

    return {
        finalState: current,
        checkpoints,
        focusSurvivalTurns,
        playerDamage: {
            damageDealt: playerDamageDealt,
            damageTaken: playerDamageTaken
        },
        ...(focusActorId
            ? {
                focusDamage: {
                    damageDealt: focusDamageDealt,
                    damageTaken: focusDamageTaken
                }
            }
            : {}),
        focusMaxHp
    };
};

export const materializeDungeonLabArtifactState = (
    artifact: Pick<DungeonLabRunArtifactV1, 'checkpoints' | 'actionLog'>,
    actionIndex: number
): GameState => {
    const clampedActionIndex = Math.max(0, Math.min(Math.round(actionIndex), artifact.actionLog.length));
    const checkpoint = [...artifact.checkpoints]
        .sort((left, right) => left.actionIndex - right.actionIndex)
        .filter(candidate => candidate.actionIndex <= clampedActionIndex)
        .pop() || artifact.checkpoints[0];

    let state = hydrateLoadedState(checkpoint.state);
    for (let index = checkpoint.actionIndex; index < clampedActionIndex; index += 1) {
        const action = artifact.actionLog[index];
        if (!action) break;
        state = resolvePending(gameReducer(state, action));
    }
    return state;
};

const computeDamageMetricsFromEvents = (
    events: GameState['simulationEvents'],
    relevantActorId: string
): { damageDealt: number; damageTaken: number } => {
    let damageDealt = 0;
    let damageTaken = 0;

    for (const event of events || []) {
        if (event.type !== 'DamageTaken') continue;
        const amount = Number(event.payload?.amount || 0);
        const sourceId = String(event.payload?.sourceId || '');
        const targetId = String(event.targetId || '');
        if (targetId === relevantActorId) {
            damageTaken += amount;
        }
        if (sourceId === relevantActorId) {
            damageDealt += amount;
        }
    }

    return { damageDealt, damageTaken };
};

const resolveDungeonLabRunResult = (
    run: RunResult,
    finalState: GameState,
    maxTurns: number
): RunResult => {
    const aliveHostiles = finalState.enemies.filter(
        enemy => enemy.hp > 0 && enemy.factionId === 'enemy' && enemy.subtype !== 'bomb'
    ).length;

    let result: RunResult['result'];
    if ((finalState.player.hp || 0) <= 0 || finalState.gameStatus === 'lost') {
        result = 'lost';
    } else if (aliveHostiles === 0 || finalState.gameStatus === 'won') {
        result = 'won';
    } else if (
        finalState.gameStatus === 'playing'
        && ((finalState.turnsSpent || 0) >= maxTurns || run.result === 'timeout' || run.result === 'lost')
    ) {
        result = 'timeout';
    } else {
        result = run.result;
    }

    return {
        ...run,
        result,
        turnsSpent: finalState.turnsSpent || run.turnsSpent,
        floor: finalState.floor,
        kills: finalState.kills || run.kills,
        hazardBreaches: finalState.hazardBreaches || run.hazardBreaches,
        score: computeScore(finalState),
        finalPlayerHp: finalState.player.hp || 0,
        finalPlayerMaxHp: Math.max(1, finalState.player.maxHp || 1),
        finalPlayerHpRatio: (finalState.player.hp || 0) / Math.max(1, finalState.player.maxHp || 1)
    };
};

const computeRunMetrics = (
    scenario: DungeonLabScenarioV1,
    run: RunResult,
    finalState: GameState,
    replayed: Pick<
        ReturnType<typeof replayActionLogWithCheckpoints>,
        'focusSurvivalTurns' | 'playerDamage' | 'focusDamage' | 'focusMaxHp'
    >
): DungeonLabRunMetricsV1 => {
    const focusReference = resolveFocusActorRuntimeId(scenario);
    const metrics: DungeonLabRunMetricsV1 = {
        damageDealt: replayed.playerDamage.damageDealt,
        damageTaken: replayed.playerDamage.damageTaken,
        firstContactTurn: Number((finalState.enemyAiTelemetry as { firstContactTurn?: number } | undefined)?.firstContactTurn || 0),
        firstDamageTurn: Number((finalState.enemyAiTelemetry as { firstDamageTurn?: number } | undefined)?.firstDamageTurn || 0)
    };

    if (!focusReference) return metrics;

    const focusActor = finalState.player.id === focusReference.compiledActorId
        ? finalState.player
        : finalState.enemies.find(enemy => enemy.id === focusReference.compiledActorId);
    metrics.focus = {
        sourceActorId: focusReference.sourceActorId,
        compiledActorId: focusReference.compiledActorId,
        endedAlive: Boolean(focusActor && focusActor.hp > 0),
        runResult: run.result,
        finalGameStatus: finalState.gameStatus,
        survivalTurns: replayed.focusSurvivalTurns,
        damageDealt: replayed.focusDamage?.damageDealt || 0,
        damageTaken: replayed.focusDamage?.damageTaken || 0,
        finalHp: focusActor?.hp || 0,
        maxHp: focusActor?.maxHp || replayed.focusMaxHp || 0
    };

    return metrics;
};

export const runDungeonLabScenario = (
    scenario: DungeonLabScenarioV1,
    seedOverride?: string,
    checkpointInterval = DUNGEON_LAB_CHECKPOINT_INTERVAL
): DungeonLabRunArtifactV1 => {
    const seed = seedOverride || scenario.floor.seed;
    const initialState = compileDungeonLabState(scenario, { allowEntityFallback: false }, seed);
    const detailed = simulateHarnessRunDetailed(
        seed,
        scenario.simulation.policy,
        scenario.simulation.maxTurns,
        'VANGUARD',
        scenario.simulation.policyProfileId || DUNGEON_LAB_DEFAULT_POLICY_PROFILE,
        scenario.floor.floor,
        scenario.floor.mapSize,
        scenario.floor.mapShape,
        initialState
    );
    const focusReference = resolveFocusActorRuntimeId(scenario);
    const replayed = replayActionLogWithCheckpoints(
        initialState,
        detailed.diagnostics.actionLog,
        checkpointInterval,
        focusReference?.compiledActorId
    );
    const resolvedRun = resolveDungeonLabRunResult(detailed.run, replayed.finalState, scenario.simulation.maxTurns);
    const metrics = computeRunMetrics(scenario, resolvedRun, replayed.finalState, replayed);
    const replayEnvelope = buildReplayEnvelope(initialState, detailed.diagnostics.actionLog, replayed.finalState);

    return {
        version: DUNGEON_LAB_RUN_ARTIFACT_VERSION,
        scenario,
        seed,
        initialState,
        finalState: replayed.finalState,
        run: resolvedRun,
        metrics,
        actionLog: [...detailed.diagnostics.actionLog],
        checkpoints: replayed.checkpoints,
        finalFingerprint: fingerprintFromState(replayed.finalState),
        replayEnvelope
    };
};

const deriveBatchSeed = (scenario: DungeonLabScenarioV1, runIndex: number): string =>
    `${scenario.floor.seed}::dungeon-lab::${runIndex + 1}`;

export const runDungeonLabBatch = (
    scenario: DungeonLabScenarioV1,
    options: DungeonLabBatchOptionsV1 = {}
): DungeonLabBatchSummaryV1 => {
    const totalRuns = Math.max(1, Number(scenario.simulation.batchCount || 1));
    const runArtifacts: DungeonLabRunArtifactV1[] = [];
    const runSummaries: DungeonLabBatchRunSummaryV1[] = [];

    for (let index = 0; index < totalRuns; index += 1) {
        const seed = deriveBatchSeed(scenario, index);
        const artifact = runDungeonLabScenario(scenario, seed, options.checkpointInterval || DUNGEON_LAB_CHECKPOINT_INTERVAL);
        runArtifacts.push(artifact);
        runSummaries.push({
            seed,
            result: artifact.run.result,
            turnsSpent: artifact.run.turnsSpent,
            finalFingerprint: artifact.finalFingerprint,
            damageDealt: artifact.metrics.damageDealt,
            damageTaken: artifact.metrics.damageTaken,
            survived: artifact.run.result === 'won' || artifact.run.result === 'timeout',
            ...(artifact.metrics.focus ? { focus: artifact.metrics.focus } : {})
        });
        options.onProgress?.(index + 1, totalRuns);
    }

    const majorityResult = Object.entries(
        runSummaries.reduce<Record<RunResult['result'], number>>((counts, run) => ({
            ...counts,
            [run.result]: (counts[run.result] || 0) + 1
        }), { won: 0, lost: 0, timeout: 0 })
    ).sort((left, right) => Number(right[1]) - Number(left[1]))[0]?.[0] as RunResult['result'] | undefined;

    const sortedByTurns = [...runArtifacts].sort((left, right) =>
        left.run.turnsSpent - right.run.turnsSpent
        || left.seed.localeCompare(right.seed)
    );
    const medianArtifact = sortedByTurns[Math.floor(sortedByTurns.length / 2)];
    const extremeSurvivalArtifact = [...runArtifacts].sort((left, right) =>
        right.run.turnsSpent - left.run.turnsSpent
        || left.seed.localeCompare(right.seed)
    )[0];

    const retainedMap = new Map<string, DungeonLabRunArtifactV1>();
    if (medianArtifact) {
        retainedMap.set(medianArtifact.seed, {
            ...medianArtifact,
            retainedReason: 'median'
        });
    }
    if (extremeSurvivalArtifact) {
        retainedMap.set(extremeSurvivalArtifact.seed, {
            ...extremeSurvivalArtifact,
            retainedReason: 'extreme_survival'
        });
    }
    for (const artifact of runArtifacts) {
        if (!majorityResult || artifact.run.result === majorityResult) continue;
        retainedMap.set(artifact.seed, {
            ...artifact,
            retainedReason: 'majority_outlier'
        });
    }

    const focusRuns = runArtifacts
        .map(artifact => artifact.metrics.focus)
        .filter((focus): focus is DungeonLabFocusedMetricsV1 => Boolean(focus));

    return {
        version: DUNGEON_LAB_BATCH_VERSION,
        scenario,
        games: totalRuns,
        winRate: runArtifacts.filter(artifact => artifact.run.result === 'won').length / totalRuns,
        timeoutRate: runArtifacts.filter(artifact => artifact.run.result === 'timeout').length / totalRuns,
        medianSurvivalTurns: median(
            runArtifacts.map(artifact =>
                artifact.metrics.focus?.survivalTurns
                ?? artifact.run.turnsSpent
            )
        ),
        p95DamageDealt: percentile(
            runArtifacts.map(artifact => artifact.metrics.focus?.damageDealt ?? artifact.metrics.damageDealt),
            0.95
        ),
        p95DamageTaken: percentile(
            runArtifacts.map(artifact => artifact.metrics.focus?.damageTaken ?? artifact.metrics.damageTaken),
            0.95
        ),
        avgFirstContactTurn: average(runArtifacts.map(artifact => artifact.metrics.firstContactTurn)),
        avgFirstDamageTurn: average(runArtifacts.map(artifact => artifact.metrics.firstDamageTurn)),
        ...(focusRuns.length > 0
            ? {
                focusActorMetrics: {
                    sourceActorId: focusRuns[0].sourceActorId,
                    endedAliveRate: focusRuns.filter(run => run.endedAlive).length / focusRuns.length,
                    survivalRate: focusRuns.filter(run => run.endedAlive).length / focusRuns.length,
                    medianSurvivalTurns: median(focusRuns.map(run => run.survivalTurns)),
                    p95DamageDealt: percentile(focusRuns.map(run => run.damageDealt), 0.95),
                    p95DamageTaken: percentile(focusRuns.map(run => run.damageTaken), 0.95),
                    resultCounts: focusRuns.reduce<Record<RunResult['result'], number>>((counts, run) => ({
                        ...counts,
                        [run.runResult]: (counts[run.runResult] || 0) + 1
                    }), { won: 0, lost: 0, timeout: 0 })
                }
            }
            : {}),
        runs: runSummaries,
        retainedArtifacts: [...retainedMap.values()]
    };
};

const selectLivePlayerAction = (
    state: GameState,
    scenario: DungeonLabScenarioV1,
    decisionCounter: number
): { action: Action; selectionSummary?: GenericUnitAiSelectionSummary } => {
    const profile = getGenericAiGoalProfile(scenario.simulation.policyProfileId || DUNGEON_LAB_DEFAULT_POLICY_PROFILE);
    const selection = selectHarnessPlayerAction(
        state,
        scenario.simulation.policy,
        profile,
        `${state.rngSeed || scenario.floor.seed}:${decisionCounter}`,
        decisionCounter
    );
    return {
        action: selection.action,
        selectionSummary: selection.selectionSummary
    };
};

export function* runDungeonLabLiveSession(
    scenario: DungeonLabScenarioV1,
    seedOverride?: string
): Generator<DungeonLabLiveStepV1, DungeonLabRunArtifactV1, void> {
    const seed = seedOverride || scenario.floor.seed;
    let state = compileDungeonLabState(scenario, { allowEntityFallback: false }, seed);
    let actionIndex = 0;
    let decisionCounter = 0;

    while ((state.gameStatus === 'playing' || state.gameStatus === 'choosing_upgrade') && state.turnsSpent < scenario.simulation.maxTurns) {
        if (state.gameStatus === 'choosing_upgrade') {
            const action: Action = { type: 'SELECT_UPGRADE', payload: state.shrineOptions?.[0] || 'EXTRA_HP' };
            state = resolvePending(gameReducer(state, action));
            actionIndex += 1;
            yield {
                actionIndex,
                actingSide: 'system',
                action,
                state
            };
            continue;
        }

        if (isPlayerTurn(state)) {
            const selection = selectLivePlayerAction(state, scenario, decisionCounter++);
            state = resolvePending(gameReducer(state, selection.action));
            actionIndex += 1;
            yield {
                actionIndex,
                actingSide: 'player',
                action: selection.action,
                selectionSummary: selection.selectionSummary,
                state
            };
            continue;
        }

        const action: Action = { type: 'ADVANCE_TURN' };
        state = resolvePending(gameReducer(state, action));
        actionIndex += 1;
        yield {
            actionIndex,
            actingSide: 'system',
            action,
            state
        };
    }

    return runDungeonLabScenario(scenario, seed);
}
