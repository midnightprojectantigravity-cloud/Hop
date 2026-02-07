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

/**
 * Core entity factory - creates a fully-formed Actor
 */
export function createEntity(config: BaseEntityConfig): Actor {
    // Build skill loadout
    const activeSkills: Skill[] = config.activeSkills
        ? [...config.activeSkills]
        : (config.skills || []).map(skillId => ({
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
 * Create a Falcon companion entity
 */
export function createFalcon(config: {
    ownerId: string;
    position: Point;
}): Actor {
    const falconSkills: Skill[] = [
        { id: 'BASIC_MOVE', name: 'BASIC_MOVE', description: 'BASIC_MOVE', slot: 'utility', cooldown: 0, currentCooldown: 0, range: 1, upgrades: [], activeUpgrades: [] },
        { id: 'FALCON_PECK', name: 'FALCON_PECK', description: 'FALCON_PECK', slot: 'offensive', cooldown: 0, currentCooldown: 0, range: 1, upgrades: [], activeUpgrades: [] },
        { id: 'FALCON_APEX_STRIKE', name: 'FALCON_APEX_STRIKE', description: 'FALCON_APEX_STRIKE', slot: 'offensive', cooldown: 0, currentCooldown: 0, range: 4, upgrades: [], activeUpgrades: [] },
        { id: 'FALCON_HEAL', name: 'FALCON_HEAL', description: 'FALCON_HEAL', slot: 'utility', cooldown: 0, currentCooldown: 0, range: 1, upgrades: [], activeUpgrades: [] },
        { id: 'FALCON_SCOUT', name: 'FALCON_SCOUT', description: 'FALCON_SCOUT', slot: 'utility', cooldown: 0, currentCooldown: 0, range: 3, upgrades: [], activeUpgrades: [] },
    ];
    const entity = createEntity({
        id: `falcon-${config.ownerId}`,
        type: 'enemy', // Type is 'enemy' but factionId is 'player'
        subtype: 'falcon',
        position: config.position,
        hp: 1,
        maxHp: 1,
        speed: 95, // High speed, acts after player (100)
        factionId: 'player',
        activeSkills: falconSkills,
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
        shieldBearer: ['SHIELD_BASH'],
        archer: ['SPEAR_THROW'],
        bomber: ['BOMB_TOSS'],
        warlock: [],
        sentinel: ['SENTINEL_BLAST'],
    };

    return [...baseSkills, ...(typeSkills[enemyType] || [])];
}
