/**
 * TODO: review the following
 * 
 * Key Observations & Refinements
 * 1. The Serialization Problem (Sets)
 * Since you're using Set<TileTrait>, you'll run into the same issue we saw with Map in your App.tsx logic. Standard JSON.stringify converts Sets to empty objects {}.
 * 
 * Recommendation: When saving the state, you'll need a helper to convert traits to Array.from(traits) and back to new Set() on load.
 * 
 * 2. Momentum & TileHookContext
 * Adding momentum to the context is perfect for your Dash and Grapple mechanics.
 * 
 * Validation Tip: In your automated tests, you can now verify that entering a SLIPPERY tile returns a newMomentum equal to the input momentum, whereas LIQUID might return momentum - 1.
 * 
 * 3. Occupancy Redundancy
 * You have occupantId?: string inside the Tile interface.
 * 
 * Warning: Be careful of "dual source of truth" bugs here. You already have a BigInt occupancy mask and an Actor[] array in the GameState. Ensure your SpatialSystem updates all three (Mask, Tile property, and Actor position) atomically to keep the engine deterministic.
 */

import type { Point, AtomicEffect, Actor, GameState } from '../types';
import type { TileID, TileEffectID } from '../types/registry';

/**
 * Tile Traits - Modular tags defining tile properties
 * Added 'LAVA' and 'FIRE' as specific traits to bridge the gap between
 * generic behavior (HAZARDOUS) and specific visual/mechanical triggers.
 */
export type TileTrait =
    | 'WALKABLE'       // Can be walked on
    | 'BLOCKS_LOS'     // Blocks line of sight
    | 'LIQUID'         // Is a liquid (affects movement)
    | 'SWIMMABLE'      // Can be swum through
    | 'CLIMBABLE'      // Can be climbed
    | 'FLAMMABLE'      // Can catch fire
    | 'SLIPPERY'       // Preserves momentum
    | 'HAZARDOUS'      // Dangerous terrain
    | 'BLOCKS_MOVEMENT'
    | 'ANCHOR'         // Can be grappled
    | 'DAMAGING'       // Causes damage (Generic)
    | 'CORPSE'         // Persistent corpse marker for necromancy interactions
    | 'LAVA'           // Specific: Damaging + Liquid
    | 'FIRE'           // Specific: Damaging + Flammable
    | 'VOID'           // Specific: Eternal vacuum
    | 'PIT';           // Specific: Instant death/falling

/**
 * Tile Effect - Temporary condition with duration
 */
export interface TileEffectState {
    id: TileEffectID;               // "FIRE_ZONE", "BLESSED_GROUND", "OIL_SLICK"
    duration: number;               // Turns remaining (-1 = permanent)
    sourceId?: string;              // UUID of who applied it
    potency: number;                // Intensity (1-10)
    metadata?: Record<string, any>; // Extensible data
}

/**
 * Base Tile Definition (The Template)
 */
export interface BaseTile {
    id: TileID;           // "LAVA", "GRASS", "STONE"
    name: string;
    description: string;
    defaultTraits: Set<TileTrait>;
    visual?: {
        color: string;
        icon: string;
    };
}

/**
 * Tile Instance - The actual tile state at a position
 */
export interface Tile {
    baseId: TileID;                    // Reference to BaseTile
    position: Point;
    traits: Set<TileTrait>;            // Dynamic traits (e.g., Grass becomes Burnt/Empty)
    effects: TileEffectState[];        // Active temporary effects
    /** * @warning Maintain sync with GameState.occupancyMask and Actor.position 
     */
    occupantId?: string;
}

/**
 * Tile Effect Hook Context
 * Momentum is passed here to allow 'SLIPPERY' or 'LIQUID' to modify it.
 */
export interface TileHookContext {
    tile: Tile;
    actor: Actor;
    state: GameState;
    momentum?: number;
    isFinalDestination: boolean;
    source?: Point;
}

export interface TileHookResult {
    effects: AtomicEffect[];
    messages: string[];
    newMomentum?: number;
    interrupt?: boolean;        // e.g., Pitfall interrupts a Dash
    modifyTile?: Partial<Tile>; // e.g., Fire dries up a Water tile
}

/**
 * Tile Effect Definition (Behavioral Logic)
 */
export interface TileEffectDefinition {
    id: TileEffectID;
    name: string;
    description: string;

    // Lifecycle hooks
    onApply?: (context: { tile: Tile, state: GameState, potency: number, sourceId?: string }) => TileHookResult;
    onPass?: (context: TileHookContext) => TileHookResult;  // Moving through
    onEnter?: (context: TileHookContext) => TileHookResult; // Stopping or starting here
    onStay?: (context: TileHookContext) => TileHookResult;  // End of turn trigger
    onRemove?: (context: { tile: Tile, state: GameState }) => TileHookResult;

    // Interaction with other effects (e.g., Ice + Fire = Steam/Water)
    interactsWith?: Partial<Record<TileEffectID, (context: { tile: Tile, state: GameState, potency: number, sourceId?: string }) => TileHookResult>>;
}
