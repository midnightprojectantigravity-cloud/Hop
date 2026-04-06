import type { Actor, AiBehaviorOverlayInstance, ArmorBurdenTier, Point, Skill, WeightClass } from '../../types';
import type { GameComponent } from '../components';
import { deriveMaxHpFromTrinity, type TrinityStats } from '../combat/trinity-resolver';
import { getTrinityProfile } from '../combat/trinity-profiles';
import { resolveDefaultCombatProfile, type CombatProfile } from '../combat/combat-traits';
import { getEnemyBestiaryEntry, getEnemyBestiarySkillLoadout } from '../../data/bestiary';
import { getCompanionBalanceEntry } from '../../data/companions/content';
import { getEnemyCatalogEntry } from '../../data/enemies';
import { ensureActorIres } from '../ires';

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
    subtype?: string;
    position: Point;
    hp?: number;
    maxHp?: number;
    speed: number;
    factionId: string;

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
    companionOf?: string;

    // Components
    components?: Map<string, GameComponent>;
    trinity?: TrinityStats;
    combatProfile?: CombatProfile;
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

    const components = new Map(actor.components || []);
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

const PASSIVE_SKILL_IDS = new Set<string>([
    'ABSORB_FIRE',
    'AUTO_ATTACK',
    'BASIC_ATTACK',
    'BASIC_AWARENESS',
    'BASIC_MOVE',
    'BLIND_FIGHTING',
    'BURROW',
    'COMBAT_ANALYSIS',
    'DASH',
    'ENEMY_AWARENESS',
    'FALCON_APEX_STRIKE',
    'FALCON_AUTO_ROOST',
    'FALCON_HEAL',
    'FALCON_PECK',
    'FALCON_SCOUT',
    'FLIGHT',
    'ORACLE_SIGHT',
    'PHASE_STEP',
    'STANDARD_VISION',
    'TACTICAL_INSIGHT',
    'THEME_HAZARDS',
    'TIME_BOMB',
    'VOLATILE_PAYLOAD',
    'VIBRATION_SENSE'
]);

/**
 * Build ActiveSkill loadout from canonical skill definitions.
 * Slot defaults to utility and only uses an explicit passive allowlist to avoid import cycles.
 */
export function buildSkillLoadout(skillIds: string[]): Skill[] {
    return skillIds.map(skillId => ({
        id: skillId as any,
        name: String(skillId),
        description: String(skillId),
        slot: PASSIVE_SKILL_IDS.has(skillId) ? 'passive' : 'utility',
        cooldown: 0,
        currentCooldown: 0,
        range: 0,
        upgrades: [],
        activeUpgrades: [],
    })) as Skill[];
}

/**
 * Core entity factory - creates a fully-formed Actor
 */
export function createEntity(config: BaseEntityConfig): Actor {
    // Build skill loadout
    let activeSkills: Skill[] = config.activeSkills
        ? [...config.activeSkills]
        : buildSkillLoadout(config.skills || []);
    if (config.type === 'enemy') {
        activeSkills = ensureEnemyAwarenessSkill(activeSkills);
    }

    // Build components map
    const components = new Map(config.components || []);

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
}): Actor {
    return createEntity({
        id: 'player',
        type: 'player',
        position: config.position,
        hp: config.hp,
        maxHp: config.maxHp,
        speed: config.speed ?? 1,
        factionId: 'player',
        skills: config.skills,
        weightClass: 'Standard',
        armorBurdenTier: config.armorBurdenTier,
        archetype: config.archetype || 'VANGUARD',
        trinity: config.trinity,
    });
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
}): Actor {
    const entity = createEntity({
        id: config.id,
        type: 'enemy',
        subtype: config.subtype,
        position: config.position,
        hp: config.hp,
        maxHp: config.maxHp,
        speed: config.speed,
        factionId: 'enemy',
        skills: config.skills,
        weightClass: config.weightClass || 'Standard',
        armorBurdenTier: config.armorBurdenTier,
        trinity: config.trinity,
    });

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
        trinity: resolvedTrinity
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
    position: Point;
    id?: string;
    trinity?: TrinityStats;
    armorBurdenTier?: ArmorBurdenTier;
    initialBehaviorOverlay?: AiBehaviorOverlayInstance;
    initialAnchorActorId?: string;
    initialAnchorPoint?: Point;
}): Actor {
    if (config.companionType === 'falcon') {
        const contract = getCompanionBalanceEntry('falcon');
        const entity = createEntity({
            id: config.id || `falcon-${config.ownerId}`,
            type: 'enemy', // Type is 'enemy' but factionId is 'player'
            subtype: 'falcon',
            position: config.position,
            speed: contract?.speed ?? 95,
            factionId: 'player',
            hp: contract?.hp,
            maxHp: contract?.maxHp,
            skills: contract?.skills ?? ['BASIC_MOVE', 'FALCON_PECK', 'FALCON_APEX_STRIKE', 'FALCON_HEAL', 'FALCON_SCOUT', 'FALCON_AUTO_ROOST'],
            weightClass: contract?.weightClass ?? ('Light' as WeightClass),
            armorBurdenTier: config.armorBurdenTier ?? contract?.armorBurdenTier,
            isFlying: true,
            companionOf: config.ownerId,
            trinity: config.trinity ?? contract?.trinity,
        });

        // Initialize companion state
        entity.companionState = {
            mode: 'roost',
            orbitStep: 0,
        };
        entity.behaviorState = {
            overlays: [{
                id: 'falcon_roost',
                source: 'summon',
                sourceId: 'falcon_roost',
                rangeModel: 'owner_proximity',
                selfPreservationBias: 0.35,
                controlBias: 0.2,
                commitBias: -0.3
            }],
            anchorActorId: config.ownerId
        };

        return entity;
    }

    if (config.companionType === 'skeleton') {
        const contract = getCompanionBalanceEntry('skeleton');
        const entity = createEntity({
            id: config.id || `${config.companionType}-${config.ownerId}`,
            type: 'enemy',
            subtype: 'skeleton',
            position: config.position,
            hp: contract?.hp ?? 2,
            maxHp: contract?.maxHp ?? 2,
            speed: contract?.speed ?? 50,
            factionId: 'player',
            skills: contract?.skills ?? ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK'],
            companionOf: config.ownerId,
            weightClass: contract?.weightClass ?? 'Standard',
            armorBurdenTier: config.armorBurdenTier ?? contract?.armorBurdenTier,
            trinity: config.trinity ?? contract?.trinity,
        });
        if (config.initialBehaviorOverlay || config.initialAnchorActorId || config.initialAnchorPoint) {
            entity.behaviorState = {
                overlays: config.initialBehaviorOverlay
                    ? [{ ...config.initialBehaviorOverlay }]
                    : [],
                anchorActorId: config.initialAnchorActorId,
                anchorPoint: config.initialAnchorPoint
            };
        }
        return entity;
    }

    return createEntity({
        id: config.id || `${config.companionType}-${config.ownerId}`,
        type: 'enemy',
        subtype: config.companionType,
        position: config.position,
        speed: 80,
        factionId: 'player',
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        companionOf: config.ownerId,
        weightClass: 'Standard',
        armorBurdenTier: config.armorBurdenTier,
        trinity: config.trinity,
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
