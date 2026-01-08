/**
 * STRATEGIC HUB & META SYSTEM
 * Handles character loadouts and persistence.
 * Goal: Meta - Allows for pre-game character customization.
 * TODO: Implement "Cloud Save" by integrating with an external database/API.
 */
import type { Skill } from './types';
import { createSkill } from './skills';

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
    SKISHER: {
        id: 'SKISHER',
        name: 'Skisher',
        description: 'Standard spear and shield loadout. Balanced.',
        startingUpgrades: [],
        startingSkills: ['BASIC_ATTACK', 'AUTO_ATTACK', 'SPEAR_THROW', 'SHIELD_BASH', 'JUMP']
    },
    VANGUARD: {
        id: 'VANGUARD',
        name: 'Vanguard',
        description: 'Aggressive shield user. Starts with SHIELD_RANGE.',
        startingUpgrades: ['SHIELD_RANGE'],
        startingSkills: ['BASIC_ATTACK', 'AUTO_ATTACK', 'SHIELD_BASH', 'JUMP']
    },
    SNIPER: {
        id: 'SNIPER',
        name: 'Sniper',
        description: 'Spear specialist. Starts with SPEAR_RANGE.',
        startingUpgrades: ['SPEAR_RANGE'],
        startingSkills: ['BASIC_ATTACK', 'AUTO_ATTACK', 'SPEAR_THROW', 'JUMP']
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
export const applyLoadoutToPlayer = (loadout: Loadout): { upgrades: string[]; activeSkills: Skill[] } => {
    const activeSkills = loadout.startingSkills.map(s => createSkill(s)).filter(Boolean) as Skill[];
    return {
        upgrades: [...loadout.startingUpgrades],
        activeSkills
    };
};
