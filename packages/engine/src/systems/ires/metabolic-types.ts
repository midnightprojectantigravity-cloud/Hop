export type MetabolicActorState = 'rested' | 'base' | 'exhausted';
export type MetabolicPrimaryResource = 'spark' | 'mana' | 'none';
export type MetabolicWeightClass = 'Light' | 'Standard' | 'Heavy';
export type MetabolicActionKind = 'movement' | 'attack' | 'cast' | 'hybrid' | 'rest';
export type MetabolicResourceMode = 'spark_only' | 'mana_only' | 'hybrid' | 'none';

export interface LinearStatFormula {
    base: number;
    bodyScale: number;
    mindScale: number;
    instinctScale: number;
    rounding: 'floor' | 'ceil' | 'round' | 'none';
    min?: number;
    max?: number;
}

export interface ClampedInstinctDiscountFormula {
    baseMultiplier: number;
    instinctScale: number;
    minMultiplier: number;
    maxMultiplier: number;
}

export type MetabolicActionBandId =
    | 'maintenance'
    | 'light'
    | 'standard'
    | 'heavy'
    | 'redline';

export interface MetabolicActionBand {
    id: MetabolicActionBandId;
    sparkCost: number;
    manaCost: number;
    baseExhaustion: number;
    description: string;
    intendedUse: 'sustainable' | 'repeatable' | 'committed' | 'burst' | 'crisis';
}

export type MetabolicActionClassId =
    | 'BASIC_MOVE'
    | 'DASH'
    | 'JUMP'
    | 'VAULT'
    | 'WITHDRAWAL'
    | 'PHASE_STEP'
    | 'FIREWALK'
    | 'SHADOW_STEP'
    | 'spark_attack_light'
    | 'spark_attack_standard'
    | 'spark_attack_heavy'
    | 'mana_cast_light'
    | 'mana_cast_standard'
    | 'mana_cast_heavy'
    | 'rest';

export interface MetabolicActionClass {
    id: MetabolicActionClassId;
    kind: MetabolicActionKind;
    bandId: MetabolicActionBandId;
    resourceMode: MetabolicResourceMode;
    countsAsMovement: boolean;
    countsAsAction: boolean;
    beatEventDelta: number;
    travelEligible?: boolean;
    movementSkillFamily?: 'basic' | 'dash' | 'jump' | 'vault' | 'blink' | 'hybrid';
    sparkCostOffset?: number;
    manaCostOffset?: number;
    baseExhaustionOffset?: number;
}

export interface MetabolicWorkloadTurn {
    actions: MetabolicActionClassId[];
}

export interface MetabolicRestRule {
    maxProjectedExhaustionBeforeRest: number;
    minSparkBeforeRest: number;
    minManaBeforeRest: number;
}

export type MetabolicWorkloadId =
    | 'move_only_battle'
    | 'move_only_travel'
    | 'stationary_spark_attack'
    | 'stationary_mana_cast'
    | 'move_then_attack'
    | 'move_then_cast'
    | 'dash_then_attack'
    | 'jump_then_attack'
    | 'hybrid_escape'
    | 'blink_cast_cycle'
    | 'heavy_mind_battleline'
    | 'instinct_burst'
    | 'basic_move_x1'
    | 'basic_move_x2'
    | 'basic_move_x3'
    | 'basic_move_then_standard_attack'
    | 'basic_move_then_standard_cast'
    | 'wait_loop'
    | 'instinct_move_burst';

export interface MetabolicWorkload {
    id: MetabolicWorkloadId;
    label: string;
    mode: 'battle' | 'travel';
    turns: MetabolicWorkloadTurn[];
    repeat: boolean;
    restRule: MetabolicRestRule;
}

export interface MetabolicStatProfile {
    id: string;
    label: string;
    body: number;
    mind: number;
    instinct: number;
    weightClass: MetabolicWeightClass;
}

export interface MetabolicDerivedStats {
    maxSpark: number;
    maxMana: number;
    sparkRecoveryPerTurn: number;
    manaRecoveryPerTurn: number;
    baseBfi: number;
    effectiveBfi: number;
    sparkEfficiencyMultiplier: number;
    exhaustionBleedByState: Record<MetabolicActorState, number>;
}

export interface MetabolicSimulationState {
    spark: number;
    maxSpark: number;
    mana: number;
    maxMana: number;
    exhaustion: number;
    isExhausted: boolean;
    currentState: MetabolicActorState;
}

export interface MetabolicTurnTrace {
    turn: number;
    workloadTurnIndex: number;
    mode: 'battle' | 'travel';
    actionsPlanned: MetabolicActionClassId[];
    actionsExecuted: MetabolicActionClassId[];
    rested: boolean;
    state: MetabolicActorState;
    spark: number;
    mana: number;
    exhaustion: number;
    immediateBurnTriggered: boolean;
}

export interface MetabolicCadenceResult {
    profileId: string;
    workloadId: MetabolicWorkloadId;
    turnsSimulated: number;
    avgActionsPerTurnOpening3: number;
    avgActionsPerTurnOpening5: number;
    firstRestTurn: number | null;
    avgTurnsBetweenRests: number | null;
    avgTurnsBetweenBonusActions: number | null;
    peakExhaustionOpening5: number;
    enteredExhaustedByTurn5: boolean;
    firstImmediateBurnTurn: number | null;
    firstFailureMode: 'spark' | 'mana' | 'exhaustion' | 'none';
    sparkSpentOnMovementOpening5: number;
    sparkSpentOnNonMovementOpening5: number;
    manaSpentOpening5: number;
    movementShareOfSparkSpend: number;
    sparkRemainingTurnByTurn: number[];
    manaRemainingTurnByTurn: number[];
    exhaustionTurnByTurn: number[];
    stateTurnByTurn: MetabolicActorState[];
    turnTrace: MetabolicTurnTrace[];
}

export interface MetabolicTargetOutcome {
    id: string;
    score: number;
    passed: boolean;
    details: string;
}

export interface MetabolicSensitivityResult {
    id: string;
    label: string;
    deltaAvgActionsPerTurnOpening5: number;
    deltaFirstRestTurn: number;
    deltaPeakExhaustionOpening5: number;
    mostAffectedProfiles: string[];
}

export interface MetabolicSearchCandidate {
    id: string;
    label: string;
    totalScore: number;
    config: IresMetabolicConfig;
    targetOutcomes: MetabolicTargetOutcome[];
}

export interface MetabolicAnalysisReport {
    generatedAt: string;
    config: IresMetabolicConfig;
    profileMatrix: MetabolicStatProfile[];
    results: MetabolicCadenceResult[];
    targetOutcomes: MetabolicTargetOutcome[];
    sensitivity: MetabolicSensitivityResult[];
    recommendedNextCandidateChanges: string[];
}

export interface IresMetabolicConfig {
    version: 'ires-metabolism-v6';
    sparkPoolFormula: LinearStatFormula;
    manaPoolFormula: LinearStatFormula;
    sparkRecoveryFormula: LinearStatFormula;
    manaRecoveryFormula: LinearStatFormula;
    baseBfiFormula: LinearStatFormula;
    sparkEfficiencyFormula: ClampedInstinctDiscountFormula;
    exhaustionBleedByState: {
        rested: LinearStatFormula;
        base: LinearStatFormula;
        exhausted: LinearStatFormula;
    };
    waitSparkBonus: number;
    waitExhaustionBonus: number;
    enterExhaustedAt: number;
    exitExhaustedBelow: number;
    sparkBurnHpPct: number;
    immediateBurnOnRedlineCross: {
        enabled: boolean;
        resources: Array<'spark' | 'mana'>;
        minActionIndex: number;
    };
    weightBfiAdjustments: Record<MetabolicWeightClass, number>;
    weightMovementSparkAdjustments: Record<MetabolicWeightClass, number>;
    metabolicTaxLadder: Record<number, number[]>;
    travelMode: {
        enabled: boolean;
        movementOnly: boolean;
        sparkRecovery: number;
        manaRecovery: number;
        exhaustionClear: number;
    };
    actionBands: Record<MetabolicActionBandId, MetabolicActionBand>;
    actionCatalog: Record<MetabolicActionClassId, MetabolicActionClass>;
    workloadCatalog: Record<MetabolicWorkloadId, MetabolicWorkload>;
}
