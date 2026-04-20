import type {
    Actor,
    AiBehaviorOverlayInstance,
    ArmorBurdenTier,
    Point,
    Skill,
    StatusEffect,
    SkillSummonDefinition,
    WeightClass
} from '../../types';
import type { BaseUnitDefinition, UnitBehaviorStateDefinition, UnitCompanionStateDefinition, UnitKind } from '../../data/contracts';
import type { GameComponent } from '../components';
import { deriveMaxHpFromTrinity, type TrinityStats } from '../combat/trinity-resolver';
import { getTrinityProfile } from '../combat/trinity-profiles';
import { resolveDefaultCombatProfile, type CombatProfile } from '../combat/combat-traits';
import { getEnemyBestiaryEntry, getEnemyBestiarySkillLoadout } from '../../data/bestiary';
import { getEnemyCatalogEntry, getUnitDefinitionBySubtype } from '../../data/units';
import { ensureActorIres } from '../ires';
import { getSkillDefinition } from '../../skillRegistry';
import { getBaseUnitDefinitionBySubtype } from './base-unit-registry';

/**
 * ENTITY FACTORY SYSTEM
 * 
 * Provides consistent entity creation across the entire game.
 * All entities (player, enemies, companions) are created through these factories
 * to ensure they have proper stats, traits, and skill loadouts.
 */

export interface BaseEntityConfig {
    id: string;
    type: 'player' | 'enemy';
    unitKind?: UnitKind;
    subtype?: string;
    position: Point;
    hp?: number;
    maxHp?: number;
    speed: number;
    factionId: string;
    definition?: BaseUnitDefinition;

    // Optional overrides
    initiative?: number;
    weightClass?: WeightClass;
    armorBurdenTier?: ArmorBurdenTier;
    archetype?: string;

    // Skill loadout
    skills?: string[]; // Skill IDs to include
    activeSkills?: Skill[]; // Prebuilt skills (preserve cooldowns/upgrades)

    // Special traits
    isFlying?: boolean;
    temporaryArmor?: number;
    companionOf?: string;
    visualAssetRef?: string;

    // Components
    components?: Map<string, GameComponent>;
    trinity?: TrinityStats;
    combatProfile?: CombatProfile;
}

export interface UnitInstantiationContext {
    source?: 'loadout' | 'catalog' | 'bestiary' | 'companion' | 'manual';
    ownerId?: string;
    ownerFactionId?: string;
    companionType?: CompanionType;
    companionState?: Partial<UnitCompanionStateDefinition>;
    behaviorState?: Partial<UnitBehaviorStateDefinition>;
}

export type CompanionType = 'falcon' | 'skeleton';

const ensureEnemyAwarenessSkill = (skills: Skill[] = []): Skill[] => {
    if (skills.some(skill => skill.id === 'ENEMY_AWARENESS')) return skills;
    return [...skills, ...buildSkillLoadout(['ENEMY_AWARENESS'])];
};

const cloneTrinity = (trinity: TrinityStats): TrinityStats => ({
    body: trinity.body,
    mind: trinity.mind,
    instinct: trinity.instinct,
});

const cloneBehaviorOverlay = (overlay: any): AiBehaviorOverlayInstance => ({
    ...overlay
});

const cloneStatusEffect = (status: any): StatusEffect => ({
    ...status
});

const cloneUnitDefinition = (definition: BaseUnitDefinition): BaseUnitDefinition => ({
    ...definition,
    tags: definition.tags ? [...definition.tags] : undefined,
    traits: definition.traits ? [...definition.traits] : undefined,
    instantiate: {
        ...definition.instantiate,
        drawOrder: [...definition.instantiate.drawOrder]
    },
    propensities: { ...definition.propensities },
    derivedStats: definition.derivedStats ? { ...definition.derivedStats } : undefined,
    combatProfile: definition.combatProfile ? { ...definition.combatProfile } : undefined,
    physics: definition.physics ? {
        ...definition.physics,
        crushModel: definition.physics.crushModel ? { ...definition.physics.crushModel } : undefined
    } : undefined,
    skillLoadout: {
        baseSkillIds: [...definition.skillLoadout.baseSkillIds],
        passiveSkillIds: definition.skillLoadout.passiveSkillIds ? [...definition.skillLoadout.passiveSkillIds] : undefined,
        forbiddenKeywordTags: definition.skillLoadout.forbiddenKeywordTags ? [...definition.skillLoadout.forbiddenKeywordTags] : undefined,
        startCooldowns: definition.skillLoadout.startCooldowns ? { ...definition.skillLoadout.startCooldowns } : undefined
    },
    runtimeDefaults: definition.runtimeDefaults ? { ...definition.runtimeDefaults } : undefined,
    lifecycle: definition.lifecycle ? {
        ...definition.lifecycle,
        companionState: definition.lifecycle.companionState ? { ...definition.lifecycle.companionState } : undefined,
        behaviorState: definition.lifecycle.behaviorState ? {
            ...definition.lifecycle.behaviorState,
            overlays: definition.lifecycle.behaviorState.overlays ? definition.lifecycle.behaviorState.overlays.map(cloneBehaviorOverlay) : undefined
        } : undefined,
        statusEffects: definition.lifecycle.statusEffects ? definition.lifecycle.statusEffects.map(cloneStatusEffect) : undefined
    } : undefined,
    spawnProfile: definition.spawnProfile ? { ...definition.spawnProfile } : undefined
});

const resolveUnitKind = (config: BaseEntityConfig, definition?: BaseUnitDefinition): UnitKind =>
    definition?.unitKind
        || (config.unitKind as UnitKind | undefined)
        || (config.type === 'player' ? 'archetype' : 'enemy');

const resolveDefinitionSkillIds = (definition?: BaseUnitDefinition, fallbackSkills: string[] = []): string[] => {
    if (!definition) return [...fallbackSkills];
    return [
        ...definition.skillLoadout.baseSkillIds,
        ...(definition.skillLoadout.passiveSkillIds || [])
    ];
};

const resolveFixedPropensityValue = (definition: BaseUnitDefinition | undefined, key: string): number | undefined => {
    const propensity = definition?.propensities[key];
    if (!propensity || propensity.method !== 'fixed') return undefined;
    return propensity.value;
};

const resolveDefinitionTrinity = (definition?: BaseUnitDefinition, config?: BaseEntityConfig): TrinityStats | undefined => {
    if (!definition) return undefined;
    const profile = getTrinityProfile();
    const defaultTrinity = profile.default;
    const kind = resolveUnitKind(config || { id: definition.id, type: 'enemy', position: { q: 0, r: 0, s: 0 }, speed: 1, factionId: definition.factionId }, definition);
    if (kind === 'archetype') {
        const archetype = (definition.subtype || definition.id || 'VANGUARD').toUpperCase();
        return cloneTrinity(profile.archetype[archetype] || defaultTrinity);
    }
    if (definition.subtype) {
        if (definition.unitKind === 'companion' || definition.tags?.includes('companion')) {
            return cloneTrinity(profile.companionSubtype[definition.subtype as CompanionType] || defaultTrinity);
        }
        return cloneTrinity(profile.enemySubtype[definition.subtype] || defaultTrinity);
    }
    return cloneTrinity(defaultTrinity);
};

const applyDefinitionLifecycle = (
    actor: Actor,
    definition?: BaseUnitDefinition,
    context?: UnitInstantiationContext
): Actor => {
    if (!definition?.lifecycle) return actor;
    const lifecycle = definition.lifecycle;
    const next: Actor = { ...actor };

    if (lifecycle.visualAssetRef) next.visualAssetRef = lifecycle.visualAssetRef;
    if (lifecycle.isFlying !== undefined) next.isFlying = lifecycle.isFlying;
    if (lifecycle.temporaryArmor !== undefined) next.temporaryArmor = lifecycle.temporaryArmor;
    if (lifecycle.statusEffects) next.statusEffects = lifecycle.statusEffects.map(cloneStatusEffect);

    if (lifecycle.companionState) {
        next.companionState = {
            ...next.companionState,
            mode: lifecycle.companionState.mode || next.companionState?.mode || 'roost',
            ...lifecycle.companionState
        };
    }
    if (context?.companionState) {
        next.companionState = {
            ...next.companionState,
            mode: context.companionState.mode || next.companionState?.mode || 'roost',
            ...context.companionState
        };
    }

    if (lifecycle.behaviorState) {
        next.behaviorState = {
            overlays: lifecycle.behaviorState.overlays?.map(cloneBehaviorOverlay) || [],
            anchorActorId: lifecycle.behaviorState.anchorActorId || next.behaviorState?.anchorActorId,
            anchorPoint: lifecycle.behaviorState.anchorPoint || next.behaviorState?.anchorPoint,
            controller: lifecycle.behaviorState.controller || next.behaviorState?.controller || 'generic_ai',
            goal: lifecycle.behaviorState.goal || next.behaviorState?.goal,
            arenaTieBreakKey: lifecycle.behaviorState.arenaTieBreakKey || next.behaviorState?.arenaTieBreakKey
        };
    }
    if (context?.behaviorState) {
        next.behaviorState = {
            overlays: context.behaviorState.overlays?.map(cloneBehaviorOverlay) || next.behaviorState?.overlays || [],
            anchorActorId: context.behaviorState.anchorActorId || next.behaviorState?.anchorActorId || context?.ownerId,
            anchorPoint: context.behaviorState.anchorPoint || next.behaviorState?.anchorPoint,
            controller: context.behaviorState.controller || next.behaviorState?.controller || 'generic_ai',
            goal: context.behaviorState.goal || next.behaviorState?.goal,
            arenaTieBreakKey: context.behaviorState.arenaTieBreakKey || next.behaviorState?.arenaTieBreakKey
        };
    }

    return next;
};

const normalizeComponentMap = (components?: Map<string, GameComponent> | Record<string, GameComponent> | [string, GameComponent][] | null): Map<string, GameComponent> => {
    if (!components) return new Map();
    if (components instanceof Map) return new Map(components);
    if (Array.isArray(components)) return new Map(components);
    return new Map(Object.entries(components));
};

const resolveOwnerAnchorId = (anchorActorId: string | undefined, ownerId: string | undefined): string | undefined => {
    if (!anchorActorId) return ownerId;
    if (anchorActorId === 'owner') return ownerId;
    return anchorActorId;
};

const resolveDefaultTrinity = (config: BaseEntityConfig): TrinityStats => {
    if (config.trinity) return cloneTrinity(config.trinity);
    const profile = getTrinityProfile();
    const defaultTrinity = profile.default;

    if (config.type === 'player') {
        const archetype = (config.archetype || 'VANGUARD').toUpperCase();
        return cloneTrinity(profile.archetype[archetype] || defaultTrinity);
    }

    if (config.companionOf && config.subtype) {
        const companionType = config.subtype as CompanionType;
        if (profile.companionSubtype[companionType]) {
            return cloneTrinity(profile.companionSubtype[companionType]);
        }
    }

    if (config.subtype) {
        return cloneTrinity(profile.enemySubtype[config.subtype] || defaultTrinity);
    }

    return cloneTrinity(defaultTrinity);
};

export const ensureActorTrinity = (actor: Actor): Actor => {
    const normalizedSkills = actor.type === 'enemy'
        ? ensureEnemyAwarenessSkill(actor.activeSkills || [])
        : (actor.activeSkills || []);

    const components = normalizeComponentMap(actor.components as unknown as Map<string, GameComponent> | Record<string, GameComponent> | [string, GameComponent][] | null | undefined);
    const hasTrinity = components.has('trinity');
    const hasCombatProfile = components.has('combat_profile');
    const hasAilmentProfile = components.has('ailment_profile');
    if (hasTrinity && hasCombatProfile && hasAilmentProfile && normalizedSkills === actor.activeSkills) return actor;

    const resolved = resolveDefaultTrinity({
        id: actor.id,
        type: actor.type,
        subtype: actor.subtype,
        position: actor.position,
        hp: actor.hp,
        maxHp: actor.maxHp,
        speed: actor.speed,
        factionId: actor.factionId,
        archetype: actor.archetype,
        companionOf: actor.companionOf,
        components,
    });
    const resolvedCombatProfile = resolveDefaultCombatProfile({
        type: actor.type,
        archetype: actor.archetype,
        subtype: actor.subtype,
        companionOf: actor.companionOf,
    });

    if (!hasTrinity) {
        components.set('trinity', {
            type: 'trinity',
            ...resolved,
        });
    }
    if (!hasCombatProfile) {
        components.set('combat_profile', {
            type: 'combat_profile',
            ...resolvedCombatProfile,
        });
    }
    if (!hasAilmentProfile) {
        components.set('ailment_profile', {
            type: 'ailment_profile',
            baseResistancePct: {},
            resistanceGrowthRate: 1
        });
    }

    const normalizedActor: Actor = {
        ...actor,
        components,
        activeSkills: normalizedSkills
    };
    return ensureActorIres(normalizedActor);
};

/**
 * Build ActiveSkill loadout from canonical skill definitions.
 * Slot defaults from the skill registry when available and otherwise falls back to utility.
 */
export function buildSkillLoadout(skillIds: string[]): Skill[] {
    return skillIds.map(skillId => ({
        id: skillId as any,
        name: String(skillId),
        description: String(skillId),
        slot: getSkillDefinition(skillId)?.slot || 'utility',
        cooldown: 0,
        currentCooldown: 0,
        range: 0,
        upgrades: [],
        activeUpgrades: [],
    })) as Skill[];
}

export function createEntityFromDefinition(
    definition: BaseUnitDefinition,
    config: Omit<BaseEntityConfig, 'skills' | 'activeSkills' | 'definition' | 'type' | 'unitKind'> & {
        type?: BaseEntityConfig['type'];
        unitKind?: UnitKind;
        activeSkills?: Skill[];
    },
    context: UnitInstantiationContext = {}
): Actor {
    const normalizedDefinition = cloneUnitDefinition(definition);
    const unitKind = config.unitKind || normalizedDefinition.unitKind || (config.type === 'player' ? 'archetype' : 'enemy');
    const activeSkills = config.activeSkills
        ? [...config.activeSkills]
        : buildSkillLoadout(resolveDefinitionSkillIds(normalizedDefinition));
    const passiveSkillIds = normalizedDefinition.skillLoadout.passiveSkillIds || [];
    if (config.activeSkills && passiveSkillIds.length > 0) {
        const existing = new Set(activeSkills.map(skill => skill.id));
        for (const skillId of passiveSkillIds) {
            if (existing.has(skillId as any)) continue;
            const skill = buildSkillLoadout([skillId as any])[0];
            if (skill) {
                activeSkills.push(skill);
                existing.add(skillId as any);
            }
        }
    }

    const components = normalizeComponentMap(config.components as unknown as Map<string, GameComponent> | Record<string, GameComponent> | [string, GameComponent][] | null | undefined);
    const resolvedTrinity = config.trinity || resolveDefinitionTrinity(normalizedDefinition, { ...config, type: config.type || (unitKind === 'archetype' ? 'player' : 'enemy') } as BaseEntityConfig) || getTrinityProfile().default;
    const resolvedCombatProfile = config.combatProfile || normalizedDefinition.combatProfile || resolveDefaultCombatProfile({
        type: config.type || (unitKind === 'archetype' ? 'player' : 'enemy'),
        archetype: normalizedDefinition.subtype,
        subtype: normalizedDefinition.subtype,
        companionOf: context.ownerId
    });
    const resolvedSpeed = config.speed;
    const derivedMaxHp = deriveMaxHpFromTrinity(resolvedTrinity);
    const maxHp = Math.max(1, config.maxHp ?? derivedMaxHp);
    const hp = Math.min(maxHp, Math.max(0, config.hp ?? (normalizedDefinition.runtimeDefaults?.startingHp === 'explicit' ? normalizedDefinition.runtimeDefaults.explicitHp ?? maxHp : maxHp)));

    if (!components.has('trinity')) {
        components.set('trinity', {
            type: 'trinity',
            ...resolvedTrinity,
        });
    }
    if (!components.has('combat_profile')) {
        components.set('combat_profile', {
            type: 'combat_profile',
            ...resolvedCombatProfile,
        });
    }
    if (!components.has('ailment_profile')) {
        components.set('ailment_profile', {
            type: 'ailment_profile',
            baseResistancePct: {},
            resistanceGrowthRate: 1
        });
    }
    if (normalizedDefinition.unitKind === 'archetype' && normalizedDefinition.subtype) {
        components.set('archetype', {
            type: 'archetype',
            archetype: normalizedDefinition.subtype as any,
        });
    }
    if (normalizedDefinition.traits?.length) {
        components.set('unit_traits', {
            type: 'unit_traits',
            traits: [...normalizedDefinition.traits]
        } as any);
    }

    const baseActor: Actor = {
        id: config.id,
        type: config.type || (unitKind === 'archetype' ? 'player' : 'enemy'),
        subtype: normalizedDefinition.subtype,
        position: config.position,
        hp,
        maxHp,
        speed: resolvedSpeed,
        factionId: config.factionId,
        initiative: config.initiative,
        statusEffects: [],
        temporaryArmor: config.temporaryArmor ?? normalizedDefinition.runtimeDefaults?.temporaryArmor ?? 0,
        activeSkills,
        weightClass: config.weightClass || normalizedDefinition.weightClass,
        armorBurdenTier: config.armorBurdenTier,
        archetype: normalizedDefinition.subtype as any,
        components,
        isFlying: config.isFlying ?? normalizedDefinition.lifecycle?.isFlying,
        companionOf: context.ownerId,
        visualAssetRef: config.visualAssetRef ?? normalizedDefinition.lifecycle?.visualAssetRef,
        isVisible: normalizedDefinition.runtimeDefaults?.isVisible ?? true,
    };

    return ensureActorIres(applyDefinitionLifecycle(baseActor, normalizedDefinition, context));
}

/**
 * Core entity factory - creates a fully-formed Actor
 */
export function createEntity(config: BaseEntityConfig): Actor {
    if (config.definition) {
        return createEntityFromDefinition(config.definition, config, { source: 'manual', ownerId: config.companionOf });
    }

    // Build skill loadout
    let activeSkills: Skill[] = config.activeSkills
        ? [...config.activeSkills]
        : buildSkillLoadout(config.skills || []);
    if (config.type === 'enemy') {
        activeSkills = ensureEnemyAwarenessSkill(activeSkills);
    }

    // Build components map
    const components = normalizeComponentMap(config.components as unknown as Map<string, GameComponent> | Record<string, GameComponent> | [string, GameComponent][] | null | undefined);

    const resolvedTrinity = resolveDefaultTrinity(config);
    const resolvedCombatProfile = config.combatProfile || resolveDefaultCombatProfile(config);

    // Ensure all runtime actors have canonical trinity stats.
    if (!components.has('trinity')) {
        components.set('trinity', {
            type: 'trinity',
            ...resolvedTrinity,
        });
    }
    if (!components.has('combat_profile')) {
        components.set('combat_profile', {
            type: 'combat_profile',
            ...resolvedCombatProfile,
        });
    }
    if (!components.has('ailment_profile')) {
        components.set('ailment_profile', {
            type: 'ailment_profile',
            baseResistancePct: {},
            resistanceGrowthRate: 1
        });
    }

    const derivedMaxHp = deriveMaxHpFromTrinity(resolvedTrinity);
    const maxHp = Math.max(1, config.maxHp ?? derivedMaxHp);
    const hp = Math.min(maxHp, Math.max(0, config.hp ?? maxHp));

    // Add physics component if weightClass is specified
    if (config.weightClass) {
        components.set('physics', {
            type: 'physics',
            weightClass: config.weightClass,
        });
    }

    // Add archetype component if specified
    if (config.archetype) {
        components.set('archetype', {
            type: 'archetype',
            archetype: config.archetype as any,
        });
    }

    const actor: Actor = {
        id: config.id,
        type: config.type,
        subtype: config.subtype,
        position: config.position,
        hp,
        maxHp,
        speed: config.speed,
        factionId: config.factionId,
        initiative: config.initiative,
        statusEffects: [],
        temporaryArmor: 0,
        activeSkills,
        weightClass: config.weightClass,
        armorBurdenTier: config.armorBurdenTier,
        archetype: config.archetype as any,
        components,
        isFlying: config.isFlying,
        companionOf: config.companionOf,
        visualAssetRef: config.visualAssetRef,
        isVisible: true,
    };

    return ensureActorIres(actor);
}

/**
 * Create a player entity
 */
export function createPlayer(config: {
    position: Point;
    hp?: number;
    maxHp?: number;
    speed?: number;
    skills: string[];
    archetype?: string;
    trinity?: TrinityStats;
    armorBurdenTier?: ArmorBurdenTier;
    combatProfile?: CombatProfile;
}): Actor {
    const archetype = config.archetype || 'VANGUARD';
    const definition = getUnitDefinitionBySubtype(archetype) || getBaseUnitDefinitionBySubtype(archetype);
    if (!definition) {
        throw new Error(`Unknown player archetype "${archetype}"`);
    }
    return createEntityFromDefinition(definition, {
        id: 'player',
        type: 'player',
        position: config.position,
        hp: config.hp,
        maxHp: config.maxHp,
        speed: config.speed ?? 1,
        factionId: 'player',
        weightClass: 'Standard',
        armorBurdenTier: config.armorBurdenTier,
        archetype,
        trinity: config.trinity,
        combatProfile: config.combatProfile,
        activeSkills: buildSkillLoadout(config.skills)
    }, { source: 'loadout', ownerId: 'player' });
}

/**
 * Create an enemy entity
 */
export function createEnemy(config: {
    id: string;
    subtype: string;
    position: Point;
    hp?: number;
    maxHp?: number;
    speed: number;
    skills: string[];
    weightClass?: WeightClass;
    armorBurdenTier?: ArmorBurdenTier;
    enemyType?: 'melee' | 'ranged' | 'boss';
    trinity?: TrinityStats;
    combatProfile?: CombatProfile;
}): Actor {
    const definition = getBaseUnitDefinitionBySubtype(config.subtype) || {
        version: '1.0.0',
        id: `ENEMY_${config.subtype.toUpperCase()}`,
        name: config.subtype,
        actorType: 'enemy' as const,
        unitKind: 'enemy' as const,
        subtype: config.subtype,
        factionId: 'enemy',
        weightClass: config.weightClass || 'Standard',
        coordSpace: {
            system: 'cube-axial',
            pointFormat: 'qrs'
        },
        tags: ['enemy'],
        traits: ['ENEMY'],
        instantiate: {
            rngStream: 'enemy.instantiate',
            seedSalt: config.subtype,
            counterMode: 'consume_global',
            drawOrder: ['body', 'mind', 'instinct', 'speed', 'mass'],
            includeRollTrace: false
        },
        propensities: {
            body: { method: 'fixed', value: config.trinity?.body ?? 1 },
            mind: { method: 'fixed', value: config.trinity?.mind ?? 1 },
            instinct: { method: 'fixed', value: config.trinity?.instinct ?? 1 },
            speed: { method: 'fixed', value: config.speed },
            mass: { method: 'fixed', value: 5 }
        },
        derivedStats: {
            maxHp: { formulaId: 'trinity_hp_v1' }
        },
        combatProfile: config.combatProfile,
        skillLoadout: {
            baseSkillIds: [...config.skills],
            passiveSkillIds: []
        },
        runtimeDefaults: {
            startingHp: 'maxHp',
            temporaryArmor: 0,
            isVisible: true
        }
    };

    const entity = createEntityFromDefinition(definition, {
        id: config.id,
        type: 'enemy',
        subtype: config.subtype,
        position: config.position,
        hp: config.hp,
        maxHp: config.maxHp,
        speed: config.speed,
        factionId: 'enemy',
        weightClass: config.weightClass || 'Standard',
        armorBurdenTier: config.armorBurdenTier,
        trinity: config.trinity,
        combatProfile: config.combatProfile,
        activeSkills: buildSkillLoadout(config.skills)
    }, { source: 'catalog' });

    // Add enemy-specific fields
    entity.enemyType = config.enemyType;

    return entity;
}

export function createEnemyFromBestiary(config: {
    id: string;
    subtype: string;
    position: Point;
    hp?: number;
    maxHp?: number;
    speed?: number;
    skills?: string[];
    weightClass?: WeightClass;
    armorBurdenTier?: ArmorBurdenTier;
    enemyType?: 'melee' | 'ranged' | 'boss';
    trinity?: TrinityStats;
    actionCooldown?: number;
}): Actor {
    const catalogEntry = getEnemyCatalogEntry(config.subtype);
    const bestiary = getEnemyBestiaryEntry(config.subtype);
    if (!bestiary || !catalogEntry) {
        throw new Error(`Unknown enemy subtype "${config.subtype}" in createEnemyFromBestiary`);
    }

    const resolvedTrinity = config.trinity ?? bestiary.trinity;
    const resolvedMaxHp = Math.max(1, config.maxHp ?? deriveMaxHpFromTrinity(resolvedTrinity));
    const resolvedHp = Math.min(resolvedMaxHp, Math.max(0, config.hp ?? resolvedMaxHp));

    const entity = createEnemy({
        id: config.id,
        subtype: config.subtype,
        position: config.position,
        hp: resolvedHp,
        maxHp: resolvedMaxHp,
        speed: config.speed ?? bestiary.stats.speed,
        skills: config.skills ?? getEnemyBestiarySkillLoadout(config.subtype),
        weightClass: config.weightClass ?? (bestiary.stats.weightClass as WeightClass),
        armorBurdenTier: config.armorBurdenTier ?? catalogEntry.contract.metabolicProfile.armorBurdenTier,
        enemyType: config.enemyType ?? bestiary.stats.type,
        trinity: resolvedTrinity,
        combatProfile: catalogEntry.combatProfile
    });

    if (config.actionCooldown !== undefined || bestiary.stats.actionCooldown !== undefined) {
        entity.actionCooldown = config.actionCooldown ?? bestiary.stats.actionCooldown;
    }

    return entity;
}

/**
 * Create a companion entity (falcon today; extensible for future companions).
 */
export function createCompanion(config: {
    companionType: CompanionType;
    ownerId: string;
    ownerFactionId?: string;
    position: Point;
    id?: string;
    trinity?: TrinityStats;
    armorBurdenTier?: ArmorBurdenTier;
    summon?: SkillSummonDefinition;
    initialBehaviorOverlay?: AiBehaviorOverlayInstance;
    initialAnchorActorId?: string;
    initialAnchorPoint?: Point;
}): Actor {
    if (config.companionType === 'falcon') {
        const definition = getUnitDefinitionBySubtype('falcon') || getBaseUnitDefinitionBySubtype('falcon');
        if (!definition) {
            throw new Error('Missing core unit definition for falcon');
        }
        const speed = resolveFixedPropensityValue(definition, 'speed') ?? 95;
        const entity = createEntityFromDefinition(definition, {
            id: config.id || `falcon-${config.ownerId}`,
            type: 'enemy', // Type is 'enemy' but factionId is 'player'
            subtype: 'falcon',
            position: config.position,
            speed,
            factionId: config.ownerFactionId || 'player',
            weightClass: (definition.weightClass || 'Light') as WeightClass,
            armorBurdenTier: config.armorBurdenTier ?? ('None' as ArmorBurdenTier),
            isFlying: true,
            companionOf: config.ownerId,
            combatProfile: definition.combatProfile,
            activeSkills: buildSkillLoadout(resolveDefinitionSkillIds(definition))
        }, {
            source: 'companion',
            ownerId: config.ownerId,
            ownerFactionId: config.ownerFactionId,
            companionType: 'falcon'
        });

        entity.companionState = {
            ...entity.companionState,
            mode: entity.companionState?.mode || 'roost',
            orbitStep: 0,
        };

        return entity;
    }

    if (config.companionType === 'skeleton') {
        const summon = config.summon;
        const definition = getUnitDefinitionBySubtype('skeleton') || getBaseUnitDefinitionBySubtype('skeleton');
        if (!definition) {
            throw new Error('Missing core unit definition for skeleton');
        }
        const contextBehaviorState = summon?.behavior || config.initialBehaviorOverlay || config.initialAnchorActorId || config.initialAnchorPoint
            ? {
                overlays: [
                    ...(summon?.behavior?.overlays || []),
                    ...(config.initialBehaviorOverlay ? [config.initialBehaviorOverlay] : [])
                ],
                anchorActorId: resolveOwnerAnchorId(config.initialAnchorActorId || summon?.behavior?.anchorActorId, config.ownerId),
                anchorPoint: config.initialAnchorPoint || summon?.behavior?.anchorPoint,
                controller: summon?.behavior?.controller || 'manual'
            }
            : undefined;
        const entity = createEntityFromDefinition(definition, {
            id: config.id || `${config.companionType}-${config.ownerId}`,
            type: 'enemy',
            subtype: 'skeleton',
            position: config.position,
            hp: 86,
            maxHp: 86,
            speed: resolveFixedPropensityValue(definition, 'speed') ?? 50,
            factionId: config.ownerFactionId || 'player',
            companionOf: config.ownerId,
            weightClass: 'Standard',
            armorBurdenTier: config.armorBurdenTier ?? 'Medium',
            trinity: summon?.trinity ?? config.trinity,
            combatProfile: definition.combatProfile,
            visualAssetRef: summon?.visualAssetRef,
            activeSkills: buildSkillLoadout([
                ...resolveDefinitionSkillIds(definition),
                ...(summon?.skills || [])
            ])
        }, {
            source: 'companion',
            ownerId: config.ownerId,
            ownerFactionId: config.ownerFactionId,
            companionType: 'skeleton',
            behaviorState: contextBehaviorState
        });
        return entity;
    }

    return createEntity({
        id: config.id || `${config.companionType}-${config.ownerId}`,
        type: 'enemy',
        subtype: config.companionType,
        position: config.position,
        speed: 80,
        factionId: config.ownerFactionId || 'player',
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        companionOf: config.ownerId,
        weightClass: 'Standard',
        armorBurdenTier: config.armorBurdenTier,
        trinity: config.trinity,
        combatProfile: {
            outgoingPhysical: 1,
            outgoingMagical: 1,
            incomingPhysical: 1,
            incomingMagical: 1
        }
    });
}

/**
 * Create a Falcon companion entity
 */
export function createFalcon(config: {
    ownerId: string;
    position: Point;
}): Actor {
    return createCompanion({
        companionType: 'falcon',
        ownerId: config.ownerId,
        position: config.position
    });
}

/**
 * Helper: Get default skill loadout for an enemy type
 */
export function getEnemySkillLoadout(enemyType: string): string[] {
    const bestiarySkills = getEnemyBestiarySkillLoadout(enemyType);
    if (bestiarySkills.length > 0) return bestiarySkills;

    // Legacy fallback for unknown/custom subtypes outside the bestiary.
    return ['BASIC_MOVE'];
}
