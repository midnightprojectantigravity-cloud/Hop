/**
 * STRATEGIC HUB & META SYSTEM
 * Handles character loadouts and persistence.
 * Goal: Meta - Allows for pre-game character customization.
 * TODO: Implement "Cloud Save" by integrating with an external database/API.
 */
import type { Skill } from '../types';
import { createSkill } from './legacy-skills';

export interface Loadout {
    id: string;
    name: string;
    description: string;
    startingUpgrades: string[];
    startingSkills: string[];
}

/**
 * Default Loadouts for the "Strategic Hub"
 */
export const DEFAULT_LOADOUTS: Record<string, Loadout> = {
    VANGUARD: {
        id: 'VANGUARD',
        name: 'Vanguard',
        description: 'Direct damage, brawling, and area denial.',
        startingUpgrades: [],
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'AUTO_ATTACK', 'SPEAR_THROW', 'SHIELD_BASH', 'JUMP']
    },
    SKIRMISHER: {
        id: 'SKIRMISHER',
        name: 'Skirmisher',
        description: 'Zero direct damage. Kinetic momentum and environmental lethality.',
        startingUpgrades: [],
        startingSkills: ['DASH', 'GRAPPLE_HOOK', 'SHIELD_THROW', 'VAULT']
    },
    FIREMAGE: {
        id: 'FIREMAGE',
        name: 'Fire Mage',
        description: 'Area control with fire and high-damage spells.',
        startingUpgrades: [],
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'FIREBALL', 'FIREWALL', 'FIREWALK']
    },
    NECROMANCER: {
        id: 'NECROMANCER',
        name: 'Necromancer',
        description: 'Utilize death and reanimation.',
        startingUpgrades: [],
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'CORPSE_EXPLOSION', 'RAISE_DEAD', 'SOUL_SWAP']
    },
    HUNTER: {
        id: 'HUNTER',
        name: 'Hunter',
        description: 'Ranged precision and traps.',
        startingUpgrades: [],
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'MULTI_SHOOT', 'SET_TRAP', 'SWIFT_ROLL']
    },
    ASSASSIN: {
        id: 'ASSASSIN',
        name: 'Assassin',
        description: 'Stealth and high burst damage.',
        startingUpgrades: [],
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'SNEAK_ATTACK', 'SMOKE_SCREEN', 'SHADOW_STEP']
    }
};

/**
 * Serialize a loadout to JSON for storage.
 */
export const serializeLoadout = (loadout: Loadout): string => {
    return JSON.stringify(loadout);
};

/**
 * Deserialize a loadout from JSON.
 */
export const deserializeLoadout = (json: string): Loadout => {
    return JSON.parse(json);
};

/**
 * Apply a loadout to a set of player stats.
 */
export const applyLoadoutToPlayer = (loadout: Loadout): { upgrades: string[]; activeSkills: Skill[]; archetype: any } => {
    const activeSkills = loadout.startingSkills.map(s => createSkill(s)).filter(Boolean) as Skill[];
    const archetype = loadout.id;
    return {
        upgrades: [...loadout.startingUpgrades],
        activeSkills,
        archetype
    };
};
