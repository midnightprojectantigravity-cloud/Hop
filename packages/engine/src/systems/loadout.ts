/**
 * STRATEGIC HUB & META SYSTEM
 * Handles character loadouts and persistence.
 * Goal: Meta - Allows for pre-game character customization.
 * TODO: Implement "Cloud Save" by integrating with an external database/API.
 */
import type { Skill, Actor } from '../types';
import { createActiveSkill } from '../skillRegistry';

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
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'ABSORB_FIRE', 'FIREBALL', 'FIREWALL', 'FIREWALK']
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
        startingSkills: ['BASIC_MOVE', 'BASIC_ATTACK', 'FALCON_COMMAND', 'KINETIC_TRI_TRAP', 'WITHDRAWAL']
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
    const activeSkills = loadout.startingSkills.map(s => createActiveSkill(s as any)).filter(Boolean) as Skill[];
    const archetype = loadout.id;
    return {
        upgrades: [...loadout.startingUpgrades],
        activeSkills,
        archetype
    };
};

const hasMovementSkill = (skills: Skill[]): boolean =>
    skills.some(s => s.id === 'BASIC_MOVE' || s.id === 'DASH');

/**
 * Guard against stale saves / migrations that accidentally strip movement passives.
 */
export const ensureMobilitySkill = (skills: Skill[] = []): Skill[] => {
    if (hasMovementSkill(skills)) return skills;
    const fallback = createActiveSkill('BASIC_MOVE') as Skill | null;
    return fallback ? [fallback, ...skills] : skills;
};

/**
 * World-state integrity helper for player actors loaded from snapshots/replays.
 */
export const ensurePlayerLoadoutIntegrity = (player: Actor): Actor => {
    const currentSkills = player.activeSkills || [];
    const normalizedSkills = ensureMobilitySkill(currentSkills);
    if (normalizedSkills === currentSkills) {
        return player;
    }

    return {
        ...player,
        activeSkills: normalizedSkills,
    };
};
