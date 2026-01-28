import type { Point, AtomicEffect, Actor, GameState } from '../types';

/**
 * Tile Traits - Modular tags defining tile properties
 */
export type TileTrait =
    | 'WALKABLE'      // Can be walked on
    | 'BLOCKS_LOS'    // Blocks line of sight
    | 'LIQUID'        // Is a liquid (affects movement)
    | 'SWIMMABLE'     // Can be swum through
    | 'CLIMBABLE'     // Can be climbed
    | 'FLAMMABLE'     // Can catch fire
    | 'SLIPPERY'      // Preserves momentum
    | 'HAZARDOUS';    // Dangerous terrain

/**
 * Tile Effect - Temporary condition with duration
 */
export interface TileEffectState {
    id: string;           // "FIRE", "BLESSED", "OIL"
    duration: number;     // Turns remaining (-1 = permanent)
    sourceId?: string;    // UUID of who applied it
    potency: number;      // Intensity (1-10)
    metadata?: Record<string, any>; // Extensible data
}

/**
 * Base Tile Definition
 */
export interface BaseTile {
    id: string;           // "LAVA", "GRASS", "STONE"
    name: string;
    description: string;
    defaultTraits: Set<TileTrait>;
    visual?: {
        color: string;
        icon: string;
    };
}

/**
 * Tile Instance - The actual tile at a position
 */
export interface Tile {
    baseId: string;                    // Reference to BaseTile
    position: Point;
    traits: Set<TileTrait>;            // Can be modified from defaults
    effects: TileEffectState[];        // Active temporary effects
    occupantId?: string;               // Reference to Actor
}

/**
 * Tile Effect Hook Context
 */
export interface TileHookContext {
    tile: Tile;
    actor: Actor;
    state: GameState;
    momentum?: number;
    isFinalDestination: boolean;
    source?: Point;
}

/**
 * Tile Effect Hook Result
 */
export interface TileHookResult {
    effects: AtomicEffect[];
    messages: string[];
    newMomentum?: number;
    interrupt?: boolean;
    modifyTile?: Partial<Tile>; // Allow hooks to modify the tile
}

/**
 * Tile Effect Definition (behavior)
 */
export interface TileEffectDefinition {
    id: string;
    name: string;
    description: string;

    // Lifecycle hooks
    onApply?: (context: { tile: Tile, state: GameState, potency: number, sourceId?: string }) => TileHookResult;
    onPass?: (context: TileHookContext) => TileHookResult;
    onEnter?: (context: TileHookContext) => TileHookResult;
    onStay?: (context: TileHookContext) => TileHookResult;
    onRemove?: (context: { tile: Tile, state: GameState }) => TileHookResult;

    // Interaction with other effects
    interactsWith?: Record<string, (context: { tile: Tile, state: GameState, potency: number, sourceId?: string }) => TileHookResult>;
}
