export type RoundMode = 'none' | 'floor' | 'round' | 'ceil';

export interface ClampRange {
    min: number;
    max: number;
}

export interface PropensityBase {
    rngSalt?: string;
    round?: RoundMode;
    clamp?: ClampRange;
}

export interface FixedPropensity extends PropensityBase {
    method: 'fixed';
    value: number;
}

export interface UniformIntPropensity extends PropensityBase {
    method: 'uniform_int';
    min: number;
    max: number;
}

export interface TriangularIntPropensity extends PropensityBase {
    method: 'triangular_int';
    min: number;
    mode: number;
    max: number;
}

export interface WeightedTableEntry {
    value: number;
    weight: number;
}

export interface WeightedTablePropensity extends PropensityBase {
    method: 'weighted_table';
    table: WeightedTableEntry[];
}

export type PropensityDefinition =
    | FixedPropensity
    | UniformIntPropensity
    | TriangularIntPropensity
    | WeightedTablePropensity;

export interface DerivedLinearTerm {
    stat: string;
    coefficient: number;
}

export interface DerivedStatDefinition {
    formula: 'trinity_hp_v1' | 'linear';
    base?: number;
    terms?: DerivedLinearTerm[];
    round?: RoundMode;
    clamp?: ClampRange;
}

export interface BaseUnitDefinition {
    version: string;
    id: string;
    name: string;
    actorType: 'player' | 'enemy';
    subtype?: string;
    factionId: string;
    weightClass: 'Light' | 'Standard' | 'Heavy' | 'Anchored' | 'OuterWall';
    coordSpace: {
        system: 'cube-axial';
        pointFormat: 'qrs';
    };
    tags?: string[];
    instantiate: {
        rngStream: string;
        seedSalt?: string;
        counterMode: 'consume_global' | 'stateless';
        drawOrder: string[];
        includeRollTrace?: boolean;
    };
    propensities: Record<string, PropensityDefinition> & {
        body: PropensityDefinition;
        mind: PropensityDefinition;
        instinct: PropensityDefinition;
        speed: PropensityDefinition;
        mass: PropensityDefinition;
    };
    derivedStats?: Record<string, DerivedStatDefinition>;
    physics?: {
        collisionPolicy?: 'stop' | 'crush_damage';
        crushModel?: {
            baseDamage: number;
            impulseMultiplier: number;
            massDivider: number;
            minDamage: number;
        };
    };
    skillLoadout: {
        baseSkillIds: string[];
        passiveSkillIds?: string[];
        forbiddenKeywordTags?: string[];
        startCooldowns?: Record<string, number>;
    };
    runtimeDefaults?: {
        startingHp?: 'maxHp' | 'explicit';
        explicitHp?: number;
        temporaryArmor?: number;
        isVisible?: boolean;
    };
    spawnProfile?: {
        preferredHex?: { q: number; r: number; s: number };
        allowHazardous?: boolean;
        allowOccupied?: boolean;
    };
}

export interface ScalarTerm {
    stat: 'body' | 'mind' | 'instinct' | 'mass' | 'speed' | 'momentum';
    coefficient: number;
}

export interface ScalarExpression {
    base: number;
    scaling?: ScalarTerm[];
    min?: number;
    max?: number;
    round?: RoundMode;
}

export type TargetSelector = 'self' | 'targetActor' | 'targetHex' | 'line' | 'area';

export interface BaseEffectDef {
    id: string;
    tags: string[];
}

export interface DealDamageEffectDef extends BaseEffectDef {
    kind: 'DEAL_DAMAGE';
    target: { selector: TargetSelector };
    amount: ScalarExpression;
    damageClass?: 'physical' | 'magical' | 'true';
    reason?: string;
}

export interface ApplyStatusEffectDef extends BaseEffectDef {
    kind: 'APPLY_STATUS';
    target: { selector: TargetSelector };
    statusId: string;
    duration: number;
}

export interface ApplyForceEffectDef extends BaseEffectDef {
    kind: 'APPLY_FORCE';
    target: { selector: TargetSelector };
    force: {
        mode: 'push' | 'pull';
        direction: 'source_to_target' | 'target_to_source';
        magnitude: ScalarExpression;
        maxDistance: number;
        collision: {
            onBlocked: 'stop' | 'crush_damage';
            crushDamage?: ScalarExpression;
        };
    };
}

export interface MessageEffectDef extends BaseEffectDef {
    kind: 'MESSAGE';
    text: string;
}

export type CompositeAtomicEffectDefinition =
    | DealDamageEffectDef
    | ApplyStatusEffectDef
    | ApplyForceEffectDef
    | MessageEffectDef;

export interface SkillReactionDefinition {
    id: string;
    trigger: 'ON_DECLARE' | 'BEFORE_RESOLVE' | 'ON_COLLISION' | 'AFTER_RESOLVE';
    enqueuePosition: 'top' | 'bottom';
    effects: CompositeAtomicEffectDefinition[];
}

export type UpgradeModifier =
    | { op: 'add_effect'; phase: 'base' | 'on_collision' | 'after_resolve'; effect: CompositeAtomicEffectDefinition }
    | { op: 'remove_effect_by_tag'; tag: string }
    | { op: 'modify_number'; effectId: string; field: string; mode: 'set' | 'add' | 'multiply'; value: number }
    | { op: 'add_keyword'; keyword: string }
    | { op: 'remove_keyword'; keyword: string }
    | { op: 'add_reaction'; reaction: SkillReactionDefinition };

export interface CompositeSkillUpgradeDefinition {
    id: string;
    name: string;
    description?: string;
    tags?: string[];
    modifiers: UpgradeModifier[];
}

export interface CompositeSkillDefinition {
    version: string;
    id: string;
    name: string;
    description?: string;
    slot: 'offensive' | 'defensive' | 'utility' | 'passive';
    keywords: string[];
    intentTags?: Array<'damage' | 'move' | 'heal' | 'protect' | 'control' | 'summon' | 'hazard' | 'objective' | 'economy' | 'utility'>;
    targeting: {
        mode: 'self' | 'single' | 'line' | 'radius' | 'global';
        range: number;
        aoeRadius?: number;
        requiresLos: boolean;
        allowOccupied: boolean;
        deterministicSort: 'distance_then_q_then_r' | 'q_then_r' | 'r_then_q';
        forbiddenTargetTags?: string[];
    };
    stackPolicy: {
        resolveOrder: 'LIFO';
        reactionWindow: 'automated' | 'manual';
        playerPriority: boolean;
        emitTickEvents: boolean;
    };
    baseAction: {
        costs: {
            energy: number;
            cooldown: number;
            consumesTurn: boolean;
        };
        effects: CompositeAtomicEffectDefinition[];
    };
    reactivePassives?: SkillReactionDefinition[];
    upgrades: CompositeSkillUpgradeDefinition[];
    inhibit?: {
        filterMode?: 'exclude_matching_tags';
        removableTags?: string[];
    };
    preview?: {
        dryRunEnabled?: boolean;
        eventMap?: Record<string, string>;
    };
}

export interface CompiledBaseUnitBlueprint {
    definition: BaseUnitDefinition;
    drawOrder: string[];
    skillIds: string[];
    passiveSkillIds: string[];
}

export interface CompiledCompositeSkillTemplate {
    definition: CompositeSkillDefinition;
    baseEffects: CompositeAtomicEffectDefinition[];
    upgradesById: Record<string, CompositeSkillUpgradeDefinition>;
}

export interface TacticalDataPack {
    version: string;
    units: BaseUnitDefinition[];
    skills: CompositeSkillDefinition[];
}
