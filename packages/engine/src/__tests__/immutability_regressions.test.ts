import { describe, expect, it } from 'vitest';
import { generateInitialState, processNextTurn } from '../logic';
import { hydrateLoadedState } from '../logic-rules';
import { pointToKey } from '../hex';

describe('immutability regressions', () => {
    it('hydrateLoadedState does not mutate its input object', () => {
        const base = generateInitialState(1, 'hydrate-pure-seed');
        const loadedLike: any = {
            ...base,
            tiles: Array.from(base.tiles.entries()).map(([key, tile]) => [
                key,
                {
                    ...tile,
                    traits: Array.from(tile.traits),
                    effects: [...tile.effects]
                }
            ]),
            player: { ...base.player },
            enemies: base.enemies.map(enemy => ({ ...enemy }))
        };

        const inputTilesRef = loadedLike.tiles;
        const inputPlayerRef = loadedLike.player;
        const result = hydrateLoadedState(loadedLike);

        expect(Array.isArray(loadedLike.tiles)).toBe(true);
        expect(loadedLike.tiles).toBe(inputTilesRef);
        expect(loadedLike.player).toBe(inputPlayerRef);
        expect(result).not.toBe(loadedLike);
        expect(result.tiles instanceof Map).toBe(true);
    });

    it('processNextTurn does not mutate input occupancy mask in place', () => {
        const state = generateInitialState(1, 'turn-loop-immutability-seed');
        const originalMaskRef = state.occupancyMask;
        const originalMaskValue = state.occupancyMask[0];
        const originalPlayerPos = pointToKey(state.player.position);

        const next = processNextTurn(state, false);

        expect(next).not.toBe(state);
        expect(state.occupancyMask).toBe(originalMaskRef);
        expect(state.occupancyMask[0]).toBe(originalMaskValue);
        expect(pointToKey(state.player.position)).toBe(originalPlayerPos);
    });
});
