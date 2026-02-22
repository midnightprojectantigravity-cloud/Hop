import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { resolveForce } from '../systems/force';
import { BASE_TILES } from '../systems/tile-registry';

const setupLineState = () => {
    const state = generateInitialState(1, 'force-seed');
    const playerPos = createHex(4, 5);
    const enemyPos = createHex(5, 5);
    const player = { ...state.player, position: playerPos };
    const enemies = state.enemies.map((e, idx) => idx === 0 ? { ...e, position: enemyPos } : e);
    return { ...state, player, enemies };
};

describe('force resolution', () => {
    it('pushes target when path is clear', () => {
        const state = setupLineState();
        const targetId = state.enemies[0]!.id;
        const result = resolveForce(state, {
            source: state.player.position,
            targetActorId: targetId,
            mode: 'push',
            magnitude: 2,
            maxDistance: 2,
            collision: { onBlocked: 'stop' }
        });

        const displacement = result.effects.find(e => e.type === 'Displacement');
        expect(displacement).toBeTruthy();
        expect(result.collided).toBe(false);
    });

    it('converts blocked push into crush damage', () => {
        const state = setupLineState();
        const targetId = state.enemies[0]!.id;
        const wallPos = createHex(6, 5);
        const wallKey = pointToKey(wallPos);
        const wallTile = {
            baseId: 'WALL' as const,
            position: wallPos,
            traits: new Set(BASE_TILES.WALL.defaultTraits),
            effects: []
        };
        const withWall = { ...state, tiles: new Map(state.tiles) };
        withWall.tiles.set(wallKey, wallTile);

        const result = resolveForce(withWall, {
            source: withWall.player.position,
            targetActorId: targetId,
            mode: 'push',
            magnitude: 3,
            maxDistance: 3,
            collision: { onBlocked: 'crush_damage', crushDamage: 2 }
        });

        expect(result.collided).toBe(true);
        expect(result.effects.some(e => e.type === 'Damage')).toBe(true);
    });

    it('pulls target toward source until occupancy blocks', () => {
        const state = setupLineState();
        const targetId = state.enemies[0]!.id;
        const movedEnemyState = {
            ...state,
            enemies: state.enemies.map((e, idx) => idx === 0 ? { ...e, position: createHex(7, 5) } : e)
        };

        const result = resolveForce(movedEnemyState, {
            source: movedEnemyState.player.position,
            targetActorId: targetId,
            mode: 'pull',
            magnitude: 4,
            maxDistance: 4,
            collision: { onBlocked: 'stop' }
        });

        const displacement = result.effects.find(e => e.type === 'Displacement');
        expect(displacement).toBeTruthy();
        expect(result.collided).toBe(true);
    });
});

