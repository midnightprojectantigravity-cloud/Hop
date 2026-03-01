/**
 * GAME CONSTANTS
 * Central repository for stats, types, and grid configuration.
 * Runtime ownership for enemy stats/spawn tables lives in `data/enemies/*`.
 */
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

// Hazard percentage (15-20% of map)
export const HAZARD_PERCENTAGE = 0.17;

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

