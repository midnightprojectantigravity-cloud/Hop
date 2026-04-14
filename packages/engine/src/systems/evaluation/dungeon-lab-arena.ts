import { DEFAULT_START_RUN_MAP_SHAPE, DEFAULT_START_RUN_MAP_SIZE } from '../../constants';
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
import type { AilmentID, TileID } from '../../types/registry';
import { getAilmentDefinition } from '../../data/ailments';
import { deriveEnemyBestiaryStats } from '../../data/enemies';
import { BASE_TILES } from '../tiles/tile-registry';
import type { Tile } from '../tiles/tile-types';
import { recomputeVisibility } from '../visibility';
import { SpatialSystem } from '../spatial-system';
import { createEntity } from '../entities/entity-factory';
import type { TrinityStats } from '../combat/trinity-resolver';
import { computeSkillPowerProfileMap } from './balance-skill-power';
import { computeUnitPowerProfile } from './balance-unit-power';
import { resolvePending } from '../ai/player/selector';
import { resolveVirtualSkillDefinition } from '../skill-upgrade-resolution';
import type { ReplayEnvelopeV3 } from '../replay-validation';
import { validateReplayEnvelopeV3 } from '../replay-validation';
import type { GenericUnitAiCandidate, GenericUnitAiSelectionSummary } from '../ai/generic-unit-ai';
import type { GenericAiRuntimeTraceEvent } from '../../strategy/generic-ai';
import { buildInitiativeQueue } from '../initiative';

export type DungeonLabArenaPresetId = 'empty' | 'pillar_ring' | 'obstacle_lane';
export type DungeonLabArenaSide = 'alpha' | 'beta';

export interface DungeonLabArenaActorV2 {
    id: string;
    name: string;
    side: DungeonLabArenaSide;
    position: Point;
    visualAssetRef?: string;
    trinity: TrinityStats;
    skillIds: string[];
    activeUpgradeIdsBySkill?: Record<string, string[]>;
    goal?: GenericAiGoal;
    subtypeRef?: string;
    weightClass?: WeightClass;
}

export interface DungeonLabArenaConfigV2 {
    version: 'dungeon-lab-arena-v2';
    seed: string;
    arenaPreset: DungeonLabArenaPresetId;
    turnLimit: number;
    actors: DungeonLabArenaActorV2[];
    focusedActorId?: string;
}

export type DungeonLabArenaIssueCode =
    | 'MISSING_ALPHA'
    | 'MISSING_BETA'
    | 'DUPLICATE_ACTOR_ID'
    | 'DUPLICATE_POSITION'
    | 'OUT_OF_BOUNDS_ACTOR'
    | 'UNKNOWN_SKILL'
    | 'UNKNOWN_UPGRADE';

export interface DungeonLabArenaValidationIssueV2 {
    code: DungeonLabArenaIssueCode;
    severity: 'warning' | 'error';
    message: string;
    actorId?: string;
    point?: Point;
}

export interface DungeonLabArenaPreviewMarkerV2 {
    kind: 'actor_issue';
    severity: 'warning' | 'error';
    point: Point;
    label: string;
    actorId?: string;
}

export interface DungeonLabArenaProjectionV2 {
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

export interface DungeonLabArenaSkillSynergyWarningV2 {
    ailment: AilmentID;
    conflictsWith: AilmentID;
    sourceSkillIds: string[];
    message: string;
}

export interface DungeonLabArenaActorAnalysisV2 {
    actor: DungeonLabArenaActorV2;
    projection: DungeonLabArenaProjectionV2;
    skillPowerSummaries: ReturnType<typeof computeSkillPowerProfileMap>[string][];
    synergyWarnings: DungeonLabArenaSkillSynergyWarningV2[];
}

export interface DungeonLabArenaActorReferenceV2 {
    sourceActorId: string;
    compiledActorId: string;
    side: DungeonLabArenaSide;
    name: string;
    visualAssetRef?: string;
}

export interface DungeonLabArenaPreviewInspectionV2 {
    state: GameState;
    issues: DungeonLabArenaValidationIssueV2[];
    markers: DungeonLabArenaPreviewMarkerV2[];
    actorReferences: Record<string, DungeonLabArenaActorReferenceV2>;
}

export interface DungeonLabArenaSemanticScoresV2 {
    lethality: number;
    selfPreservation: number;
    tempo: number;
}

export interface DungeonLabArenaDecisionCandidateV2 {
    rank: number;
    actionSummary: string;
    score: number;
    reasoningCode: string;
    rejectionCode?: string;
    semanticScores: DungeonLabArenaSemanticScoresV2;
    topBreakdown: Array<{ key: string; value: number }>;
    breakdown: Record<string, number>;
}

export interface DungeonLabArenaDecisionTraceEntryV2 {
    decisionIndex: number;
    actionIndex: number;
    actorId: string;
    actorLabel: string;
    side: DungeonLabArenaSide;
    turnNumber: number;
    actionSummary: string;
    reasoningCode: string;
    rejectionCode?: string;
    semanticScores: DungeonLabArenaSemanticScoresV2;
    selectedFacts?: Record<string, unknown>;
    selectionSummary?: GenericUnitAiSelectionSummary;
    topCandidates: DungeonLabArenaDecisionCandidateV2[];
    rejectedCandidates: DungeonLabArenaDecisionCandidateV2[];
}

export interface DungeonLabArenaTimelineMarkerV2 {
    actionIndex: number;
    kind: 'eliminated' | 'exhausted';
    label: string;
    actorId?: string;
}

export interface DungeonLabArenaCheckpointV2 {
    actionIndex: number;
    state: GameState;
    fingerprint: string;
}

export interface DungeonLabArenaActorOutcomeV2 {
    sourceActorId: string;
    compiledActorId: string;
    name: string;
    side: DungeonLabArenaSide;
    endedAlive: boolean;
    finalHp: number;
    maxHp: number;
    damageDealt: number;
    damageTaken: number;
}

export interface DungeonLabArenaRunArtifactV2 {
    version: 'dungeon-lab-arena-run-v2';
    config: DungeonLabArenaConfigV2;
    seed: string;
    initialState: GameState;
    finalState: GameState;
    result: 'alpha_win' | 'beta_win' | 'timeout';
    actionLog: Action[];
    checkpoints: DungeonLabArenaCheckpointV2[];
    finalFingerprint: string;
    replayEnvelope: ReplayEnvelopeV3;
    actorReferences: Record<string, DungeonLabArenaActorReferenceV2>;
    actorOutcomes: DungeonLabArenaActorOutcomeV2[];
    decisionTrace: DungeonLabArenaDecisionTraceEntryV2[];
    timelineMarkers: DungeonLabArenaTimelineMarkerV2[];
}

export interface DungeonLabArenaLiveStepV2 {
    actionIndex: number;
    state: GameState;
    decisionTrace: DungeonLabArenaDecisionTraceEntryV2[];
}

const ARENA_ARTIFACT_VERSION = 'dungeon-lab-arena-run-v2';
const CHECKPOINT_INTERVAL = 12;
const BASE_MAP_SIZE: GridSize = { ...DEFAULT_START_RUN_MAP_SIZE };
const BASE_MAP_SHAPE: MapShape = DEFAULT_START_RUN_MAP_SHAPE;
const ARENA_OFFBOARD_OBJECTIVE: Point = { q: -999, r: -999, s: 1998 };

const clonePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: point.s });
const normalizePoint = (point: Point): Point => ({ q: point.q, r: point.r, s: -point.q - point.r });
const cloneTrinity = (trinity: TrinityStats): TrinityStats => ({
    body: Number(trinity.body || 0),
    instinct: Number(trinity.instinct || 0),
    mind: Number(trinity.mind || 0)
});

const cloneSkill = (skill: Skill): Skill => ({
    ...skill,
    upgrades: [...(skill.upgrades || [])],
    activeUpgrades: [...(skill.activeUpgrades || [])]
});

const createTile = (baseId: TileID, position: Point): Tile => ({
    baseId,
    position: clonePoint(position),
    traits: new Set(BASE_TILES[baseId].defaultTraits),
    effects: []
});

const createRuntimeSkills = (
    skillIds: string[],
    activeUpgradeIdsBySkill?: Record<string, string[]>
): Skill[] =>
    skillIds
        .map(skillId => {
            const active = createActiveSkill(skillId) as Skill | null;
            if (!active) return null;
            const allowedUpgrades = new Set(active.upgrades || []);
            const requested = activeUpgradeIdsBySkill?.[skillId] || [];
            return cloneSkill({
                ...active,
                activeUpgrades: requested.filter(upgradeId => allowedUpgrades.has(upgradeId))
            });
        })
        .filter((skill): skill is Skill => Boolean(skill));

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

const presetWalls = (
    preset: DungeonLabArenaPresetId,
    center: Point
): Point[] => {
    switch (preset) {
        case 'pillar_ring':
            return [
                normalizePoint({ q: center.q + 1, r: center.r, s: 0 }),
                normalizePoint({ q: center.q + 1, r: center.r - 1, s: 0 }),
                normalizePoint({ q: center.q, r: center.r - 1, s: 0 }),
                normalizePoint({ q: center.q - 1, r: center.r, s: 0 }),
                normalizePoint({ q: center.q - 1, r: center.r + 1, s: 0 }),
                normalizePoint({ q: center.q, r: center.r + 1, s: 0 }),
            ];
        case 'obstacle_lane':
            return [
                normalizePoint({ q: center.q, r: center.r - 1, s: 0 }),
                normalizePoint({ q: center.q, r: center.r, s: 0 }),
                normalizePoint({ q: center.q, r: center.r + 1, s: 0 }),
            ];
        default:
            return [];
    }
};

const resolveArenaBaseState = (seed: string): GameState => generateInitialState(
    1,
    seed,
    seed,
    undefined,
    undefined,
    BASE_MAP_SIZE,
    BASE_MAP_SHAPE
);

const resolveArenaTiles = (baseState: GameState, preset: DungeonLabArenaPresetId): Map<string, Tile> => {
    const center = normalizePoint({
        q: Math.floor(baseState.gridWidth / 2),
        r: Math.floor(baseState.gridHeight / 2),
        s: 0
    });
    const wallKeys = new Set(presetWalls(preset, center).map(pointToKey));
    const next = new Map<string, Tile>();
    for (const tile of baseState.tiles.values()) {
        next.set(pointToKey(tile.position), createTile(wallKeys.has(pointToKey(tile.position)) ? 'WALL' : 'STONE', tile.position));
    }
    return next;
};

const buildActorMappings = (
    config: DungeonLabArenaConfigV2
): Record<string, DungeonLabArenaActorReferenceV2> => {
    const mappings: Record<string, DungeonLabArenaActorReferenceV2> = {};
    let sawAlphaPrimary = false;
    for (const actor of config.actors) {
        const compiledActorId = actor.side === 'alpha' && !sawAlphaPrimary ? 'player' : actor.id;
        if (actor.side === 'alpha' && !sawAlphaPrimary) sawAlphaPrimary = true;
        mappings[actor.id] = {
            sourceActorId: actor.id,
            compiledActorId,
            side: actor.side,
            name: actor.name,
            visualAssetRef: actor.visualAssetRef
        };
    }
    return mappings;
};

export const createDefaultDungeonLabArenaConfigV2 = (): DungeonLabArenaConfigV2 => ({
    version: 'dungeon-lab-arena-v2',
    seed: 'dungeon-lab-arena',
    arenaPreset: 'empty',
    turnLimit: 30,
    focusedActorId: 'alpha-vanguard',
    actors: [
        {
            id: 'alpha-vanguard',
            name: 'Vanguard',
            side: 'alpha',
            position: normalizePoint({ q: 2, r: 5, s: 0 }),
            trinity: { body: 16, instinct: 10, mind: 4 },
            skillIds: ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK', 'JUMP', 'SHIELD_BASH', 'STANDARD_VISION', 'BASIC_AWARENESS', 'BURROW']
        },
        {
            id: 'beta-butcher',
            name: 'Butcher',
            side: 'beta',
            position: normalizePoint({ q: 6, r: 5, s: 0 }),
            visualAssetRef: 'apps/web/public/assets/bestiary/unit.goblin.butcher.01.webp',
            trinity: { body: 20, instinct: 29, mind: 0 },
            skillIds: ['BASIC_MOVE', 'BASIC_ATTACK']
        }
    ]
});

const cloneFacts = (facts?: Record<string, unknown>): Record<string, unknown> | undefined =>
    facts ? JSON.parse(JSON.stringify(facts)) : undefined;

const collectValidationIssues = (
    config: DungeonLabArenaConfigV2,
    baseState?: GameState
): DungeonLabArenaValidationIssueV2[] => {
    const issues: DungeonLabArenaValidationIssueV2[] = [];
    if (!config.actors.some(actor => actor.side === 'alpha')) {
        issues.push({ code: 'MISSING_ALPHA', severity: 'error', message: 'Arena needs at least one Alpha actor.' });
    }
    if (!config.actors.some(actor => actor.side === 'beta')) {
        issues.push({ code: 'MISSING_BETA', severity: 'error', message: 'Arena needs at least one Beta actor.' });
    }

    const seenIds = new Set<string>();
    const seenPositions = new Map<string, string>();

    for (const actor of config.actors) {
        const point = normalizePoint(actor.position);
        if (seenIds.has(actor.id)) {
            issues.push({
                code: 'DUPLICATE_ACTOR_ID',
                severity: 'error',
                message: `Actor id "${actor.id}" is duplicated.`,
                actorId: actor.id
            });
        }
        seenIds.add(actor.id);

        const positionKey = pointToKey(point);
        if (seenPositions.has(positionKey)) {
            issues.push({
                code: 'DUPLICATE_POSITION',
                severity: 'error',
                message: `Actors "${seenPositions.get(positionKey)}" and "${actor.id}" share ${positionKey}.`,
                actorId: actor.id,
                point
            });
        } else {
            seenPositions.set(positionKey, actor.id);
        }

        if (baseState && !baseState.tiles.has(positionKey)) {
            issues.push({
                code: 'OUT_OF_BOUNDS_ACTOR',
                severity: 'error',
                message: `Actor "${actor.id}" is outside the arena bounds.`,
                actorId: actor.id,
                point
            });
        }

        for (const skillId of actor.skillIds) {
            const definition = SkillRegistry.get(skillId);
            if (!definition) {
                issues.push({
                    code: 'UNKNOWN_SKILL',
                    severity: 'error',
                    message: `Actor "${actor.id}" references unknown skill "${skillId}".`,
                    actorId: actor.id,
                    point
                });
                continue;
            }
            for (const upgradeId of actor.activeUpgradeIdsBySkill?.[skillId] || []) {
                if (!definition.upgrades?.[upgradeId]) {
                    issues.push({
                        code: 'UNKNOWN_UPGRADE',
                        severity: 'error',
                        message: `Actor "${actor.id}" enables unknown upgrade "${upgradeId}" for skill "${skillId}".`,
                        actorId: actor.id,
                        point
                    });
                }
            }
        }
    }

    return issues;
};

export const validateDungeonLabArenaConfigV2 = (
    config: DungeonLabArenaConfigV2
): { valid: boolean; issues: DungeonLabArenaValidationIssueV2[] } => {
    const baseState = resolveArenaBaseState(config.seed);
    const issues = collectValidationIssues(config, { ...baseState, tiles: resolveArenaTiles(baseState, config.arenaPreset) });
    return {
        valid: !issues.some(issue => issue.severity === 'error'),
        issues
    };
};

const resolveActorProjection = (actor: DungeonLabArenaActorV2): DungeonLabArenaProjectionV2 => {
    const runtimeSkills = createRuntimeSkills(actor.skillIds, actor.activeUpgradeIdsBySkill);
    const derived = deriveEnemyBestiaryStats({
        trinity: actor.trinity,
        bestiarySkills: buildCombatSkillLoadout(actor.skillIds),
        runtimeSkills: buildCombatSkillLoadout(actor.skillIds),
        cost: 1,
        weightClass: actor.weightClass || 'Standard'
    });
    const upgradeAwareRange = Math.max(
        derived.range,
        ...runtimeSkills.map(skill => {
            const runtimeActor = { activeSkills: runtimeSkills };
            return SkillRegistry.getSkillRange(runtimeActor, skill.id);
        })
    );
    const cooldownDelta = runtimeSkills.reduce((best, skill) => {
        const definition = SkillRegistry.get(skill.id);
        if (!definition) return best;
        const resolved = resolveVirtualSkillDefinition(definition, skill.activeUpgrades || []);
        const skillDelta = resolved.skill.baseVariables.cooldown - (definition.baseVariables.cooldown || 0);
        return Math.min(best, skillDelta);
    }, 0);
    const skillProfilesById = computeSkillPowerProfileMap();
    const unitProfile = computeUnitPowerProfile({
        unitId: actor.id,
        unitKind: actor.side === 'alpha' ? 'player_loadout' : 'enemy',
        skillIds: actor.skillIds,
        trinity: actor.trinity,
        hp: derived.hp,
        maxHp: derived.maxHp,
        speed: derived.speed,
        weightClass: actor.weightClass || 'Standard',
        baseDamage: derived.damage,
        baseRange: upgradeAwareRange,
        actionCooldown: Math.max(0, derived.actionCooldown + cooldownDelta)
    }, skillProfilesById);

    return {
        hp: derived.hp,
        maxHp: derived.maxHp,
        speed: derived.speed,
        damage: derived.damage,
        range: upgradeAwareRange,
        type: derived.type,
        actionCooldown: Math.max(0, derived.actionCooldown + cooldownDelta),
        powerBand: unitProfile.powerBand,
        intrinsicPowerScore: unitProfile.intrinsicPowerScore,
        rationale: [...unitProfile.rationale]
    };
};

const probeSkillAilmentEmissions = (() => {
    const cache = new Map<string, AilmentID[]>();
    return (skillId: string): AilmentID[] => {
        if (cache.has(skillId)) return [...(cache.get(skillId) || [])];
        const definition = SkillRegistry.get(skillId);
        if (!definition) return [];

        try {
            const baseState = resolveArenaBaseState('dungeon-lab-arena-ailment-probe');
            const player = createEntity({
                id: 'player',
                type: 'player',
                position: normalizePoint({ q: 4, r: 6, s: 0 }),
                speed: 1,
                factionId: 'player',
                activeSkills: createRuntimeSkills(['BASIC_MOVE', 'BASIC_ATTACK', skillId]),
                trinity: { body: 12, instinct: 12, mind: 12 },
                weightClass: 'Standard'
            });
            const enemy = createEntity({
                id: 'probe_enemy',
                type: 'enemy',
                position: normalizePoint({ q: 5, r: 6, s: 0 }),
                speed: 1,
                factionId: 'enemy',
                activeSkills: createRuntimeSkills(['BASIC_MOVE', 'BASIC_ATTACK']),
                trinity: { body: 12, instinct: 8, mind: 4 },
                weightClass: 'Standard'
            });
            const probeState = recomputeVisibility({
                ...baseState,
                tiles: resolveArenaTiles(baseState, 'empty'),
                player,
                enemies: [enemy],
                companions: [],
                occupancyMask: SpatialSystem.refreshOccupancyMask({
                    ...baseState,
                    player,
                    enemies: [enemy],
                    companions: []
                })
            });
            const target = definition.getValidTargets?.(probeState, player.position)?.[0] || enemy.position;
            const result = definition.execute(probeState, player, target);
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

const buildActorSynergyWarnings = (actor: DungeonLabArenaActorV2): DungeonLabArenaSkillSynergyWarningV2[] => {
    const ailmentToSkillIds = new Map<AilmentID, string[]>();
    for (const skillId of actor.skillIds) {
        for (const ailment of probeSkillAilmentEmissions(skillId)) {
            ailmentToSkillIds.set(ailment, [...(ailmentToSkillIds.get(ailment) || []), skillId]);
        }
    }

    const warnings: DungeonLabArenaSkillSynergyWarningV2[] = [];
    for (const [ailment, sourceSkillIds] of ailmentToSkillIds.entries()) {
        const definition = getAilmentDefinition(ailment);
        for (const interaction of definition?.interactions || []) {
            const opposing = ailmentToSkillIds.get(interaction.target) || [];
            if (opposing.length === 0) continue;
            warnings.push({
                ailment,
                conflictsWith: interaction.target,
                sourceSkillIds: [...new Set([...sourceSkillIds, ...opposing])].sort(),
                message: `${ailment} annihilates against ${interaction.target} under ACAE.`
            });
        }
    }
    return warnings;
};

export const analyzeDungeonLabArenaActor = (
    actor: DungeonLabArenaActorV2
): DungeonLabArenaActorAnalysisV2 => {
    const profilesById = computeSkillPowerProfileMap();
    return {
        actor,
        projection: resolveActorProjection(actor),
        skillPowerSummaries: actor.skillIds
            .map(skillId => profilesById[skillId])
            .filter((profile): profile is ReturnType<typeof computeSkillPowerProfileMap>[string] => Boolean(profile)),
        synergyWarnings: buildActorSynergyWarnings(actor)
    };
};

const createCompiledActor = (
    actor: DungeonLabArenaActorV2,
    reference: DungeonLabArenaActorReferenceV2
): Actor => {
    const projection = resolveActorProjection(actor);
    return {
        ...createEntity({
            id: reference.compiledActorId,
            type: reference.compiledActorId === 'player' ? 'player' : 'enemy',
            subtype: actor.subtypeRef,
            visualAssetRef: actor.visualAssetRef,
            position: normalizePoint(actor.position),
            hp: projection.hp,
            maxHp: projection.maxHp,
            speed: projection.speed,
            factionId: actor.side === 'beta' ? 'enemy' : 'player',
            activeSkills: createRuntimeSkills(actor.skillIds, actor.activeUpgradeIdsBySkill),
            trinity: cloneTrinity(actor.trinity),
            weightClass: actor.weightClass || 'Standard'
        }),
        previousPosition: normalizePoint(actor.position),
        behaviorState: {
            overlays: [],
            goal: actor.goal || 'engage',
            controller: 'generic_ai',
            arenaTieBreakKey: reference.sourceActorId
        },
        actionCooldown: projection.actionCooldown,
        enemyType: projection.type
    };
};

export const inspectDungeonLabArenaPreview = (
    config: DungeonLabArenaConfigV2,
    seedOverride?: string
): DungeonLabArenaPreviewInspectionV2 => {
    const seed = seedOverride || config.seed;
    const baseState = resolveArenaBaseState(seed);
    const tiles = resolveArenaTiles(baseState, config.arenaPreset);
    const issues = collectValidationIssues(config, { ...baseState, tiles });
    const actorReferences = buildActorMappings(config);

    let playerActor: Actor | null = null;
    const betaActors: Actor[] = [];
    const alphaCompanions: Actor[] = [];

    for (const actor of config.actors) {
        const compiled = createCompiledActor(actor, actorReferences[actor.id]);
        if (actorReferences[actor.id]?.compiledActorId === 'player') {
            playerActor = compiled;
        } else if (actor.side === 'alpha') {
            alphaCompanions.push(compiled);
        } else {
            betaActors.push(compiled);
        }
    }

    const nextState: GameState = {
        ...baseState,
        simulationMode: 'arena_symmetric',
        tiles,
        player: playerActor || {
            ...baseState.player,
            behaviorState: {
                ...(baseState.player.behaviorState || { overlays: [] }),
                overlays: [...(baseState.player.behaviorState?.overlays || [])],
                controller: 'generic_ai',
                goal: 'engage'
            }
        },
        enemies: betaActors,
        companions: alphaCompanions,
        gameStatus: 'playing',
        shrinePosition: undefined,
        shrineOptions: undefined,
        stairsPosition: ARENA_OFFBOARD_OBJECTIVE,
        message: [],
        actionLog: [],
        commandLog: [],
        undoStack: [],
        visualEvents: [],
        timelineEvents: [],
        simulationEvents: [],
        combatScoreEvents: [],
        intentPreview: undefined,
        turnsSpent: 0
    };
    const finalized = recomputeVisibility({
        ...nextState,
        occupancyMask: SpatialSystem.refreshOccupancyMask(nextState),
        initiativeQueue: buildInitiativeQueue({
            ...nextState,
            occupancyMask: SpatialSystem.refreshOccupancyMask(nextState)
        })
    });

    return {
        state: finalized,
        issues,
        markers: issues
            .filter(issue => issue.point)
            .map(issue => ({
                kind: 'actor_issue' as const,
                severity: issue.severity,
                point: clonePoint(issue.point!),
                label: issue.message,
                actorId: issue.actorId
            })),
        actorReferences
    };
};

const buildReplayEnvelope = (
    config: DungeonLabArenaConfigV2,
    initialState: GameState,
    actionLog: Action[],
    finalState: GameState
): ReplayEnvelopeV3 => {
    const envelope: ReplayEnvelopeV3 = {
        version: 3,
        run: {
            seed: initialState.rngSeed || initialState.initialSeed || config.seed,
            initialSeed: initialState.initialSeed || initialState.rngSeed || config.seed,
            loadoutId: 'ARENA',
            startFloor: initialState.floor,
            mapSize: {
                width: initialState.gridWidth,
                height: initialState.gridHeight
            },
            mapShape: initialState.mapShape || 'diamond',
            mode: 'normal',
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
                suspiciouslyShort: actionLog.length < 1
            },
            final: {
                score: finalState.kills || 0,
                floor: finalState.floor,
                fingerprint: fingerprintFromState(finalState),
                gameStatus: finalState.gameStatus === 'won' ? 'won' : 'lost'
            }
        }
    };

    const validation = validateReplayEnvelopeV3(envelope);
    if (!validation.valid || !validation.envelope) {
        throw new Error(`Dungeon Lab arena generated an invalid replay envelope: ${validation.errors.join(' | ')}`);
    }
    return validation.envelope;
};

const LETHALITY_KEYS = new Set([
    'damage',
    'kills',
    'kill_now_bonus',
    'damage_now_bonus',
    'damage_over_positioning_bonus',
    'threaten_next_bonus',
    'follow_through_bonus',
    'engage_commit_bonus',
    'approach_window_bonus'
]);
const SELF_PRESERVATION_KEYS = new Set([
    'exposure',
    'safe_after',
    'self_damage',
    'hazard',
    'recovery',
    'reserve',
    'pacing',
    'redline',
    'spark',
    'mana',
    'burn',
    'recover_wait_bonus',
    'spark_band_preservation_bonus',
    'rested_reentry_priority_bonus',
    'premature_rest_penalty'
]);
const TEMPO_KEYS = new Set([
    'objective',
    'path_progress',
    'targeting',
    'intent',
    'range',
    'persistence',
    'mobility_role',
    'line_discipline',
    'no_progress_penalty',
    'loop_penalty',
    'backtrack_penalty',
    'low_value_mobility_penalty',
    'wait_missed_objective_penalty',
    'wait_missed_threat_penalty',
    'wait_missed_attack_penalty'
]);

const resolveSemanticScores = (breakdown: Record<string, number>): DungeonLabArenaSemanticScoresV2 => {
    let lethality = 0;
    let selfPreservation = 0;
    let tempo = 0;
    for (const [key, value] of Object.entries(breakdown)) {
        if (LETHALITY_KEYS.has(key)) lethality += value;
        else if (SELF_PRESERVATION_KEYS.has(key)) selfPreservation += value;
        else if (TEMPO_KEYS.has(key)) tempo += value;
    }
    return { lethality, selfPreservation, tempo };
};

const formatActionSummary = (candidate: GenericUnitAiCandidate): string => {
    if (candidate.action.type === 'WAIT') return 'WAIT';
    if (candidate.action.type === 'MOVE') {
        return `MOVE (${candidate.action.payload.q}, ${candidate.action.payload.r})`;
    }
    return candidate.action.payload.target
        ? `USE ${candidate.action.payload.skillId} -> (${candidate.action.payload.target.q}, ${candidate.action.payload.target.r})`
        : `USE ${candidate.action.payload.skillId}`;
};

const resolveCandidateRejectionCode = (candidate: GenericUnitAiCandidate): string | undefined => {
    if (candidate.sparkDoctrine && !candidate.sparkDoctrine.allowed) {
        return candidate.sparkDoctrine.gateReason === 'none'
            ? 'REJECTED_BY_SPARK_DOCTRINE'
            : `REJECTED_BY_${String(candidate.sparkDoctrine.gateReason).toUpperCase()}`;
    }
    if (candidate.breakdown?.blocked_by_reversal_guard !== undefined) return 'REJECTED_BY_REVERSAL_GUARD';
    if (candidate.reasoningCode.startsWith('BLOCKED_RETREAT_')) return 'REJECTED_BY_REVERSAL_GUARD';
    if (candidate.reasoningCode.startsWith('BLOCKED_')) return 'BLOCKED_PREVIEW_FAILURE';
    return undefined;
};

const toDecisionCandidate = (
    candidate: GenericUnitAiCandidate,
    rank: number
): DungeonLabArenaDecisionCandidateV2 => ({
    rank,
    actionSummary: formatActionSummary(candidate),
    score: candidate.score,
    reasoningCode: candidate.reasoningCode,
    rejectionCode: resolveCandidateRejectionCode(candidate),
    semanticScores: resolveSemanticScores(candidate.breakdown || {}),
    topBreakdown: Object.entries(candidate.breakdown || {})
        .sort((left, right) => Math.abs(right[1]) - Math.abs(left[1]))
        .slice(0, 3)
        .map(([key, value]) => ({ key, value })),
    breakdown: { ...(candidate.breakdown || {}) }
});

const collectDecisionTrace = (
    state: GameState,
    actorReferences: Record<string, DungeonLabArenaActorReferenceV2>,
    decisionIndexStart: number,
    actionIndex: number
): {
    cleanup: () => void;
    drain: () => DungeonLabArenaDecisionTraceEntryV2[];
} => {
    const events: GenericAiRuntimeTraceEvent[] = [];
    (globalThis as any).__HOP_GENERIC_AI_RUNTIME_TRACE_HOOK__ = (event: GenericAiRuntimeTraceEvent) => {
        events.push(event);
    };

    return {
        cleanup: () => {
            delete (globalThis as any).__HOP_GENERIC_AI_RUNTIME_TRACE_HOOK__;
        },
        drain: () => events.map((event, index) => {
            const reference = Object.values(actorReferences).find(candidate => candidate.compiledActorId === event.actorId)
                || {
                    sourceActorId: event.actorId,
                    compiledActorId: event.actorId,
                    side: event.side === 'enemy' ? 'beta' : 'alpha',
                    name: event.actorId
                };
            const ranked = [...event.candidates];
            const finiteRanked = ranked.filter(candidate => Number.isFinite(candidate.score));
            const topCandidates = [
                event.selected,
                ...finiteRanked.filter(candidate => candidate !== event.selected)
            ]
                .slice(0, 3)
                .map((candidate, candidateIndex) => toDecisionCandidate(candidate, candidateIndex + 1));
            const rejectedCandidates = ranked
                .filter(candidate =>
                    candidate !== event.selected
                    && (!Number.isFinite(candidate.score) || Boolean(resolveCandidateRejectionCode(candidate)))
                )
                .slice(0, 8)
                .map((candidate, candidateIndex) => toDecisionCandidate(candidate, candidateIndex + 1));

            return {
                decisionIndex: decisionIndexStart + index + 1,
                actionIndex,
                actorId: reference.sourceActorId,
                actorLabel: `${reference.name} (${reference.side})`,
                side: reference.side,
                turnNumber: state.turnNumber,
                actionSummary: formatActionSummary(event.selected),
                reasoningCode: event.selected.reasoningCode,
                rejectionCode: resolveCandidateRejectionCode(event.selected),
                semanticScores: resolveSemanticScores(event.selected.breakdown || {}),
                selectedFacts: cloneFacts(event.selected.facts as unknown as Record<string, unknown>),
                selectionSummary: event.summary,
                topCandidates,
                rejectedCandidates
            };
        })
    };
};

const isSideAlive = (state: GameState, side: DungeonLabArenaSide): boolean => {
    if (side === 'alpha') {
        return (state.player.hp || 0) > 0
            || Boolean((state.companions || []).some(companion => companion.factionId === 'player' && (companion.hp || 0) > 0));
    }
    return state.enemies.some(enemy => enemy.factionId === 'enemy' && (enemy.hp || 0) > 0);
};

const stampArenaTurnCount = (
    state: GameState,
    actionCount: number
): GameState => state.simulationMode === 'arena_symmetric'
    ? {
        ...state,
        turnsSpent: Math.max(Number(state.turnsSpent || 0), actionCount)
    }
    : state;

const resolveArenaResult = (
    state: GameState,
    config: DungeonLabArenaConfigV2,
    actionCount: number
): 'alpha_win' | 'beta_win' | 'timeout' => {
    const alphaAlive = isSideAlive(state, 'alpha');
    const betaAlive = isSideAlive(state, 'beta');
    if (alphaAlive && !betaAlive) return 'alpha_win';
    if (betaAlive && !alphaAlive) return 'beta_win';
    if (Math.max(Number(state.turnsSpent || 0), actionCount) >= config.turnLimit) return 'timeout';
    if (state.gameStatus === 'lost' && !alphaAlive) return 'beta_win';
    return 'timeout';
};

const replayActionLogWithCheckpoints = (
    initialState: GameState,
    actionLog: Action[],
    checkpointInterval = CHECKPOINT_INTERVAL
): { finalState: GameState; checkpoints: DungeonLabArenaCheckpointV2[]; timelineMarkers: DungeonLabArenaTimelineMarkerV2[] } => {
    let current = hydrateLoadedState(initialState);
    const checkpoints: DungeonLabArenaCheckpointV2[] = [{
        actionIndex: 0,
        state: hydrateLoadedState(initialState),
        fingerprint: fingerprintFromState(initialState)
    }];
    const timelineMarkers: DungeonLabArenaTimelineMarkerV2[] = [];
    let previousActors = new Map<string, Actor>([
        [current.player.id, current.player],
        ...current.enemies.map(enemy => [enemy.id, enemy] as const),
        ...(current.companions || []).map(companion => [companion.id, companion] as const)
    ]);

    actionLog.forEach((action, index) => {
        current = current.simulationMode === 'arena_symmetric' && action.type === 'ADVANCE_TURN'
            ? gameReducer(current, action)
            : resolvePending(gameReducer(current, action));
        current = stampArenaTurnCount(current, index + 1);
        const actors = new Map<string, Actor>([
            [current.player.id, current.player],
            ...current.enemies.map(enemy => [enemy.id, enemy] as const),
            ...(current.companions || []).map(companion => [companion.id, companion] as const)
        ]);
        for (const [actorId, prior] of previousActors.entries()) {
            const next = actors.get(actorId);
            if ((prior.hp || 0) > 0 && (!next || (next.hp || 0) <= 0)) {
                timelineMarkers.push({
                    actionIndex: index + 1,
                    kind: 'eliminated',
                    label: `${actorId} eliminated`,
                    actorId
                });
            }
            if (next && prior.ires?.currentState !== 'exhausted' && next.ires?.currentState === 'exhausted') {
                timelineMarkers.push({
                    actionIndex: index + 1,
                    kind: 'exhausted',
                    label: `${actorId} exhausted`,
                    actorId
                });
            }
        }
        previousActors = actors;
        const nextIndex = index + 1;
        if (nextIndex % checkpointInterval === 0 || nextIndex === actionLog.length) {
            checkpoints.push({
                actionIndex: nextIndex,
                state: hydrateLoadedState(current),
                fingerprint: fingerprintFromState(current)
            });
        }
    });

    return { finalState: current, checkpoints, timelineMarkers };
};

const computeDamageMetricsForActor = (
    state: GameState,
    actorId: string
): { damageDealt: number; damageTaken: number } => {
    let damageDealt = 0;
    let damageTaken = 0;
    for (const event of state.simulationEvents || []) {
        if (event.type !== 'DamageTaken') continue;
        const amount = Number(event.payload?.amount || 0);
        if (String(event.payload?.sourceId || '') === actorId) damageDealt += amount;
        if (String(event.targetId || '') === actorId) damageTaken += amount;
    }
    return { damageDealt, damageTaken };
};

const buildActorOutcomes = (
    finalState: GameState,
    actorReferences: Record<string, DungeonLabArenaActorReferenceV2>
): DungeonLabArenaActorOutcomeV2[] => Object.values(actorReferences).map(reference => {
    const runtimeActor = reference.compiledActorId === finalState.player.id
        ? finalState.player
        : finalState.enemies.find(enemy => enemy.id === reference.compiledActorId)
            || finalState.companions?.find(companion => companion.id === reference.compiledActorId);
    const damage = runtimeActor ? computeDamageMetricsForActor(finalState, runtimeActor.id) : { damageDealt: 0, damageTaken: 0 };
    return {
        sourceActorId: reference.sourceActorId,
        compiledActorId: reference.compiledActorId,
        name: reference.name,
        side: reference.side,
        endedAlive: Boolean(runtimeActor && (runtimeActor.hp || 0) > 0),
        finalHp: runtimeActor?.hp || 0,
        maxHp: runtimeActor?.maxHp || 0,
        damageDealt: damage.damageDealt,
        damageTaken: damage.damageTaken
    };
});

const runArenaSteps = (
    config: DungeonLabArenaConfigV2,
    seedOverride?: string
): DungeonLabArenaRunArtifactV2 => {
    const preview = inspectDungeonLabArenaPreview(config, seedOverride);
    const blocking = preview.issues.filter(issue => issue.severity === 'error');
    if (blocking.length > 0) {
        throw new Error(blocking.map(issue => issue.message).join(' | '));
    }

    let state = hydrateLoadedState(preview.state);
    const initialState = hydrateLoadedState(preview.state);
    const actionLog: Action[] = [];
    const decisionTrace: DungeonLabArenaDecisionTraceEntryV2[] = [];

    while (
        actionLog.length < config.turnLimit
        && isSideAlive(state, 'alpha')
        && isSideAlive(state, 'beta')
        && state.gameStatus === 'playing'
    ) {
        const actionIndex = actionLog.length + 1;
        const traceCollector = collectDecisionTrace(state, preview.actorReferences, decisionTrace.length, actionIndex);
        try {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
        } finally {
            decisionTrace.push(...traceCollector.drain());
            traceCollector.cleanup();
        }
        actionLog.push({ type: 'ADVANCE_TURN' });
        state = stampArenaTurnCount(state, actionLog.length);
    }

    const replayed = replayActionLogWithCheckpoints(initialState, actionLog);
    return {
        version: ARENA_ARTIFACT_VERSION,
        config,
        seed: seedOverride || config.seed,
        initialState,
        finalState: replayed.finalState,
        result: resolveArenaResult(replayed.finalState, config, actionLog.length),
        actionLog,
        checkpoints: replayed.checkpoints,
        finalFingerprint: fingerprintFromState(replayed.finalState),
        replayEnvelope: buildReplayEnvelope(config, initialState, actionLog, replayed.finalState),
        actorReferences: preview.actorReferences,
        actorOutcomes: buildActorOutcomes(replayed.finalState, preview.actorReferences),
        decisionTrace,
        timelineMarkers: replayed.timelineMarkers
    };
};

export const runArenaSimulation = (
    config: DungeonLabArenaConfigV2,
    seedOverride?: string
): DungeonLabArenaRunArtifactV2 => runArenaSteps(config, seedOverride);

export const runDungeonLabArenaMatch = (
    config: DungeonLabArenaConfigV2,
    seedOverride?: string
): DungeonLabArenaRunArtifactV2 => runArenaSteps(config, seedOverride);

export function* runDungeonLabArenaLiveSession(
    config: DungeonLabArenaConfigV2,
    seedOverride?: string
): Generator<DungeonLabArenaLiveStepV2, DungeonLabArenaRunArtifactV2, void> {
    const preview = inspectDungeonLabArenaPreview(config, seedOverride);
    const blocking = preview.issues.filter(issue => issue.severity === 'error');
    if (blocking.length > 0) {
        throw new Error(blocking.map(issue => issue.message).join(' | '));
    }

    let state = hydrateLoadedState(preview.state);
    const initialState = hydrateLoadedState(preview.state);
    const actionLog: Action[] = [];
    const decisionTrace: DungeonLabArenaDecisionTraceEntryV2[] = [];

    while (
        actionLog.length < config.turnLimit
        && isSideAlive(state, 'alpha')
        && isSideAlive(state, 'beta')
        && state.gameStatus === 'playing'
    ) {
        const actionIndex = actionLog.length + 1;
        const traceCollector = collectDecisionTrace(state, preview.actorReferences, decisionTrace.length, actionIndex);
        try {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
        } finally {
            decisionTrace.push(...traceCollector.drain());
            traceCollector.cleanup();
        }
        actionLog.push({ type: 'ADVANCE_TURN' });
        state = stampArenaTurnCount(state, actionLog.length);
        yield {
            actionIndex,
            state,
            decisionTrace: decisionTrace.slice(-4)
        };
    }

    const replayed = replayActionLogWithCheckpoints(initialState, actionLog);
    return {
        version: ARENA_ARTIFACT_VERSION,
        config,
        seed: seedOverride || config.seed,
        initialState,
        finalState: replayed.finalState,
        result: resolveArenaResult(replayed.finalState, config, actionLog.length),
        actionLog,
        checkpoints: replayed.checkpoints,
        finalFingerprint: fingerprintFromState(replayed.finalState),
        replayEnvelope: buildReplayEnvelope(config, initialState, actionLog, replayed.finalState),
        actorReferences: preview.actorReferences,
        actorOutcomes: buildActorOutcomes(replayed.finalState, preview.actorReferences),
        decisionTrace,
        timelineMarkers: replayed.timelineMarkers
    };
}

export const materializeDungeonLabArenaArtifactState = (
    artifact: Pick<DungeonLabArenaRunArtifactV2, 'checkpoints' | 'actionLog'>,
    actionIndex: number
): GameState => {
    const clamped = Math.max(0, Math.min(Math.round(actionIndex), artifact.actionLog.length));
    const checkpoint = [...artifact.checkpoints]
        .sort((left, right) => left.actionIndex - right.actionIndex)
        .filter(candidate => candidate.actionIndex <= clamped)
        .pop() || artifact.checkpoints[0];
    let state = hydrateLoadedState(checkpoint.state);
    for (let index = checkpoint.actionIndex; index < clamped; index += 1) {
        const action = artifact.actionLog[index];
        if (!action) break;
        state = state.simulationMode === 'arena_symmetric' && action.type === 'ADVANCE_TURN'
            ? gameReducer(state, action)
            : resolvePending(gameReducer(state, action));
    }
    return state;
};
