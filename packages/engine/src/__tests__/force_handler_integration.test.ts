import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { applyEffects } from '../systems/effect-engine';
import { BASE_TILES } from '../systems/tiles/tile-registry';

const setupLineState = () => {
    const state = generateInitialState(1, 'force-handler-seed');
    const playerPos = createHex(3, 5);
    const enemyPos = createHex(4, 5);
    const player = { ...state.player, position: playerPos };
    const enemies = state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e);
    const tiles = new Map(state.tiles);
    for (const pos of [createHex(3, 5), createHex(4, 5), createHex(5, 5), createHex(6, 5)]) {
        tiles.set(pointToKey(pos), {
            baseId: 'STONE',
            position: pos,
            traits: new Set(BASE_TILES.STONE.defaultTraits),
            effects: []
        });
    }
    return { ...state, player, enemies, tiles };
};

describe('force handler integration', () => {
    it('resolves ApplyForce into displacement via effect engine', () => {
        const state = setupLineState();
        const targetId = state.enemies[0]!.id;

        const next = applyEffects(
            state,
            [{
                type: 'ApplyForce',
                target: targetId,
                source: state.player.position,
                mode: 'push',
                magnitude: 2,
                maxDistance: 2,
                collision: { onBlocked: 'stop' }
            }],
            { sourceId: state.player.id, targetId }
        );

        const movedEnemy = next.enemies.find(e => e.id === targetId);
        expect(movedEnemy).toBeDefined();
        expect(movedEnemy?.position.q).not.toBe(state.enemies[0]!.position.q);
    });

    it('applies crush damage when ApplyForce collides and policy is crush_damage', () => {
        const state = setupLineState();
        const targetId = state.enemies[0]!.id;
        const wallPos = createHex(6, 5);
        const withWall = { ...state, tiles: new Map(state.tiles) };
        withWall.tiles.set(pointToKey(wallPos), {
            baseId: 'WALL',
            position: wallPos,
            traits: new Set(BASE_TILES.WALL.defaultTraits),
            effects: []
        } as any);

        const hpBefore = withWall.enemies.find(e => e.id === targetId)!.hp;
        const next = applyEffects(
            withWall,
            [{
                type: 'ApplyForce',
                target: targetId,
                source: withWall.player.position,
                mode: 'push',
                magnitude: 3,
                maxDistance: 3,
                collision: { onBlocked: 'crush_damage', crushDamage: 2 },
                damageReason: 'crush'
            }],
            { sourceId: withWall.player.id, targetId }
        );

        const hpAfter = next.enemies.find(e => e.id === targetId)!.hp;
        expect(hpAfter).toBeLessThan(hpBefore);
    });
});

