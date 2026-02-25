/**
 * GAME CONSTANTS
 * Central repository for stats, types, and grid configuration.
 * TODO: Move balance-heavy stats (ENEMY_STATS, INITIAL_PLAYER_STATS) to an external JSON for easier modding.
 */
import { ENEMY_BESTIARY } from './data/bestiary';
// Grid configuration for mobile portrait (9 wide × 11 tall)
export const GRID_WIDTH = 7;   // Tiles wide
export const GRID_HEIGHT = 9;  // Tiles tall
export const TILE_SIZE = 36;   // Pixel size for mobile-friendly rendering

// Legacy constant for backwards compat (will be phased out)
export const GRID_RADIUS = 5;

export const INITIAL_PLAYER_STATS = {
    hp: 3,
    maxHp: 3,
    speed: 1,        // Player baseline speed
    energy: 100,
    temporaryArmor: 0, // From Shield passive
};

// Skill system - 3 slots with cooldowns
export const SKILL_SLOTS = {
    OFFENSIVE: 'offensive',  // Default: Spear
    DEFENSIVE: 'defensive',  // Default: Shield Bash
    UTILITY: 'utility',      // Default: Jump
} as const;

// Default skill configurations
export const DEFAULT_SKILLS = {
    spear: {
        id: 'SPEAR_THROW',
        name: 'Spear Throw',
        slot: 'offensive',
        range: 2,
        cooldown: 0, // Disabled until picked up (special case)
        damage: 999, // Instant kill
        upgrades: ['SPEAR_RANGE', 'RECALL', 'RECALL_DAMAGE', 'LUNGE', 'LUNGE_ARC', 'DEEP_BREATH', 'SPEAR_CLEAVE'],
    },
    shield: {
        id: 'SHIELD_BASH',
        name: 'Shield Bash',
        slot: 'defensive',
        range: 1,
        cooldown: 2,
        pushDistance: 1,
        upgrades: ['SHIELD_RANGE', 'SHIELD_COOLDOWN', 'ARC_BASH', 'BASH_360', 'PASSIVE_PROTECTION', 'WALL_SLAM'],
    },
    jump: {
        id: 'JUMP',
        name: 'Jump',
        slot: 'utility',
        range: 2,
        cooldown: 2,
        upgrades: ['JUMP_RANGE', 'JUMP_COOLDOWN', 'STUNNING_LANDING', 'METEOR_IMPACT', 'FREE_JUMP'],
    },
};

export const STATUS_REGISTRY: Record<string, { tickWindow: 'START_OF_TURN' | 'END_OF_TURN' }> = {
    stunned: { tickWindow: 'START_OF_TURN' },
    poisoned: { tickWindow: 'START_OF_TURN' },
    armored: { tickWindow: 'END_OF_TURN' },
    hidden: { tickWindow: 'END_OF_TURN' },
    time_bomb: { tickWindow: 'END_OF_TURN' },
};

const bestiaryStat = <T extends keyof typeof ENEMY_BESTIARY>(subtype: T) => {
    const def = ENEMY_BESTIARY[subtype];
    return {
        hp: def.stats.hp,
        maxHp: def.stats.maxHp,
        range: def.stats.range,
        damage: def.stats.damage,
        type: def.stats.type,
        cost: def.stats.cost,
        skills: [...def.skills.base, ...def.skills.passive],
        actionCooldown: def.stats.actionCooldown,
        weightClass: def.stats.weightClass,
        speed: def.stats.speed,
    };
};

// Enemy stats with simplified tiers (derived from the bestiary baseline)
export const ENEMY_STATS = {
    footman: bestiaryStat('footman'),
    sprinter: bestiaryStat('sprinter'),
    raider: bestiaryStat('raider'),
    pouncer: bestiaryStat('pouncer'),
    shieldBearer: bestiaryStat('shieldBearer'),
    archer: bestiaryStat('archer'),
    bomber: bestiaryStat('bomber'),
    warlock: bestiaryStat('warlock'),
    sentinel: bestiaryStat('sentinel'),
};

// Hazard percentage (15-20% of map)
export const HAZARD_PERCENTAGE = 0.17;

// Floor enemy budget
export const FLOOR_ENEMY_BUDGET = [
    0,   // Floor 0
    2,   // Floor 1
    3,   // Floor 2
    5,   // Floor 3
    7,   // Floor 4
    10,  // Floor 5
    12,  // Floor 6
    15,  // Floor 7
    18,  // Floor 8
    22,  // Floor 9
    0,   // Floor 10 (reserved / empty for now)
];

// Color palette from design doc
export const COLORS = {
    player: '#3b82f6',      // Blue
    playerBorder: '#ffffff', // White border
    enemy: '#ef4444',        // Red
    floor: '#6b7b3c',        // Olive Green
    wall: '#374151',         // Dark Grey
    lava: '#991b1b',         // Dark Red
    shrine: '#f97316',       // Orange
    portal: '#ffffff',       // White
} as const;

// Themes per floor range
export const FLOOR_THEMES: Record<number, string> = {
    1: 'inferno',
    2: 'inferno',
    3: 'inferno',
    4: 'inferno',
    5: 'inferno',
    6: 'inferno',
    7: 'inferno',
    8: 'inferno',
    9: 'inferno',
    10: 'inferno',
};

// Available enemy types per floor proficiency
export const FLOOR_ENEMY_TYPES: Record<number, string[]> = {
    1: ['footman'],
    2: ['footman', 'sprinter'],
    3: ['footman', 'archer'],
    4: ['footman', 'archer', 'bomber', 'raider'],
    5: ['footman', 'archer', 'bomber', 'shieldBearer', 'raider'],
    6: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'pouncer'],
    7: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'],
    8: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'],
    9: ['footman', 'archer', 'bomber', 'shieldBearer', 'warlock', 'sprinter', 'pouncer'],
    10: []
};
