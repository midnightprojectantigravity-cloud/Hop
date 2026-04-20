import { describe, expect, it } from 'vitest';
import type { GameState } from '../types';
import { createHex, pointToKey } from '../hex';
import { UnifiedTileService } from '../systems/tiles/unified-tile-service';

describe('unified tile service contract', () => {
    it('reads tiles from the Map-backed runtime state', () => {
        const pos = createHex(1, -1);
        const tile = {
            baseId: 'LAVA' as const,
            position: pos,
            traits: new Set(['HAZARDOUS', 'LIQUID']),
            effects: []
        };
        const state = {
            tiles: new Map([[pointToKey(pos), tile]]),
            gridWidth: 8,
            gridHeight: 8,
            mapShape: 'rect'
        } as unknown as GameState;

        expect(UnifiedTileService.getTileAt(state, pos)).toBe(tile);
    });

    it('falls back when the caller does not provide a Map-backed tile store', () => {
        const pos = createHex(2, -1);
        const tile = {
            baseId: 'STONE' as const,
            position: pos,
            traits: new Set(['WALKABLE']),
            effects: []
        };
        const legacyState = {
            tiles: { [pointToKey(pos)]: tile },
            gridWidth: 8,
            gridHeight: 8,
            mapShape: 'rect'
        } as unknown as GameState;

        expect(UnifiedTileService.getTileAt(legacyState, pos)).toEqual({
            position: pos,
            baseId: 'STONE',
            traits: new Set(['WALKABLE']),
            effects: []
        });
    });
});
