import type { BaseTile, TileEffectDefinition } from './tile-types';

export const BASE_TILES: Record<string, BaseTile> = {
    GRASS: {
        id: 'GRASS',
        name: 'Grass',
        description: 'Soft grass',
        defaultTraits: new Set(['WALKABLE', 'FLAMMABLE']),
        visual: { color: '#4a7c59', icon: '🌱' }
    },
    STONE: {
        id: 'STONE',
        name: 'Stone Floor',
        description: 'Hard stone',
        defaultTraits: new Set(['WALKABLE']),
        visual: { color: '#808080', icon: '⬜' }
    },
    LAVA: {
        id: 'LAVA',
        name: 'Lava',
        description: 'Molten lava',
        defaultTraits: new Set(['LIQUID', 'HAZARDOUS']),
        visual: { color: '#ff4400', icon: '🌋' }
    },
    WALL: {
        id: 'WALL',
        name: 'Wall',
        description: 'Solid wall',
        defaultTraits: new Set(['BLOCKS_LOS']),
        visual: { color: '#333333', icon: '🧱' }
    },
    ICE: {
        id: 'ICE',
        name: 'Ice',
        description: 'Slippery ice',
        defaultTraits: new Set(['WALKABLE', 'SLIPPERY']),
        visual: { color: '#aaddff', icon: '❄️' }
    },
    VOID: {
        id: 'VOID',
        name: 'Void',
        description: 'The endless void',
        defaultTraits: new Set(['HAZARDOUS']),
        visual: { color: '#000000', icon: '⚫' }
    }
};

export const TILE_EFFECTS: Record<string, TileEffectDefinition> = {
    FIRE: {
        id: 'FIRE',
        name: 'Fire',
        description: 'Burning flames',

        onStay: (context) => ({
            effects: [
                { type: 'Damage', target: context.actor.id, amount: 1, reason: 'fire_damage' }
            ],
            messages: [`${context.actor.subtype || context.actor.type} burns!`]
        }),

        interactsWith: {
            WET: (context) => ({
                effects: [
                    { type: 'Juice', effect: 'flash', target: context.tile.position, color: '#aaaaaa' }
                ],
                messages: ['Steam rises!'],
                modifyTile: {
                    effects: context.tile.effects.filter(e => e.id !== 'FIRE' && e.id !== 'WET' && e.id !== 'STEAM').concat({
                        id: 'STEAM',
                        duration: 2,
                        potency: 1
                    })
                }
            })
        }
    },

    WET: {
        id: 'WET',
        name: 'Wet',
        description: 'Soaked with water',

        onApply: (context) => {
            // Extinguish fire if present
            const hasFire = context.tile.effects.some(e => e.id === 'FIRE');
            if (hasFire) {
                return {
                    effects: [],
                    messages: ['Water extinguishes the flames!'],
                    modifyTile: {
                        effects: context.tile.effects.filter(e => e.id !== 'FIRE')
                    }
                };
            }
            return { effects: [], messages: [] };
        }
    },

    OIL: {
        id: 'OIL',
        name: 'Oil',
        description: 'Slippery oil',

        interactsWith: {
            FIRE: (context) => ({
                effects: [
                    { type: 'Damage', target: 'area', amount: 3, reason: 'oil_explosion' },
                    { type: 'Juice', effect: 'explosion_ring', target: context.tile.position }
                ],
                messages: ['Oil explodes!'],
                modifyTile: {
                    effects: context.tile.effects.filter(e => e.id !== 'OIL')
                }
            })
        }
    },

    STEAM: {
        id: 'STEAM',
        name: 'Steam',
        description: 'Obscuring steam cloud',
        // Example: could affect LOS
    }
};
