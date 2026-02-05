/**
 * VISUAL REGISTRY SYSTEM
 * 
 * Single source of truth for entity visual properties.
 * The visual layer (React components) imports this registry to ensure
 * rendering stays synchronized with engine entity definitions.
 */

export type EntityShape = 'diamond' | 'triangle' | 'circle' | 'square';

export interface EntityVisualConfig {
    icon: string;              // Emoji or icon reference
    shape: EntityShape;
    color: string;             // Primary fill color
    borderColor: string;
    isRanged: boolean;         // Determines default shape (diamond vs triangle)
    showFacing?: boolean;      // Show directional indicator (e.g., shieldBearer)
    showTimer?: boolean;       // Show countdown timer (e.g., bomb)
    size?: number;             // Relative size multiplier (default: 1.0)
    opacity?: number;          // Base opacity (default: 1.0)
}

/**
 * Visual configurations for all entity subtypes
 */
export const ENTITY_VISUALS: Record<string, EntityVisualConfig> = {
    // Player
    player: {
        icon: '⚔️',
        shape: 'square',
        color: '#3b82f6',
        borderColor: '#ffffff',
        isRanged: false,
    },
    vanguard: {
        icon: '🔱',
        shape: 'square',
        color: '#3b82f6',
        borderColor: '#ffffff',
        isRanged: false,
    },
    skirmisher: {
        icon: '⚡',
        shape: 'square',
        color: '#3b82f6',
        borderColor: '#fbbf24',
        isRanged: false,
    },
    firemage: {
        icon: '🔥',
        shape: 'square',
        color: '#ef4444',
        borderColor: '#fbbf24',
        isRanged: true,
    },
    necromancer: {
        icon: '💀',
        shape: 'square',
        color: '#6b21a8',
        borderColor: '#9333ea',
        isRanged: true,
    },
    hunter: {
        icon: '🏹',
        shape: 'square',
        color: '#10b981',
        borderColor: '#ffffff',
        isRanged: true,
    },
    assassin_player: {
        icon: '👤',
        shape: 'square',
        color: '#1f2937',
        borderColor: '#ffffff',
        isRanged: false,
    },

    // Melee Enemies
    footman: {
        icon: '⚔️',
        shape: 'diamond',
        color: '#ef4444',
        borderColor: '#ffffff',
        isRanged: false,
    },
    sprinter: {
        icon: '⚡',
        shape: 'diamond',
        color: '#ef4444',
        borderColor: '#ffffff',
        isRanged: false,
        size: 0.9, // Slightly smaller, faster
    },
    spear: {
        icon: '🔱',
        shape: 'circle',
        color: '#ffffff',
        borderColor: '#3b82f6',
        isRanged: false,
        size: 0.8,
        opacity: 0.9,
    },
    shieldBearer: {
        icon: '🛡️',
        shape: 'diamond',
        color: '#ef4444',
        borderColor: '#fbbf24', // Gold border for shield
        isRanged: false,
        showFacing: true,
    },
    golem: {
        icon: '🗿',
        shape: 'diamond',
        color: '#78716c',
        borderColor: '#ffffff',
        isRanged: false,
        size: 1.2, // Larger, heavier
    },
    assassin: {
        icon: '🗡️',
        shape: 'diamond',
        color: '#6b21a8',
        borderColor: '#ffffff',
        isRanged: false,
    },

    // Ranged Enemies
    archer: {
        icon: '🏹',
        shape: 'triangle',
        color: '#ef4444',
        borderColor: '#ffffff',
        isRanged: true,
    },
    bomber: {
        icon: '💣',
        shape: 'circle',
        color: '#ef4444',
        borderColor: '#ffffff',
        isRanged: true,
    },
    warlock: {
        icon: '🔮',
        shape: 'triangle',
        color: '#9333ea', // Purple for magic
        borderColor: '#ffffff',
        isRanged: true,
    },

    // Special Entities
    bomb: {
        icon: '💣',
        shape: 'circle',
        color: '#1f2937',
        borderColor: '#000000',
        isRanged: false,
        showTimer: true,
    },
    falcon: {
        icon: '🦅',
        shape: 'circle',
        color: '#3b82f6', // Player blue (friendly)
        borderColor: '#ffffff',
        isRanged: false,
        size: 0.8, // Smaller, flying creature
    },

    // Boss
    sentinel: {
        icon: '👑',
        shape: 'diamond',
        color: '#dc2626',
        borderColor: '#fbbf24', // Gold border for boss
        isRanged: true,
        size: 1.5, // Much larger
    },
};

/**
 * Get visual configuration for an entity
 * Falls back to sensible defaults if subtype not found
 */
export function getEntityVisual(
    subtype: string | undefined,
    type: 'player' | 'enemy',
    enemyType?: 'melee' | 'ranged' | 'boss',
    archetype?: string
): EntityVisualConfig {
    // 1. Direct subtype match
    if (subtype && ENTITY_VISUALS[subtype]) {
        return ENTITY_VISUALS[subtype];
    }

    // 2. Archetype match for player
    if (type === 'player' && archetype) {
        const archKey = archetype === 'ASSASSIN' ? 'assassin_player' : archetype.toLowerCase();
        if (ENTITY_VISUALS[archKey]) {
            return ENTITY_VISUALS[archKey];
        }
    }

    // 3. Player fallback
    if (type === 'player') {
        return ENTITY_VISUALS.player;
    }

    // Enemy fallback based on enemyType
    if (enemyType === 'ranged') {
        return {
            icon: '🎯',
            shape: 'triangle',
            color: '#ef4444',
            borderColor: '#ffffff',
            isRanged: true,
        };
    }

    if (enemyType === 'boss') {
        return {
            icon: '👑',
            shape: 'diamond',
            color: '#dc2626',
            borderColor: '#fbbf24',
            isRanged: false,
            size: 1.5,
        };
    }

    // Default melee enemy
    return {
        icon: '❓',
        shape: 'diamond',
        color: '#ef4444',
        borderColor: '#ffffff',
        isRanged: false,
    };
}

/**
 * Check if an entity should show a flying indicator
 */
export function isEntityFlying(entity: { isFlying?: boolean; subtype?: string }): boolean {
    return entity.isFlying === true;
}

/**
 * Get companion mode display info
 */
export function getCompanionModeVisual(mode: 'scout' | 'predator' | 'roost' | undefined): {
    icon: string;
    color: string;
    label: string;
} | null {
    if (!mode) return null;

    const modes = {
        scout: { icon: '👁️', color: '#3b82f6', label: 'Scout' },
        predator: { icon: '🎯', color: '#ef4444', label: 'Hunt' },
        roost: { icon: '🏠', color: '#10b981', label: 'Roost' },
    };

    return modes[mode];
}
