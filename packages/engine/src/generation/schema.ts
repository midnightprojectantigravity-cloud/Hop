import type { FloorTheme } from '../types';

export type AuthoringBinding = 'hard' | 'soft';

export type RelaxableFeature =
    | 'ALLOW_TOPOLOGY_EDGE_REWIRE'
    | 'ALLOW_CHOKE_WIDENING'
    | 'ALLOW_FLANK_INSERTION'
    | 'ALLOW_GASKET_RESHAPE'
    | 'ALLOW_MODULE_SWAP'
    | 'ALLOW_ENEMY_RELOCATION'
    | 'ALLOW_HAZARD_BUDGET_REDUCTION'
    | 'ALLOW_LOCAL_TILE_CARVE'
    | 'ALLOW_RESET_ZONE_EXPANSION';

export type GenerationMapShape = 'diamond' | 'rectangle';

export type ClaimKind =
    | 'los_corridor'
    | 'movement_corridor'
    | 'gasket_opening'
    | 'reset_access'
    | 'choke_visibility';

export type SpatialClaimHardness = 'hard' | 'soft';

export type CompilerPass =
    | 'normalizeSpec'
    | 'accumulateFloorTelemetry'
    | 'quantizeFloorOutcome'
    | 'updateRunDirectorState'
    | 'resolveFloorIntent'
    | 'resolveNarrativeSceneRequest'
    | 'buildTopologicalBlueprint'
    | 'reserveSpatialBudget'
    | 'emitPathProgram'
    | 'embedSpatialPlan'
    | 'resolveModulePlan'
    | 'registerSpatialClaims'
    | 'realizeArenaArtifact'
    | 'realizeSceneEvidence'
    | 'closeUnresolvedGaskets'
    | 'classifyPathLandmarks'
    | 'buildTacticalPathNetwork'
    | 'buildVisualPathNetwork'
    | 'applyEnvironmentalPressure'
    | 'verifyArenaArtifact'
    | 'finalizeGenerationState';

export type GasketClosureState =
    | 'open_required'
    | 'open_optional'
    | 'closed_solid'
    | 'closed_void';

export type VerificationSeverity = 'info' | 'warning' | 'error';

export type PathMembership = 'main' | 'hidden';
export type RouteTopologyMode = 'single' | 'dual_route' | 'dual_route_pre_arena' | 'arena_single';
export type RouteMembership = 'primary' | 'alternate' | 'shared' | 'hidden';
export type EnvironmentalTrapKind = 'snare_surface' | 'fire_surface';
export type RouteRiskBias = 'none' | 'soft' | 'strong';

export interface RouteProfile {
    mode: RouteTopologyMode;
    minRouteCount: number;
    maxStraightRun: number;
    minBranchSeparationTiles: number;
    rejoinBeforeExit: boolean;
    obstacleClusterBudget: number;
    trapClusterBudget: number;
    lavaClusterBudget: number;
    saferRouteBias: RouteRiskBias;
    riskierRouteBias: RouteRiskBias;
}

export interface GenerationPoint {
    q: number;
    r: number;
    s: number;
}

export interface LocalHex {
    dq: number;
    dr: number;
}

export interface ParityConstraint {
    requiredParity: 'even' | 'odd' | 'flexible';
}

export interface ClosedPathRequirement extends ParityConstraint {
    id: string;
    entryAnchorId: string;
    exitAnchorId: string;
    requiredLength: number;
    flexibleLoop?: boolean;
}

export interface ParityManhattanOffset {
    distance: number;
    pathParity: 'even' | 'odd';
    requiresWiggle: boolean;
    wiggleHexes: number;
}

export interface SpatialClaim {
    id: string;
    kind: ClaimKind;
    hardness: SpatialClaimHardness;
    sourceModuleId?: string;
    from: GenerationPoint;
    to: GenerationPoint;
    cells: GenerationPoint[];
}

export interface ConflictTriple {
    authoredId: string;
    constraintType: string;
    spatialContext: {
        hexes: GenerationPoint[];
        anchorIds?: string[];
    };
}

export interface NarrativeAnchor {
    id: string;
    kind: string;
    point: GenerationPoint;
    onPath?: boolean;
}

export interface EvidencePlacement {
    id: string;
    tag: string;
    point: GenerationPoint;
}

export interface SceneSignature {
    sceneId: string;
    motif: string;
    mood: string;
    encounterPosture: string;
    primaryEvidence: string;
    secondaryEvidence?: string;
    hostileRosterDescriptor: string;
    terrainDescriptor: string;
    spatialDescriptor: string;
}

export interface RunTelemetryCounters {
    damageTaken: number;
    healingReceived: number;
    forcedDisplacementsTaken: number;
    controlIncidents: number;
    hazardDamageEvents: number;
    sparkSpent: number;
    sparkRecovered: number;
    manaSpent: number;
    manaRecovered: number;
    exhaustionGained: number;
    exhaustionCleared: number;
    sparkBurnHpLost: number;
    redlineActions: number;
    exhaustedTurns: number;
    sparkOutageBlocks: number;
    manaOutageBlocks: number;
    restTurns: number;
    actionsTaken: number;
}

export interface FloorTelemetryAccumulator {
    floor: number;
    baselineTurnsSpent: number;
    baselineHazardBreaches: number;
    baselineKills: number;
    baselineCombatEventCount: number;
    baselinePlayerHp: number;
    baselinePlayerMaxHp: number;
    baselineRunTelemetry: RunTelemetryCounters;
}

export interface FloorOutcomeBuckets {
    completionPace: number;
    resourceStress: number;
    hazardPressure: number;
    controlStability: number;
    combatDominance: number;
    recoveryUse: number;
}

export interface FloorOutcomeSnapshot {
    floorIndex: number;
    snapshotId: string;
    bucketIds: FloorOutcomeBuckets;
}

export interface OutcomeHistoryQueueEntry extends FloorOutcomeSnapshot {}

export type OutcomeHistoryQueue = OutcomeHistoryQueueEntry[];

export interface NarrativeMemoryState {
    recentSceneIds: string[];
    motifCounts: Record<string, number>;
    evidenceCounts: Record<string, number>;
}

export interface DirectorState {
    tensionBand: number;
    fatigueBand: number;
    resourceStressBand: number;
    hazardPressureBand: number;
    combatDominanceBand: number;
    recoveryBand: number;
    redlineBand: number;
    noveltyDebt: number;
    narrativeMemory: NarrativeMemoryState;
}

export interface FloorIntentRequest {
    floor: number;
    role: 'onboarding' | 'pressure_spike' | 'recovery' | 'elite' | 'boss';
    theme: string;
    board: {
        width: number;
        height: number;
        mapShape: GenerationMapShape;
    };
    requiredTacticalTags: string[];
    forbiddenTacticalTags: string[];
    requiredNarrativeTags: string[];
    chokeRatioBps: number;
    flankDemand: number;
    perchDemand: number;
    hazardLureDemand: number;
    resetBudget: number;
    parTurnTarget: number;
    routeProfile: RouteProfile;
}

export interface NarrativeSceneRequest {
    motif: string;
    mood: string;
    evidenceQuota: number;
    encounterPosture: string;
}

export interface BlueprintSlot {
    id: string;
    kind: string;
    requiredTacticalTags: string[];
    requiredNarrativeTags: string[];
    preferredAnchorKind: 'center' | 'upper' | 'lower' | 'left' | 'right';
    adjacencyIds: string[];
    onPathDefault: boolean;
    pathOrderDefault: number;
}

export interface TopologicalBlueprint {
    floor: number;
    role: FloorIntentRequest['role'];
    theme: string;
    slots: BlueprintSlot[];
    closedPaths: ClosedPathRequirement[];
}

export interface SpatialBudget {
    freeCellsByParity: {
        even: number;
        odd: number;
    };
    connectorSeatsByParity: {
        even: number;
        odd: number;
    };
    loopCandidateAnchorsByParity: {
        even: string[];
        odd: string[];
    };
    pinnedFootprints: string[];
    closedPathOffsets: Record<string, ParityManhattanOffset>;
}

export interface SpatialSlotPlacement {
    slotId: string;
    anchor: GenerationPoint;
}

export interface SpatialPlan {
    slotPlacements: SpatialSlotPlacement[];
    anchorById: Record<string, GenerationPoint>;
    gasketAnchors: Record<string, GenerationPoint>;
    mainLandmarkIds: string[];
    primaryLandmarkIds: string[];
    alternateLandmarkIds: string[];
    hiddenLandmarkIds: string[];
}

export interface ModuleTileStamp {
    dq: number;
    dr: number;
    baseId: 'STONE' | 'WALL' | 'LAVA' | 'VOID' | 'HAZARD';
}

export interface ModuleEnemySeed {
    dq: number;
    dr: number;
    subtype: string;
}

export interface ModuleGasketSeat {
    id: string;
    dq: number;
    dr: number;
    direction: number;
    state: GasketClosureState;
}

export interface ModuleSpatialClaimTemplate {
    id: string;
    kind: ClaimKind;
    hardness: SpatialClaimHardness;
    from: LocalHex;
    to: LocalHex;
}

export interface ModuleCollisionMask {
    keys: string[];
    signature: string;
}

export interface ModuleCapabilitySignature {
    tacticalTags: string[];
    narrativeTags: string[];
    moodTags: string[];
    evidenceTags: string[];
    encounterPostures: string[];
    sceneRoles: string[];
    anchorKinds: string[];
    forbiddenNeighborTags: string[];
}

export interface ModuleRegistryEntry {
    id: string;
    theme: string;
    binding?: AuthoringBinding;
    footprint: LocalHex[];
    tileStamps: ModuleTileStamp[];
    enemySeeds?: ModuleEnemySeed[];
    gaskets?: ModuleGasketSeat[];
    claimTemplates?: ModuleSpatialClaimTemplate[];
    capability: ModuleCapabilitySignature;
    collisionMask: ModuleCollisionMask;
}

export interface ModuleRegistrySnapshot {
    registryVersion: string;
    specSchemaVersion: string;
    moduleCount: number;
    modules: Array<{
        id: string;
        theme: string;
        collisionSignature: string;
    }>;
}

export interface IndexedModuleRegistryEntry extends ModuleRegistryEntry {
    tacticalMask: bigint;
    narrativeMask: bigint;
    moodMask: bigint;
    evidenceMask: bigint;
    encounterMask: bigint;
    sceneRoleMask: bigint;
    anchorMask: bigint;
    forbiddenNeighborMask: bigint;
    constraintDensityScore: number;
    equivalenceKey: string;
}

export interface ModuleEquivalenceClass {
    id: string;
    moduleIds: string[];
    collisionSignature: string;
    representativeId: string;
}

export interface ModuleRegistryIndex {
    registryVersion: string;
    specSchemaVersion: string;
    entries: IndexedModuleRegistryEntry[];
    entriesById: Record<string, IndexedModuleRegistryEntry>;
    equivalenceClasses: ModuleEquivalenceClass[];
    snapshot: ModuleRegistrySnapshot;
}

export interface ModulePlacement {
    moduleId: string;
    slotId: string;
    anchor: GenerationPoint;
    footprintKeys: string[];
    onPath: boolean;
}

export interface ModulePlan {
    placements: ModulePlacement[];
}

export interface AuthoredPathOverride {
    onPath?: boolean;
    pathOrder?: number;
    routeHint?: Exclude<RouteMembership, 'shared'>;
}

export interface PathLandmark {
    id: string;
    kind: 'start' | 'exit' | 'shrine' | 'module' | 'logic_anchor';
    point: GenerationPoint;
    sourceId?: string;
    onPath: boolean;
    routeMembership: RouteMembership;
    reachable: boolean;
    orderHint: number;
}

export interface PathEdge {
    fromKey: string;
    toKey: string;
}

export interface PathSegment {
    id: string;
    fromLandmarkId: string;
    toLandmarkId: string;
    tileKeys: string[];
    edges: PathEdge[];
    kind: 'primary' | 'alternate' | 'connector' | 'spur';
    routeMembership: Exclude<RouteMembership, 'hidden'>;
}

export interface EnvironmentalPressureCluster {
    id: string;
    kind: 'obstacle' | 'trap' | 'lava';
    routeMembership: Exclude<RouteMembership, 'hidden'>;
    tileKeys: string[];
    trapKind?: EnvironmentalTrapKind;
}

export interface GeneratedPathNetwork {
    landmarks: PathLandmark[];
    tacticalTileKeys: string[];
    tacticalEdges: PathEdge[];
    visualTileKeys: string[];
    visualEdges: PathEdge[];
    segments: PathSegment[];
    routeCount: number;
    junctionTileKeys: string[];
    maxStraightRun: number;
    environmentalPressureClusters: EnvironmentalPressureCluster[];
}

export interface PathSummary {
    mainLandmarkIds: string[];
    primaryLandmarkIds: string[];
    alternateLandmarkIds: string[];
    hiddenLandmarkIds: string[];
    routeCount: number;
    junctionCount: number;
    maxStraightRun: number;
    obstacleClusterCount: number;
    trapClusterCount: number;
    lavaClusterCount: number;
    tacticalTileCount: number;
    visualTileCount: number;
}

export interface CurrentFloorSummary {
    floor: number;
    role: FloorIntentRequest['role'];
    theme: string;
    floorFamilyId?: string;
    parTurnTarget: number;
    moduleIds: string[];
    directorEntropyKey?: string;
    sceneSignature: SceneSignature;
    pathSummary: PathSummary;
    verificationDigest: string;
    artifactDigest: string;
}

export interface VerificationReport {
    stage: CompilerPass;
    code: string;
    severity: VerificationSeverity;
    conflict?: ConflictTriple;
    sceneSignature?: SceneSignature;
    suggestedRelaxations?: RelaxableFeature[];
    diagnostics: string[];
}

export interface GenerationFailure {
    stage: CompilerPass;
    code: string;
    severity: VerificationSeverity;
    conflict: ConflictTriple;
    sceneSignature?: SceneSignature;
    suggestedRelaxations?: RelaxableFeature[];
    diagnostics: string[];
}

export interface CompilerBudgetProfile {
    yieldEveryOps: number;
    maxClassAssignments: number;
    maxBacktracks: number;
    maxArcRevisions: number;
}

export interface CompilerSessionInput {
    floor: number;
    seed: string;
    options?: {
        gridWidth?: number;
        gridHeight?: number;
        mapShape?: GenerationMapShape;
        theme?: FloorTheme;
        contentTheme?: FloorTheme;
        generationSpec?: GenerationSpecInput;
        generationState?: GenerationState;
    };
}

export interface CompilerProgress {
    pass: CompilerPass;
    percent: number;
}

export interface CompilerStepResult {
    done: boolean;
    pass: CompilerPass;
    progress: CompilerProgress;
}

export interface CompilerSessionState {
    input: CompilerSessionInput;
    currentPass: CompilerPass;
    intent?: FloorIntentRequest;
    sceneRequest?: NarrativeSceneRequest;
    blueprint?: TopologicalBlueprint;
    spatialBudget?: SpatialBudget;
    spatialPlan?: SpatialPlan;
    modulePlan?: ModulePlan;
    claims?: SpatialClaim[];
    pathNetwork?: GeneratedPathNetwork;
    pathDiagnostics?: string[];
    artifact?: CompiledFloorArtifact;
    verificationReport?: VerificationReport;
    failure?: GenerationFailure;
}

export interface CompilerSessionResult {
    artifact: CompiledFloorArtifact;
    debugSnapshot?: GenerationDebugSnapshot;
    generationState: GenerationState;
    verificationReport: VerificationReport;
    failure?: GenerationFailure;
}

export interface CompilerSession {
    step(maxOps?: number): CompilerStepResult;
    isComplete(): boolean;
    getProgress(): CompilerProgress;
    getResult(): CompilerSessionResult | undefined;
    getDebugSnapshot(): GenerationDebugSnapshot | undefined;
}

export interface AuthoredPlacedModule {
    id: string;
    anchor: GenerationPoint;
    binding?: AuthoringBinding;
}

export type AuthoredAnchorMap = Record<string, GenerationPoint>;

export interface AuthoredFloorSpec {
    binding?: AuthoringBinding;
    role?: FloorIntentRequest['role'];
    theme?: string;
    floorFamilyId?: string;
    preferredModuleIds?: string[];
    blockedModuleIds?: string[];
    requiredTacticalTags?: string[];
    requiredNarrativeTags?: string[];
    anchors?: AuthoredAnchorMap;
    pinnedModules?: AuthoredPlacedModule[];
    tileStamps?: ModuleTileStamp[];
    enemySeeds?: Array<GenerationPoint & { subtype: string }>;
    closedPaths?: ClosedPathRequirement[];
    pathOverrides?: Record<string, AuthoredPathOverride>;
}

export interface AuthoredFloorFamilySpec extends AuthoredFloorSpec {
    id?: string;
}

export interface GenerationSpecInput {
    binding?: AuthoringBinding;
    registryVersion?: string;
    relaxations?: RelaxableFeature[];
    authoredFloorFamilies?: Record<string, AuthoredFloorFamilySpec>;
    floorFamilyAssignments?: Record<number, string>;
    authoredFloors?: Record<number, AuthoredFloorSpec>;
}

export interface GenerationSpecLintFinding {
    code:
        | 'SPEC_UNKNOWN_ANCHOR'
        | 'SPEC_MODULE_CAPABILITY_MISMATCH'
        | 'SPEC_PARITY_STRESS'
        | 'SPEC_FOOTPRINT_OUT_OF_BOUNDS'
        | 'SPEC_PATH_OVERRIDE_UNKNOWN_TARGET'
        | 'SPEC_PATH_OVERRIDE_CONFLICT';
    severity: VerificationSeverity;
    message: string;
    familyId?: string;
    floor?: number;
    anchorIds?: string[];
    hexes?: GenerationPoint[];
}

export interface GenerationDebugSnapshot {
    intent: FloorIntentRequest;
    sceneRequest: NarrativeSceneRequest;
    blueprint: TopologicalBlueprint;
    spatialBudget: SpatialBudget;
    spatialPlan: SpatialPlan;
    modulePlan: ModulePlan;
    claims: SpatialClaim[];
    pathNetwork: GeneratedPathNetwork;
    pathDiagnostics: string[];
    sceneSignature: SceneSignature;
    verificationReport: VerificationReport;
    failure?: GenerationFailure;
}

export interface EnemySpawnArtifact {
    id: string;
    subtype: string;
    position: GenerationPoint;
}

export interface ArtifactTileEffectEntry {
    key: string;
    effects: Array<{
        id: string;
        duration: number;
        potency: number;
    }>;
}

export interface CompiledFloorArtifact {
    mode: 'start_run' | 'floor_transition';
    runSeed: string;
    loadoutId?: string;
    runMode?: 'normal' | 'daily';
    runDate?: string;
    rulesetOverrides?: Record<string, unknown>;
    floor: number;
    theme: string;
    contentTheme?: string;
    gridWidth: number;
    gridHeight: number;
    mapShape: GenerationMapShape;
    playerSpawn: GenerationPoint;
    stairsPosition: GenerationPoint;
    shrinePosition?: GenerationPoint;
    tileBaseIds: Uint8Array;
    tileEffects?: ArtifactTileEffectEntry[];
    enemySpawns: EnemySpawnArtifact[];
    rooms: Array<{
        id: string;
        type: 'entrance' | 'combat' | 'treasure' | 'corridor' | 'boss' | 'secret';
        center: GenerationPoint;
        hexes: GenerationPoint[];
        connections: string[];
    }>;
    generationDelta: GenerationState;
    modulePlacements: ModulePlacement[];
    logicAnchors: NarrativeAnchor[];
    pathNetwork: GeneratedPathNetwork;
    verificationDigest: string;
    artifactDigest: string;
    debugSnapshot?: GenerationDebugSnapshot;
}

export interface StartRunCompileContext {
    loadoutId: string;
    seed?: string;
    mode?: 'normal' | 'daily';
    date?: string;
    mapSize?: { width: number; height: number };
    mapShape?: GenerationMapShape;
    themeId?: FloorTheme;
    contentThemeId?: FloorTheme;
    rulesetOverrides?: Record<string, unknown>;
    generationSpec?: GenerationSpecInput;
    includeDebug?: boolean;
}

export interface TransitionCompileContext {
    floor: number;
    initialSeed?: string;
    rngSeed?: string;
    mapSize: { width: number; height: number };
    mapShape: GenerationMapShape;
    themeId?: FloorTheme;
    contentThemeId?: FloorTheme;
    playerCarryover: {
        hp: number;
        maxHp: number;
        upgrades: string[];
        activeSkills: unknown[];
        archetype?: string;
        kills?: number;
        environmentalKills?: number;
        turnsSpent?: number;
        hazardBreaches?: number;
        combatScoreEvents?: unknown[];
        dailyRunDate?: string;
        runObjectives?: unknown[];
    };
    ruleset?: Record<string, unknown>;
    runTelemetry: RunTelemetryCounters;
    generationState: GenerationState;
    migratingCompanions?: unknown[];
    includeDebug?: boolean;
}

export interface GenerationState {
    runSeed: string;
    specHash: string;
    directorEntropyKey?: string;
    spec?: GenerationSpecInput;
    currentFloorIndex: number;
    directorState: DirectorState;
    currentTelemetry: FloorTelemetryAccumulator;
    currentFloorSummary?: CurrentFloorSummary;
    recentOutcomeQueue: OutcomeHistoryQueue;
    artifactDigest?: string;
    sceneSignatureHistory: SceneSignature[];
}
