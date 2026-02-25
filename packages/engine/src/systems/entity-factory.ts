import type { Actor, Point, Skill, WeightClass } from '../types';
import type { GameComponent } from './components';
import { deriveMaxHpFromTrinity, type TrinityStats } from './trinity-resolver';
import { getTrinityProfile } from './trinity-profiles';
import { resolveDefaultCombatProfile, type CombatProfile } from './combat-traits';
import { getEnemyBestiaryEntry, getEnemyBestiarySkillLoadout } from '../data/bestiary';

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
    const components = new Map(actor.components || []);
    const hasTrinity = components.has('trinity');
    const hasCombatProfile = components.has('combat_profile');
    if (hasTrinity && hasCombatProfile) return actor;

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

    return {
        ...actor,
        components,
    };
};

/**
 * Build a deterministic ActiveSkill loadout from skill IDs.
 * Uses lightweight descriptors to avoid registry import cycles in factory bootstrapping.
 */
export function buildSkillLoadout(skillIds: string[]): Skill[] {
    return skillIds.map(skillId => ({
        id: skillId as any,
        name: String(skillId),
        description: String(skillId),
        slot: 'utility',
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
    const activeSkills: Skill[] = config.activeSkills
        ? [...config.activeSkills]
        : buildSkillLoadout(config.skills || []);

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
        archetype: config.archetype as any,
        components,
        isFlying: config.isFlying,
        companionOf: config.companionOf,
        isVisible: true,
    };

    return actor;
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
    enemyType?: 'melee' | 'ranged' | 'boss';
    trinity?: TrinityStats;
    actionCooldown?: number;
}): Actor {
    const bestiary = getEnemyBestiaryEntry(config.subtype);
    if (!bestiary) {
        throw new Error(`Unknown enemy subtype "${config.subtype}" in createEnemyFromBestiary`);
    }

    const entity = createEnemy({
        id: config.id,
        subtype: config.subtype,
        position: config.position,
        hp: config.hp ?? bestiary.stats.hp,
        maxHp: config.maxHp ?? bestiary.stats.maxHp,
        speed: config.speed ?? bestiary.stats.speed,
        skills: config.skills ?? getEnemyBestiarySkillLoadout(config.subtype),
        weightClass: config.weightClass ?? (bestiary.stats.weightClass as WeightClass),
        enemyType: config.enemyType ?? bestiary.stats.type,
        trinity: config.trinity ?? bestiary.trinity
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
}): Actor {
    if (config.companionType === 'falcon') {
        const entity = createEntity({
            id: config.id || `falcon-${config.ownerId}`,
            type: 'enemy', // Type is 'enemy' but factionId is 'player'
            subtype: 'falcon',
            position: config.position,
            speed: 95, // High speed, acts after player (100)
            factionId: 'player',
            skills: ['BASIC_MOVE', 'FALCON_PECK', 'FALCON_APEX_STRIKE', 'FALCON_HEAL', 'FALCON_SCOUT', 'FALCON_AUTO_ROOST'],
            weightClass: 'Light' as WeightClass,
            isFlying: true,
            companionOf: config.ownerId,
            trinity: config.trinity,
        });

        // Initialize companion state
        entity.companionState = {
            mode: 'roost',
            orbitStep: 0,
        };

        return entity;
    }

    if (config.companionType === 'skeleton') {
        return createEntity({
            id: config.id || `${config.companionType}-${config.ownerId}`,
            type: 'enemy',
            subtype: 'skeleton',
            position: config.position,
            hp: 2,
            maxHp: 2,
            speed: 50,
            factionId: 'player',
            skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
            companionOf: config.ownerId,
            weightClass: 'Standard',
            trinity: config.trinity,
        });
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
