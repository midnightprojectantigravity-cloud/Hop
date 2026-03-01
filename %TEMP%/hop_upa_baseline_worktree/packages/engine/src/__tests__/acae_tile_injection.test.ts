import { describe, expect, it } from 'vitest';
import { applyEffects } from '../systems/effect-engine';
import { generateInitialState } from '../logic';
import { TileResolver } from '../systems/tiles/tile-effects';
import { pointToKey } from '../hex';

describe('ACAE tile injection', () => {
    it('lava stay injects burn counters when ACAE is enabled', () => {
        let state = generateInitialState(1, 'acae-tile-lava-seed');
        state.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };

        const playerPos = state.player.position;
        const key = pointToKey(playerPos);
        state.tiles.set(key, {
            baseId: 'LAVA',
            position: playerPos,
            traits: new Set(['LIQUID', 'HAZARDOUS', 'LAVA']),
            effects: []
        } as any);

        const stay = TileResolver.processStay(state.player, state.tiles.get(key) as any, state);
        state = applyEffects(state, stay.effects, { sourceId: state.player.id, targetId: state.player.id });

        const ailments = state.player.components?.get('ailments') as { counters?: Record<string, number> } | undefined;
        expect(Number(ailments?.counters?.burn || 0)).toBeGreaterThan(0);
        expect((state.simulationEvents || []).some(ev => ev.type === 'AilmentChanged')).toBe(true);
    });
});

