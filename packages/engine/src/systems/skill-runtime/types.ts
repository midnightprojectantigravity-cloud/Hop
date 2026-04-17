import type {
    Actor,
    AiBehaviorOverlayInstance,
    InformationRevealFlags,
    GameState,
    GenericAiGoal,
    Point,
    SkillDefinition,
    SkillExecutionResult,
    SkillIntentProfile,
    SkillMetabolicBandProfile,
    SkillResourceProfile,
    SkillSlot,
    SkillSummonDefinition,
    WeightClass
} from '../../types';
import type { AilmentID, JuiceEffectID, StatusID, TileEffectID } from '../../types/registry';
import type { CombatAttackProfile } from '../combat/damage-taxonomy';
import type { TrackingSignature } from '../combat/hit-quality';

export type ResolutionTraceMode = 'none' | 'summary' | 'full';

export interface ResolutionTraceEntry {
    kind: 'patch' | 'keyword' | 'predicate' | 'target' | 'instruction' | 'physics' | 'handler';
    path: string;
    message: string;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
}

export interface ResolutionTrace {
    mode: ResolutionTraceMode;
    entries: ResolutionTraceEntry[];
}

export type DeterministicSortMode =
    | 'distance_then_q_then_r'
    | 'q_then_r'
    | 'r_then_q';

export type TargetGeneratorKind =
    | 'self'
    | 'owner_hex'
    | 'single'
    | 'radius'
    | 'axial_ray'
    | 'diagonal_landing'
    | 'movement_reachable'
    | 'anchor_point';

export type PredicateDistanceOperator = 'eq' | 'lte' | 'gte';

export type SkillTargetPredicate =
    | {
        type: 'ALL';
        predicates: SkillTargetPredicate[];
    }
    | {
        type: 'ANY';
        predicates: SkillTargetPredicate[];
    }
    | {
        type: 'NOT';
        predicate: SkillTargetPredicate;
    }
    | {
        type: 'WORLD_STATE';
        key: 'has_spear' | 'has_shield' | 'spear_position_present' | 'shield_position_present';
        value?: boolean;
    }
    | {
        type: 'ENEMY_COUNT';
        op: PredicateDistanceOperator;
        value: number;
    }
    | {
        type: 'PROJECTILE_IMPACT';
        kind: 'wall' | 'actor' | 'empty';
        value?: boolean;
    }
    | {
        type: 'RESOLVED_KEYWORD';
        keyword: string;
        value?: boolean;
    }
    | {
        type: 'HEX_TRAIT';
        trait: string;
        value?: boolean;
    }
    | {
        type: 'TILE_EFFECT';
        effectId: TileEffectID;
        value?: boolean;
    }
    | {
        type: 'OCCUPANCY';
        occupied: boolean;
    }
    | {
        type: 'CORPSE_PRESENT';
        value?: boolean;
    }
    | {
        type: 'AXIAL_ALIGNMENT';
        axis: 'Q' | 'R' | 'S' | 'ANY';
        value?: boolean;
    }
    | {
        type: 'DISTANCE';
        op: PredicateDistanceOperator;
        value: number;
        from?: 'caster' | 'previous_position' | 'selected_hex';
    }
    | {
        type: 'LINE_OF_SIGHT';
        value: boolean;
    }
    | {
        type: 'STATUS';
        target: 'caster' | 'target_actor';
        statusId: StatusID;
        value?: boolean;
    }
    | {
        type: 'STATUS_DURATION';
        target: 'caster' | 'target_actor';
        statusId: StatusID;
        op: PredicateDistanceOperator;
        value: number;
    }
    | {
        type: 'RESOURCE';
        target: 'caster' | 'target_actor';
        resource: 'hp' | 'spark' | 'mana' | 'exhaustion';
        op: PredicateDistanceOperator;
        value: number;
    }
    | {
        type: 'TURN_STATE';
        kind: 'held_position' | 'moved_distance';
        op?: PredicateDistanceOperator;
        value?: number;
    }
    | {
        type: 'TURN_PARITY';
        parity: 'odd' | 'even';
    }
    | {
        type: 'WEIGHT_CLASS';
        target: 'caster' | 'target_actor';
        op: 'eq' | 'neq' | 'in';
        value?: WeightClass;
        values?: WeightClass[];
    }
    | {
        type: 'FACTION_RELATION';
        relation: 'enemy' | 'ally' | 'self';
        value?: boolean;
    }
    | {
        type: 'FACTION_ID';
        target: 'caster' | 'target_actor';
        factionId: string;
        value?: boolean;
    }
    | {
        type: 'HAS_SKILL';
        target: 'caster' | 'target_actor';
        skillId: string;
        value?: boolean;
    }
    | {
        type: 'ACTOR_TYPE';
        target: 'caster' | 'target_actor';
        actorType: 'player' | 'enemy' | 'companion';
        value?: boolean;
    }
    | {
        type: 'TURN_START_ADJACENT';
        value?: boolean;
    }
    | {
        type: 'PERSISTENT_TARGET_AVAILABLE';
        value?: boolean;
    }
    | {
        type: 'COMPANION_PRESENT';
        owner: 'caster' | 'owner';
        subtype?: string;
        value?: boolean;
    }
    | {
        type: 'COMPANION_MODE';
        target: 'caster' | 'owner_companion';
        subtype?: string;
        mode: 'scout' | 'predator' | 'roost';
        value?: boolean;
    }
    | {
        type: 'COMPANION_FLAG';
        target: 'caster' | 'owner_companion';
        subtype?: string;
        flag: 'keenSight' | 'twinTalons' | 'apexPredator';
        value?: boolean;
    }
    | {
        type: 'COMPANION_STATE_NUMBER';
        target: 'caster' | 'owner_companion';
        subtype?: string;
        field: 'orbitStep' | 'revivalCooldown' | 'apexStrikeCooldown' | 'healCooldown';
        op: PredicateDistanceOperator;
        value: number;
    }
    | {
        type: 'STEALTH_COUNTER';
        target: 'caster' | 'target_actor';
        op: PredicateDistanceOperator;
        value: number;
    };

export interface SkillTargetingDefinition {
    generator: TargetGeneratorKind;
    range: number;
    radius?: number;
    deterministicSort?: DeterministicSortMode;
    exposeSelfTarget?: boolean;
    predicates?: SkillTargetPredicate[];
}

export interface RuntimeMovementDestinationPolicy {
    occupancy?: 'none' | 'enemy' | 'ally' | 'any';
    requireWalkable?: boolean;
    enforceBounds?: boolean;
    ignoreHazards?: boolean;
}

export interface RuntimeMovementPolicy {
    basePathing?: 'walk' | 'teleport' | 'flight';
    rangeSource?: 'authored' | 'actor_speed';
    freeMoveRangeOverride?: number;
    baseIgnoreWalls?: boolean;
    baseIgnoreGroundHazards?: boolean;
    baseAllowPassThroughActors?: boolean;
    validateDestination?: RuntimeMovementDestinationPolicy;
}

export type CombatScriptPhase =
    | 'declare'
    | 'movement'
    | 'collision'
    | 'resolution'
    | 'cleanup';

export type RuntimePointRef =
    | 'origin_hex'
    | 'caster_hex'
    | 'selected_hex'
    | 'target_actor_hex'
    | 'impact_hex'
    | 'anchor_point'
    | 'scout_orbit_destination'
    | 'spear_position'
    | 'shield_position'
    | 'dash_stop_hex'
    | 'withdrawal_retreat_hex';

export type RuntimeActorRef =
    | 'self'
    | 'target_actor'
    | 'owner'
    | 'owner_companion';

export type RuntimeResolvedActorRef =
    | RuntimeActorRef
    | 'impact_actor';

export type RuntimeTargetFanOut =
    | 'selected_hex_only'
    | 'selected_hex_plus_neighbors'
    | 'selected_neighbors_only';

export type RuntimePointPattern =
    | RuntimeTargetFanOut
    | {
        kind: 'perpendicular_line';
        center: 'selected_hex';
        relativeTo: 'caster_to_selected';
        totalLength: number;
    };

export type RuntimePointFilter =
    | 'skip_blocked_by_wall';

export type RuntimePathRef =
    | 'caster_to_selected'
    | 'caster_to_impact'
    | 'caster_to_dash_stop'
    | 'impact_to_target_actor'
    | 'spear_to_caster'
    | 'shield_to_caster';

export interface RuntimePointSetSelection {
    mode: 'all' | 'first_n' | 'sample_without_replacement';
    count?: number;
}

export type RuntimePointSet =
    | {
        kind: 'axial_ring';
        center: RuntimePointRef;
        radius: number;
        cacheKey?: string;
        predicates?: SkillTargetPredicate[];
        selection?: RuntimePointSetSelection;
    }
    | {
        kind: 'line_between';
        from: RuntimePointRef;
        to: RuntimePointRef;
        cacheKey?: string;
        includeStart?: boolean;
        includeEnd?: boolean;
    };

export interface SkillCollisionPolicy {
    onBlocked: 'stop' | 'crush_damage';
    crushDamage?: number;
    damageReason?: string;
    applyStunOnStop?: boolean;
    stunDuration?: number;
    compareWeightClass?: boolean;
}

export interface SkillPhysicsPlan {
    kernel?: 'kinetic_pulse_v1' | 'force_only' | 'none';
    baseMomentum?: number;
    collision?: SkillCollisionPolicy;
    cascadeBehavior?: 'none' | 'kinetic_pulse';
    weightClassModifierTable?: Partial<Record<WeightClass, number>>;
    forceCoefficients?: {
        massVelocityWeight: number;
        momentumModifierWeight: number;
        distanceDivisor: number;
    };
}

interface BaseInstruction {
    id?: string;
    phase: CombatScriptPhase;
    tags?: string[];
    conditions?: SkillTargetPredicate[];
}

export interface SkillValidationMessages {
    missingTarget?: string;
    outOfRange?: string;
    noTargetActor?: string;
    friendlyTarget?: string;
    invalidTarget?: string;
}

export interface SkillPreconditionDefinition {
    kind: 'stunned';
    message: string;
    consumesTurn: boolean;
}

export interface MoveActorInstruction extends BaseInstruction {
    kind: 'MOVE_ACTOR';
    actor: RuntimeActorRef;
    destination: RuntimePointRef;
    pathRef?: RuntimePathRef;
    mode?: 'STEP' | 'LEAP' | 'SLIDE';
    presentationKind?: 'teleport' | 'jump' | 'walk' | 'dash' | 'forced_slide';
    pathStyle?: 'blink' | 'hex_step' | 'arc';
    presentationSequenceId?: string;
    effectTargetMode?: 'self' | 'actor_id';
    suppressPresentation?: boolean;
    ignoreCollision?: boolean;
    ignoreWalls?: boolean;
    ignoreGroundHazards?: boolean;
    simulatePath?: boolean;
}

export interface TeleportActorInstruction extends BaseInstruction {
    kind: 'TELEPORT_ACTOR';
    actor: RuntimeActorRef;
    destination: RuntimePointRef;
    ignoreWalls?: boolean;
    ignoreGroundHazards?: boolean;
    simulatePath?: boolean;
    presentationKind?: 'teleport' | 'jump' | 'walk' | 'dash' | 'forced_slide';
    pathStyle?: 'blink' | 'hex_step' | 'arc';
    presentationSequenceId?: string;
}

export interface ApplyForceInstruction extends BaseInstruction {
    kind: 'APPLY_FORCE';
    target: RuntimeActorRef;
    source?: RuntimePointRef;
    mode: 'push' | 'pull';
    direction?: 'source_to_target' | 'target_to_source';
    magnitude: number;
    maxDistance: number;
    collision?: SkillCollisionPolicy;
    resolveImmediately?: boolean;
}

export interface EmitPulseInstruction extends BaseInstruction {
    kind: 'EMIT_PULSE';
    origin: RuntimePointRef;
    direction: 'source_to_target' | 'target_to_source';
    magnitude: number;
    collision?: SkillCollisionPolicy;
}

export interface TraceProjectileInstruction extends BaseInstruction {
    kind: 'TRACE_PROJECTILE';
    target: 'selected_hex';
    mode: 'point_or_wall' | 'target_actor';
    stopAtWalls?: boolean;
    stopAtActors?: boolean;
}

export interface ResolveCollisionInstruction extends BaseInstruction {
    kind: 'RESOLVE_COLLISION';
    collision: SkillCollisionPolicy;
}

export interface DealDamageInstruction extends BaseInstruction {
    kind: 'DEAL_DAMAGE';
    target: RuntimeResolvedActorRef | 'selected_hex';
    amount?: number;
    resolution?: 'fixed' | 'combat';
    pointPattern?: RuntimePointPattern;
    targetFanOut?: RuntimeTargetFanOut;
    pointSet?: RuntimePointSet;
    pointFilters?: RuntimePointFilter[];
    reason?: string;
    basePower?: number;
    skillDamageMultiplier?: number;
    damageClass?: 'physical' | 'magical' | 'true';
    damageSubClass?: string;
    damageElement?: string;
    attackProfile?: CombatAttackProfile;
    trackingSignature?: TrackingSignature;
    weights?: {
        body?: number;
        mind?: number;
        instinct?: number;
    };
    theoreticalMaxPower?: number;
    includeDangerPreviewHex?: boolean;
    combatPointTargetMode?: 'proxy_actor' | 'actor_or_proxy' | 'actor_only';
    suppressReason?: boolean;
    engagementContext?: {
        distance: number;
        losOpen?: boolean;
    };
    statusMultiplierSources?: Array<{
        type: 'surface_skill_power';
        skillId: string;
    }>;
}

export interface ApplyStatusInstruction extends BaseInstruction {
    kind: 'APPLY_STATUS';
    target: RuntimeResolvedActorRef | 'selected_hex';
    status: StatusID;
    duration: number;
    pointPattern?: RuntimePointPattern;
    targetFanOut?: RuntimeTargetFanOut;
    pointSet?: RuntimePointSet;
    pointFilters?: RuntimePointFilter[];
    message?: string;
    combatPointTargetMode?: 'proxy_actor' | 'actor_or_proxy' | 'actor_only';
}

export interface HealInstruction extends BaseInstruction {
    kind: 'HEAL';
    target: RuntimeResolvedActorRef | 'selected_hex';
    amount: number;
}

export interface ApplyAilmentInstruction extends BaseInstruction {
    kind: 'APPLY_AILMENT';
    target: RuntimeResolvedActorRef | 'selected_hex';
    ailment: AilmentID;
    skillMultiplier?: number;
    baseDeposit?: number;
    pointPattern?: RuntimePointPattern;
    targetFanOut?: RuntimeTargetFanOut;
    pointSet?: RuntimePointSet;
    pointFilters?: RuntimePointFilter[];
}

export interface SetStealthInstruction extends BaseInstruction {
    kind: 'SET_STEALTH';
    target: RuntimeResolvedActorRef;
    amount: number;
}

export interface PlaceSurfaceInstruction extends BaseInstruction {
    kind: 'PLACE_SURFACE';
    surface: 'fire';
    target: RuntimePointRef;
    duration: number;
    pointPattern?: RuntimePointPattern;
    targetFanOut?: RuntimeTargetFanOut;
    pointSet?: RuntimePointSet;
    pointFilters?: RuntimePointFilter[];
}

export interface RuntimeInitialStatus {
    status: StatusID;
    duration: number;
    tickWindow?: 'START_OF_TURN' | 'END_OF_TURN';
}

export interface CompanionSpawnActorInstruction extends BaseInstruction {
    kind: 'SPAWN_ACTOR';
    spawnType: 'companion';
    companionType: string;
    owner: RuntimeActorRef;
    position: RuntimePointRef;
    summon?: SkillSummonDefinition;
    actorId?: string;
    actorIdStrategy?: 'raise_dead_skeleton_v1' | 'falcon_owner_v1';
    positionStrategy?: 'selected_point' | 'owner_adjacent_first_valid';
    placementPolicy?: 'fail' | 'push_friendly';
    anchorActorId?: string;
    anchorPoint?: Point;
    initialBehaviorOverlay?: AiBehaviorOverlayInstance;
    initialCompanionState?: {
        mode?: 'scout' | 'predator' | 'roost';
        markTarget?: string | Point;
        orbitStep?: number;
        apexStrikeCooldown?: number;
        healCooldown?: number;
        keenSight?: boolean;
        twinTalons?: boolean;
        apexPredator?: boolean;
    };
}

export interface EphemeralSpawnActorInstruction extends BaseInstruction {
    kind: 'SPAWN_ACTOR';
    spawnType: 'ephemeral_actor';
    ephemeralActorType: 'bomb';
    owner: RuntimeActorRef;
    position: RuntimePointRef;
    factionSource?: RuntimeActorRef;
    actorId?: string;
    actorIdStrategy?: 'bomb_toss_v1';
    initialStatuses?: RuntimeInitialStatus[];
}

export type SpawnActorInstruction =
    | CompanionSpawnActorInstruction
    | EphemeralSpawnActorInstruction;

export interface PickupItemInstruction extends BaseInstruction {
    kind: 'PICKUP_ITEM';
    itemType: 'spear' | 'shield';
    position?: RuntimePointRef;
}

export interface SpawnItemInstruction extends BaseInstruction {
    kind: 'SPAWN_ITEM';
    itemType: 'spear' | 'shield' | 'bomb';
    position: RuntimePointRef;
}

export interface ModifyCooldownInstruction extends BaseInstruction {
    kind: 'MODIFY_COOLDOWN';
    skillId: string;
    amount: number;
    setExact?: boolean;
}

export interface ModifyResourceInstruction extends BaseInstruction {
    kind: 'MODIFY_RESOURCE';
    target: RuntimeActorRef;
    sparkDelta: number;
    manaDelta: number;
    exhaustionDelta: number;
    actionCountDelta: number;
}

export interface RemoveCorpseInstruction extends BaseInstruction {
    kind: 'REMOVE_CORPSE';
    position: RuntimePointRef;
}

export interface PlaceTrapInstruction extends BaseInstruction {
    kind: 'PLACE_TRAP';
    position?: RuntimePointRef;
    owner: RuntimeActorRef;
    pointSet?: RuntimePointSet;
    volatileCore?: boolean;
    chainReaction?: boolean;
    resetCooldown?: number;
}

export interface RemoveTrapInstruction extends BaseInstruction {
    kind: 'REMOVE_TRAP';
    position: RuntimePointRef;
    owner?: RuntimeActorRef;
}

export interface SetTrapCooldownInstruction extends BaseInstruction {
    kind: 'SET_TRAP_COOLDOWN';
    position: RuntimePointRef;
    cooldown: number;
    owner?: RuntimeActorRef;
}

export interface UpdateCompanionStateInstruction extends BaseInstruction {
    kind: 'UPDATE_COMPANION_STATE';
    target: RuntimeActorRef;
    mode?: 'scout' | 'predator' | 'roost';
    markTarget?: string | RuntimePointRef | 'target_actor_id' | null;
    orbitStep?: number;
    apexStrikeCooldown?: number;
    healCooldown?: number;
    keenSight?: boolean;
    twinTalons?: boolean;
    apexPredator?: boolean;
}

export interface UpdateBehaviorStateInstruction extends BaseInstruction {
    kind: 'UPDATE_BEHAVIOR_STATE';
    target: RuntimeActorRef;
    overlays?: AiBehaviorOverlayInstance[];
    anchorActorId?: string | null;
    anchorActorRef?: RuntimeResolvedActorRef | null;
    anchorPoint?: Point | RuntimePointRef | null;
    goal?: GenericAiGoal | null;
    controller?: 'manual' | 'generic_ai' | null;
    clearOverlays?: boolean;
}

export interface MessageInstruction extends BaseInstruction {
    kind: 'MESSAGE';
    text: string;
    format?: 'static' | 'movement_summary' | 'attack_summary';
    actor?: RuntimeActorRef;
    targetActor?: RuntimeResolvedActorRef | 'selected_hex';
    pointSet?: RuntimePointSet;
    pointPattern?: RuntimePointPattern;
    targetFanOut?: RuntimeTargetFanOut;
    pointFilters?: RuntimePointFilter[];
    actionVerb?: string;
    includeResolvedRange?: boolean;
    emitEffect?: boolean;
    recordMessage?: boolean;
}

export interface EmitJuiceInstruction extends BaseInstruction {
    kind: 'EMIT_JUICE';
    effect: JuiceEffectID;
    target?: RuntimePointRef;
    targetActor?: RuntimeResolvedActorRef;
    pointSet?: RuntimePointSet;
    pathRef?: RuntimePathRef;
    intensity?: 'low' | 'medium' | 'high' | 'extreme';
    direction?: Point;
    directionRef?: RuntimePointRef;
    directionPathRef?: RuntimePathRef;
    text?: string;
    duration?: number;
    color?: string;
    contactHexRef?: RuntimePointRef;
    contactToRef?: RuntimePointRef;
    contactFromRef?: RuntimePointRef;
    contactFromPathRef?: RuntimePathRef;
    metadata?: Record<string, unknown>;
}

export type CombatScriptInstruction =
    | MoveActorInstruction
    | TeleportActorInstruction
    | ApplyForceInstruction
    | EmitPulseInstruction
    | TraceProjectileInstruction
    | ResolveCollisionInstruction
    | DealDamageInstruction
    | ApplyStatusInstruction
    | HealInstruction
    | ApplyAilmentInstruction
    | SetStealthInstruction
    | PlaceSurfaceInstruction
    | SpawnActorInstruction
    | SpawnItemInstruction
    | PickupItemInstruction
    | ModifyCooldownInstruction
    | ModifyResourceInstruction
    | RemoveCorpseInstruction
    | PlaceTrapInstruction
    | RemoveTrapInstruction
    | SetTrapCooldownInstruction
    | UpdateCompanionStateInstruction
    | UpdateBehaviorStateInstruction
    | EmitJuiceInstruction
    | MessageInstruction;

export interface RuntimeNumericPatch {
    path: string;
    op: 'set' | 'add' | 'multiply';
    value: number;
}

export interface RuntimeInstructionPatch {
    instructionId: string;
    path: string;
    op: 'set' | 'add' | 'multiply';
    value: number | boolean | string;
}

export interface SkillRuntimeUpgradeDefinition {
    id: string;
    name: string;
    description: string;
    when?: SkillTargetPredicate[];
    addKeywords?: string[];
    removeKeywords?: string[];
    modifyNumbers?: RuntimeNumericPatch[];
    instructionPatches?: RuntimeInstructionPatch[];
    addInstructions?: CombatScriptInstruction[];
}

export interface SkillTargetingVariant {
    when: SkillTargetPredicate[];
    targeting: Partial<SkillTargetingDefinition>;
    movementPolicy?: Partial<RuntimeMovementPolicy>;
}

export interface SkillPresentationVariant {
    when: SkillTargetPredicate[];
    name?: string;
    description?: string;
    icon?: string;
}

export interface SkillHandlerRefs {
    presentation?: string;
    execution?: string;
    targeting?: string;
    capability?: string;
}

export type RuntimeCapabilityStat = 'body' | 'mind' | 'instinct';

export interface RuntimeInformationCapabilityProviderDefinition {
    domain: 'information';
    providerId: string;
    priority: number;
    kind: 'basic_reveal_v1' | 'combat_analysis_v1' | 'tactical_insight_v1' | 'oracle_sight_v1';
    reveal: Partial<InformationRevealFlags>;
    minViewerStat?: {
        stat: RuntimeCapabilityStat;
        minimum: number;
    };
    requireTopActionUtilities?: boolean;
}

export interface RuntimeSenseCapabilityProviderDefinition {
    domain: 'senses';
    providerId: string;
    priority: number;
    kind: 'standard_vision_los_v1' | 'enemy_awareness_los_v1' | 'vibration_sense_motion_v1';
    channelId: string;
    range: {
        base: number;
        minimum: number;
        maximum: number;
        stat?: RuntimeCapabilityStat;
        divisor?: number;
        addVisionTier?: boolean;
    };
    requireEnemyObserver?: boolean;
    hardBlockWhenBlind?: boolean;
    useLegacyLineOfSight?: boolean;
}

export interface RuntimeMovementCapabilityProviderDefinition {
    domain: 'movement';
    providerId: string;
    priority: number;
    kind: 'flight_replace_v1' | 'burrow_extend_v1' | 'phase_step_replace_v1' | 'blind_fighting_unseen_penalty_v1';
    resolutionMode: 'EXTEND' | 'REPLACE';
    model: {
        pathing?: 'walk' | 'flight' | 'teleport';
        ignoreGroundHazards?: boolean;
        ignoreWalls?: boolean;
        allowPassThroughActors?: boolean;
        rangeModifier?: number;
        unseenAttackPenaltyMultiplier?: number;
    };
}

export interface SkillCapabilityAuthoringSet {
    senses?: RuntimeSenseCapabilityProviderDefinition[];
    information?: RuntimeInformationCapabilityProviderDefinition[];
    movement?: RuntimeMovementCapabilityProviderDefinition[];
}

export interface SkillRuntimeDefinition {
    id: string;
    name: string;
    description: string;
    slot: SkillSlot;
    icon: string;
    keywords: string[];
    baseVariables: {
        range: number;
        cost: number;
        cooldown: number;
        basePower?: number;
        damage?: number;
        momentum?: number;
    };
    combat?: SkillDefinition['combat'];
    targeting: SkillTargetingDefinition;
    validationMessages?: SkillValidationMessages;
    preconditions?: SkillPreconditionDefinition[];
    targetingVariants?: SkillTargetingVariant[];
    presentationVariants?: SkillPresentationVariant[];
    movementPolicy?: RuntimeMovementPolicy;
    combatScript: CombatScriptInstruction[];
    intentProfile?: SkillIntentProfile;
    resourceProfile?: SkillResourceProfile;
    metabolicBandProfile?: SkillMetabolicBandProfile;
    physicsPlan?: SkillPhysicsPlan;
    summon?: SkillSummonDefinition;
    capabilities?: SkillCapabilityAuthoringSet;
    upgrades: Record<string, SkillRuntimeUpgradeDefinition>;
    handlerRefs?: SkillHandlerRefs;
    deathDecalVariant?: 'blood' | 'bones';
    sourcePath: string;
    compiledFrom: 'json';
}

export type SkillAuthoringDefinition = Omit<SkillRuntimeDefinition, 'compiledFrom' | 'sourcePath'>;

export interface ResolvedTargetingDefinition extends SkillTargetingDefinition {
    deterministicSort: DeterministicSortMode;
}

export interface ResolvedSkillRuntime {
    runtime: SkillRuntimeDefinition;
    activeUpgradeIds: string[];
    resolvedKeywords: string[];
    targeting: ResolvedTargetingDefinition;
    movementPolicy?: RuntimeMovementPolicy;
    combatScript: CombatScriptInstruction[];
    physicsPlan: SkillPhysicsPlan;
    trace: ResolutionTrace;
}

export interface SkillExecutionWithRuntimeResult extends SkillExecutionResult {
    resolvedRuntime: ResolvedSkillRuntime;
    executionTrace: ResolutionTrace;
}

export interface SkillRuntimeMetadataEntry {
    id: string;
    name: string;
    sourcePath: string;
    slot: SkillSlot;
    keywords: string[];
    targetGenerator: TargetGeneratorKind;
    phases: CombatScriptPhase[];
    instructionKinds: CombatScriptInstruction['kind'][];
    hasPhysicsPlan: boolean;
    handlerRefs: SkillHandlerRefs;
}

export interface SkillLibraryMetadata {
    generatedAt: string;
    totalSkills: number;
    handlerBackedSkillCount: number;
    executionHandlerCount: number;
    capabilityHandlerCount: number;
    targetingHandlerCount: number;
    presentationHandlerCount: number;
    handlerRatio: number;
    handlerBudgetRatio: number;
    handlerBudgetExceeded: boolean;
    skills: SkillRuntimeMetadataEntry[];
}

export interface RuntimeExecutionHandlerContext {
    definition: SkillRuntimeDefinition;
    resolved: ResolvedSkillRuntime;
    state: GameState;
    attacker: Actor;
    target?: Point;
}

export type RuntimeExecutionHandler = (context: RuntimeExecutionHandlerContext) => SkillExecutionWithRuntimeResult;

export type RuntimeTargetingHandler = (context: {
    definition: SkillRuntimeDefinition;
    state: GameState;
    attacker: Actor;
}) => Point[];
