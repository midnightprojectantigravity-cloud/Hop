import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { resolveForce } from '../systems/combat/force';
import { BASE_TILES } from '../systems/tiles/tile-registry';

describe('force contest', () => {
    it('reduces knockback when attacker body is much lower than defender body', () => {
        const state = generateInitialState(1, 'force-contest-v2');
        const playerPos = createHex(3, 5);
        const enemyPos = createHex(4, 5);
        state.player = { ...state.player, position: playerPos };
        state.enemies = state.enemies.map((enemy, index) => index === 0 ? { ...enemy, position: enemyPos } : enemy);
        for (const pos of [playerPos, enemyPos, createHex(5, 5), createHex(6, 5)]) {
            state.tiles.set(pointToKey(pos), {
                baseId: 'STONE',
                position: pos,
                traits: new Set(BASE_TILES.STONE.defaultTraits),
                effects: []
            });
        }

        const result = resolveForce(state, {
            source: playerPos,
            targetActorId: state.enemies[0]!.id,
            mode: 'push',
            magnitude: 3,
            maxDistance: 3,
            collision: { onBlocked: 'stop' },
            attackerBody: 2,
            defenderBody: 20
        });

        expect(result.resolvedKnockbackDistance).toBe(0);
    });
});
