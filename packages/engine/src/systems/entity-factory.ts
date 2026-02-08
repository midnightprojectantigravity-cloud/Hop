import type { Actor, Point, Skill, WeightClass } from '../types';
import type { GameComponent } from './components';

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
    hp: number;
    maxHp: number;
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
}

export type CompanionType = 'falcon' | 'skeleton';

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
        hp: config.hp,
        maxHp: config.maxHp,
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
}): Actor {
    return createEntity({
        id: 'player',
        type: 'player',
        position: config.position,
        hp: config.hp ?? 3,
        maxHp: config.maxHp ?? 3,
        speed: config.speed ?? 1,
        factionId: 'player',
        skills: config.skills,
        weightClass: 'Standard',
        archetype: config.archetype || 'VANGUARD',
    });
}

/**
 * Create an enemy entity
 */
export function createEnemy(config: {
    id: string;
    subtype: string;
    position: Point;
    hp: number;
    maxHp: number;
    speed: number;
    skills: string[];
    weightClass?: WeightClass;
    enemyType?: 'melee' | 'ranged' | 'boss';
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
    });

    // Add enemy-specific fields
    entity.enemyType = config.enemyType;

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
}): Actor {
    if (config.companionType === 'falcon') {
        const entity = createEntity({
            id: config.id || `falcon-${config.ownerId}`,
            type: 'enemy', // Type is 'enemy' but factionId is 'player'
            subtype: 'falcon',
            position: config.position,
            hp: 1,
            maxHp: 1,
            speed: 95, // High speed, acts after player (100)
            factionId: 'player',
            skills: ['BASIC_MOVE', 'FALCON_PECK', 'FALCON_APEX_STRIKE', 'FALCON_HEAL', 'FALCON_SCOUT', 'FALCON_AUTO_ROOST'],
            weightClass: 'Light' as WeightClass,
            isFlying: true,
            companionOf: config.ownerId,
        });

        // Initialize companion state
        entity.companionState = {
            mode: 'roost',
            orbitStep: 0,
        };

        return entity;
    }

    return createEntity({
        id: config.id || `${config.companionType}-${config.ownerId}`,
        type: 'enemy',
        subtype: config.companionType,
        position: config.position,
        hp: 1,
        maxHp: 1,
        speed: 80,
        factionId: 'player',
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        companionOf: config.ownerId,
        weightClass: 'Standard'
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
    // Base skills all enemies get
    const baseSkills = ['BASIC_MOVE', 'BASIC_ATTACK'];

    // Type-specific skills
    const typeSkills: Record<string, string[]> = {
        footman: ['AUTO_ATTACK'],
        sprinter: [],
        raider: ['DASH'],
        pouncer: ['GRAPPLE_HOOK'],
        shieldBearer: ['SHIELD_BASH'],
        archer: ['SPEAR_THROW'],
        bomber: ['BOMB_TOSS'],
        warlock: [],
        sentinel: ['SENTINEL_TELEGRAPH', 'SENTINEL_BLAST'],
    };

    return [...baseSkills, ...(typeSkills[enemyType] || [])];
}
