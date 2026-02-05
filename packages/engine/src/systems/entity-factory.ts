import type { Actor, Point, Skill, WeightClass } from '../types';
import type { GameComponent } from './components';
import { SkillRegistry } from '../skillRegistry';

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
    skills: string[]; // Skill IDs to include

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
    const activeSkills: Skill[] = config.skills.map(skillId => {
        const def = SkillRegistry[skillId];
        if (!def) {
            console.warn(`Skill ${skillId} not found in registry`);
            return null;
        }

        return {
            id: def.id,
            name: def.name,
            description: def.description,
            slot: def.slot,
            cooldown: def.baseVariables.cooldown,
            currentCooldown: 0,
            range: def.baseVariables.range,
            upgrades: Object.keys(def.upgrades),
            activeUpgrades: [],
            energyCost: def.baseVariables.cost,
        };
    }).filter(Boolean) as Skill[];

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
    const entity = createEntity({
        id: `falcon-${config.ownerId}`,
        type: 'enemy', // Type is 'enemy' but factionId is 'player'
        subtype: 'falcon',
        position: config.position,
        hp: 1,
        maxHp: 1,
        speed: 95, // High speed, acts after player (100)
        factionId: 'player',
        skills: ['BASIC_MOVE', 'FALCON_PECK'], // Falcon has basic movement and attack
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
        bomber: [],
        warlock: [],
        sentinel: ['SENTINEL_BLAST'],
    };

    return [...baseSkills, ...(typeSkills[enemyType] || [])];
}
