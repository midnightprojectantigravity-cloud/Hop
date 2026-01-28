import type { GameState, Point } from '../types';
import type { Tile, TileTrait } from './tile-types';
import { hexEquals, isHexInRectangularGrid } from '../hex';
import { pointToKey } from './tile-migration';

export const UnifiedTileService = {
    /**
     * getTileAt: Safe accessor for state.tiles
     * Handles:
     * - Map<string, Tile> (New System)
     * - Object/Array (Legacy/Serialization)
     * - Undefined/Null (Safety)
     */
    getTileAt(state: GameState, pos: Point): Tile | undefined {
        if (!state.tiles) return undefined;

        const key = pointToKey(pos);

        if (state.tiles instanceof Map) {
            return state.tiles.get(key);
        }

        // Handle legacy array serialization or object form
        if (Array.isArray(state.tiles)) {
            // This is slow (O(N)), but only happens if migration failed or mostly in tests
            // Ideally we migrate on load, but this is a fail-safe.
            const entry = (state.tiles as any[]).find((t: any) =>
                (Array.isArray(t) && t[0] === key) // Map.entries() format
                || (t.position && hexEquals(t.position, pos)) // Object format
            );
            return Array.isArray(entry) ? entry[1] : entry;
        }

        // Handle plain object dictionary
        return (state.tiles as any)[key];
    },

    /**
     * getTraitsAt: The Single Source of Truth
     * Combines:
     * 1. Out-of-bounds (Perimeter)
     * 2. Static Walls (Legacy Arrays)
     * 3. Tile Data (New System)
     * 4. Dynamic Effects (Ice, Fire, etc)
     */
    getTraitsAt(state: GameState, pos: Point): Set<TileTrait> {
        const traits = new Set<TileTrait>();
        const tile = this.getTileAt(state, pos);

        // 1. Perimeter Check
        const inBounds = isHexInRectangularGrid(pos, state.gridWidth, state.gridHeight);
        if (!inBounds) {
            traits.add('BLOCKS_MOVEMENT');
            traits.add('BLOCKS_LOS');
            traits.add('ANCHOR'); // Map edge is grapple-able
            return traits; // Hard stop at world edge
        }

        // 2. Static Walls (Legacy/Performance Optimization)
        if (state.wallPositions?.some(w => hexEquals(w, pos))) {
            traits.add('BLOCKS_MOVEMENT');
            traits.add('BLOCKS_LOS');
            traits.add('ANCHOR');
        }

        // 3. Tile Data
        if (tile) {
            // Base Traits
            tile.traits.forEach(t => traits.add(t));

            // Effect Traits
            tile.effects.forEach(eff => {
                // Future-proof: We can map effect IDs to traits here
                if (eff.id === 'ICE_WALL') {
                    traits.add('BLOCKS_MOVEMENT');
                    traits.add('BLOCKS_LOS');
                    traits.add('ANCHOR');
                }
                if (eff.id === 'SMOKE') traits.add('BLOCKS_LOS');
            });
        }

        // 4. Default Floor 
        // If it's in-bounds, not a wall, and has no tile data, it's walkable floor.
        if (inBounds && !tile && !traits.has('BLOCKS_MOVEMENT')) {
            traits.add('WALKABLE');
        }

        return traits;
    },

    isPassable(state: GameState, pos: Point): boolean {
        const traits = this.getTraitsAt(state, pos);
        return !traits.has('BLOCKS_MOVEMENT') && !traits.has('HAZARDOUS'); // AI shouldn't walk into hazards unless immune
    },

    isWalkable(state: GameState, pos: Point): boolean {
        const traits = this.getTraitsAt(state, pos);
        // "Walkable" usually means valid for movement, even if hazardous (player might choose to walk into fire)
        return !traits.has('BLOCKS_MOVEMENT');
    },

    isLosBlocking(state: GameState, pos: Point): boolean {
        const traits = this.getTraitsAt(state, pos);
        return traits.has('BLOCKS_LOS');
    },

    isAnchorable(state: GameState, pos: Point): boolean {
        const traits = this.getTraitsAt(state, pos);
        return traits.has('ANCHOR');
    }
};
