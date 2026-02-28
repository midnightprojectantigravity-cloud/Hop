import type { LoadoutCatalog } from './contracts';

/**
 * Canonical built-in player loadout content.
 * Runtime hydration/resolution lives in `systems/loadout.ts`.
 */
export const DEFAULT_LOADOUT_DEFINITIONS: LoadoutCatalog = {
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

