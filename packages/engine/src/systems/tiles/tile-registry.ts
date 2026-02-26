import type { BaseTile, TileEffectDefinition } from './tile-types';
import type { TileID, TileEffectID } from '../../types/registry';

export const BASE_TILES: Record<TileID, BaseTile> = {
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
        defaultTraits: new Set(['BLOCKS_LOS', 'BLOCKS_MOVEMENT', 'ANCHOR']),
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
    },
    STAIRS: {
        id: 'STAIRS',
        name: 'Stairs',
        description: 'Lead to the next floor',
        defaultTraits: new Set(['WALKABLE']),
        visual: { color: '#ffffff', icon: '🪜' }
    },
    SHRINE: {
        id: 'SHRINE',
        name: 'Shrine',
        description: 'A place of power',
        defaultTraits: new Set(['WALKABLE', 'ANCHOR']),
        visual: { color: '#ffd700', icon: '⛩️' }
    },
    GATE: {
        id: 'GATE',
        name: 'Gate',
        description: 'A heavy gate',
        defaultTraits: new Set(['BLOCKS_MOVEMENT', 'BLOCKS_LOS']),
        visual: { color: '#444444', icon: '🚪' }
    },
    BRIDGE: {
        id: 'BRIDGE',
        name: 'Bridge',
        description: 'Crossing the gap',
        defaultTraits: new Set(['WALKABLE']),
        visual: { color: '#8b4513', icon: '🌉' }
    }
};

export const TILE_EFFECTS: Record<TileEffectID, TileEffectDefinition> = {
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
    },
    BLESSED: {
        id: 'BLESSED',
        name: 'Blessed',
        description: 'Holy ground'
    },
    CURSED: {
        id: 'CURSED',
        name: 'Cursed',
        description: 'Unholy ground'
    },
    ICE_WALL: {
        id: 'ICE_WALL',
        name: 'Ice Wall',
        description: 'A wall of ice'
    },
    SMOKE: {
        id: 'SMOKE',
        name: 'Smoke',
        description: 'Thick smoke'
    },
    BOMB_TICK: {
        id: 'BOMB_TICK',
        name: 'Bomb Tick',
        description: 'About to explode'
    },
    TRI_TRAP: {
        id: 'TRI_TRAP',
        name: 'Kinetic Trap',
        description: 'Hidden trap that flings non-flying units outward'
    },
    SNARE: {
        id: 'SNARE',
        name: 'Snare',
        description: 'Entangling roots that halt movement and root the target.',
        onPass: (context) => {
            if (context.actor.isFlying) return { effects: [], messages: [] };
            return {
                effects: [
                    { type: 'ApplyStatus', target: context.actor.id, status: 'rooted', duration: 2 }
                ],
                messages: ['Snared! Movement halted.'],
                interrupt: true,
                newMomentum: 0
            };
        }
    }
};
