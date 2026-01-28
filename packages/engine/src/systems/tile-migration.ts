import type { Point, GameState } from '../types';
import type { Tile } from './tile-types';
import { BASE_TILES } from './tile-registry';

/**
 * Migration Utilities for the new Tile System
 */

export const pointToKey = (p: Point): string => `${p.q},${p.r}`;

export function createInitialTileGrid(allHexes: Point[]): Map<string, Tile> {
    const tiles = new Map<string, Tile>();
    for (const h of allHexes) {
        tiles.set(pointToKey(h), {
            baseId: 'STONE', // Default to stone
            position: h,
            traits: new Set(BASE_TILES.STONE.defaultTraits),
            effects: []
        });
    }
    return tiles;
}

export function migratePositionArraysToTiles(state: GameState): Map<string, Tile> {
    const tiles = createInitialTileGrid([]); // Base logic for an empty grid if needed, usually we start with one

    // If state already has allHexes from generation, we should use that
    // But for migration, let's assume we are transforming an existing state

    // 1. Walls
    state.wallPositions.forEach(p => {
        tiles.set(pointToKey(p), {
            baseId: 'WALL',
            position: p,
            traits: new Set(BASE_TILES.WALL.defaultTraits),
            effects: []
        });
    });

    // 2. Lava
    state.lavaPositions.forEach(p => {
        tiles.set(pointToKey(p), {
            baseId: 'LAVA',
            position: p,
            traits: new Set(BASE_TILES.LAVA.defaultTraits),
            effects: []
        });
    });

    // 3. Fire
    state.firePositions?.forEach(fp => {
        const key = pointToKey(fp.pos);
        let tile = tiles.get(key);
        if (!tile) {
            tile = {
                baseId: 'STONE',
                position: fp.pos,
                traits: new Set(BASE_TILES.STONE.defaultTraits),
                effects: []
            };
            tiles.set(key, tile);
        }
        tile.effects.push({ id: 'FIRE', duration: fp.duration, potency: 1 });
    });

    // 4. Ice (Slippery)
    state.slipperyPositions?.forEach(p => {
        const key = pointToKey(p);
        let tile = tiles.get(key);
        if (tile) {
            tile.baseId = 'ICE';
            tile.traits = new Set(BASE_TILES.ICE.defaultTraits);
        } else {
            tiles.set(key, {
                baseId: 'ICE',
                position: p,
                traits: new Set(BASE_TILES.ICE.defaultTraits),
                effects: []
            });
        }
    });

    return tiles;
}
