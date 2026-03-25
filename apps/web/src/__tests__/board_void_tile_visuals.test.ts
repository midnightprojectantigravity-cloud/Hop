import { describe, expect, it } from 'vitest';
import { pointToKey, type GameState, type Point } from '@hop/engine';
import { resolveBoardTileVisualFlags } from '../components/game-board/useBoardBiomeVisuals';
import { resolveTileAssetId } from '../visual/asset-selectors';

const VOID_TILE: Point = { q: 2, r: 5, s: -7 };

const createGameState = (): GameState => {
    const tileKey = pointToKey(VOID_TILE);
    return {
        gridWidth: 9,
        gridHeight: 11,
        mapShape: 'diamond',
        tiles: new Map([
            [tileKey, {
                baseId: 'VOID',
                position: VOID_TILE,
                traits: new Set(['HAZARDOUS']),
                effects: [],
            }],
        ]),
    } as unknown as GameState;
};

describe('board void tile visuals', () => {
    it('classifies VOID base tiles as void visuals even without a VOID trait', () => {
        const flagsByKey = resolveBoardTileVisualFlags(createGameState(), [VOID_TILE]);

        expect(flagsByKey.get(pointToKey(VOID_TILE))).toEqual({
            isWall: false,
            isLava: false,
            isFire: false,
            isVoid: true,
        });
    });

    it('uses the dedicated void tile asset regardless of biome theme', () => {
        expect(resolveTileAssetId({ theme: 'inferno', isVoid: true })).toBe('tile.void.floor.01');
    });
});
