import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { processKineticPulse } from '../systems/movement/kinetic-kernel';
import { BASE_TILES } from '../systems/tiles/tile-registry';

const setupBlockedPulseState = () => {
    const state = generateInitialState(1, 'kinetic-collision-policy-seed');
    const origin = createHex(4, 5);
    const wall = createHex(5, 4);
    const player = { ...state.player, position: createHex(0, 0) };
    const enemies = state.enemies.map((e, idx) => idx === 0 ? { ...e, position: origin } : e);
    const tiles = new Map(state.tiles);
    tiles.set(pointToKey(origin), {
        baseId: 'STONE',
        position: origin,
        traits: new Set(BASE_TILES.STONE.defaultTraits),
        effects: []
    });
    tiles.set(pointToKey(wall), {
        baseId: 'WALL',
        position: wall,
        traits: new Set(BASE_TILES.WALL.defaultTraits),
        effects: []
    });
    return {
        ...state,
        player,
        enemies,
        tiles
    };
};

describe('kinetic collision policy', () => {
    it('defaults to stop + stun on blocked kinetic pulses', () => {
        const state = setupBlockedPulseState();
        const effects = processKineticPulse(state, {
            origin: state.enemies[0]!.position,
            direction: { q: 1, r: -1, s: 0 },
            momentum: 2
        });

        expect(effects.some(e => e.type === 'ApplyStatus' && e.status === 'stunned')).toBe(true);
    });

    it('supports crush_damage conversion on blocked kinetic pulses', () => {
        const state = setupBlockedPulseState();
        const effects = processKineticPulse(state, {
            origin: state.enemies[0]!.position,
            direction: { q: 1, r: -1, s: 0 },
            momentum: 2,
            collision: {
                onBlocked: 'crush_damage',
                crushDamage: 3,
                damageReason: 'crush'
            }
        });

        expect(effects.some(e => e.type === 'Damage' && e.reason === 'crush')).toBe(true);
    });
});

