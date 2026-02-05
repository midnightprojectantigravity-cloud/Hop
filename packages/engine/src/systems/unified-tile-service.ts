import type { GameState, Point } from '../types';
import type { Tile, TileTrait } from './tile-types';
export { pointToKey } from '../hex';
import { hexEquals, isHexInRectangularGrid, pointToKey } from '../hex';

export const UnifiedTileService = {
    /**
     * getTileAt: Safe accessor for state.tiles
     * Always returns a Tile object (uses fallback if missing)
     */
    getTileAt(state: GameState, pos: Point): Tile {
        const key = pointToKey(pos);
        let tile: any = undefined;

        if (state.tiles) {
            if (state.tiles instanceof Map) {
                tile = state.tiles.get(key);
            } else if (Array.isArray(state.tiles)) {
                tile = (state.tiles as any[]).find((t: any) =>
                    (Array.isArray(t) && t[0] === key) ||
                    (t.position && hexEquals(t.position, pos))
                );
            } else {
                tile = (state.tiles as any)[key];
            }
        }

        if (tile) return tile as Tile;

        // Fallback: Default playable floor
        return {
            position: pos,
            baseId: 'STONE',
            traits: new Set(['WALKABLE']),
            effects: []
        };
    },

    /**
     * getTraitsAt: The Single Source of Truth
     * Combines:
     * 1. Out-of-bounds (Perimeter)
     * 2. Static Walls (Legacy Arrays)
     * 3. Tile Data (New System)
     * 4. Dynamic Effects (Ice, Fire, etc)
     */
    /**
     * getTraitsForTile: Internal helper to map a Tile object to its actual traits
     * Combines baseId mappings, instance traits, and dynamic effects.
     */
    getTraitsForTile(state: GameState, tile: Tile): Set<TileTrait> {
        const traits = new Set<TileTrait>();
        const pos = tile.position;

        // 1. Perimeter Check
        const inBounds = isHexInRectangularGrid(pos, state.gridWidth, state.gridHeight);
        if (!inBounds) {
            traits.add('BLOCKS_MOVEMENT');
            traits.add('BLOCKS_LOS');
            traits.add('ANCHOR');
            return traits;
        }

        // 2. Base ID Mappings (Fallback for lost traits during serialization)
        if (tile.baseId === 'LAVA') {
            traits.add('HAZARDOUS');
            traits.add('LIQUID');
            traits.add('LAVA' as TileTrait); // Added for visual targeting
        }
        if (tile.baseId === 'WALL') {
            traits.add('BLOCKS_MOVEMENT');
            traits.add('BLOCKS_LOS');
            traits.add('ANCHOR');
        }

        // 3. Instance Traits (The Set we hydrate on load)
        tile.traits.forEach(t => traits.add(t));

        // 4. Dynamic Effect Mappings (Fireball/Firewall logic)
        tile.effects.forEach(eff => {
            if (eff.id === 'FIRE') {
                traits.add('FIRE' as TileTrait);      // Critical for visuals
                traits.add('HAZARDOUS'); // Critical for AI/Damage
            }
            if (eff.id === 'ICE_WALL') {
                traits.add('BLOCKS_MOVEMENT');
                traits.add('BLOCKS_LOS');
                traits.add('ANCHOR');
            }
            if (eff.id === 'SMOKE') {
                traits.add('BLOCKS_LOS');
            }
        });

        return traits;
    },

    getTraitsAt(state: GameState, pos: Point): Set<TileTrait> {
        const tile = this.getTileAt(state, pos);
        return this.getTraitsForTile(state, tile);
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
    },

    hasTrait(state: GameState, pos: Point, trait: TileTrait): boolean {
        return this.getTraitsAt(state, pos).has(trait);
    },
};
