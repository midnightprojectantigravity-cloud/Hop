import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { GRAPPLE_HOOK } from '../skills/grapple_hook';
import type { GameState, Point } from '../types';

const placeTile = (state: GameState, pos: Point, baseId: 'STONE' | 'WALL'): void => {
    const base = BASE_TILES[baseId];
    state.tiles.set(pointToKey(pos), {
        baseId,
        position: pos,
        traits: new Set(base.defaultTraits),
        effects: []
    });
};

const setupComboState = (): GameState => {
    const state = generateInitialState(1, 'grapple-attachment-emit-seed');
    const playerPos = createHex(3, 6);
    const targetPos = createHex(5, 6);

    const enemy = createEnemy({
        id: 'hook-target',
        subtype: 'footman',
        position: targetPos,
        hp: 4,
        maxHp: 4,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        weightClass: 'Standard'
    });

    state.player = { ...state.player, position: playerPos };
    state.enemies = [enemy];
    state.companions = [];
    state.tiles = new Map();
    placeTile(state, playerPos, 'STONE');
    placeTile(state, createHex(4, 6), 'STONE');
    placeTile(state, targetPos, 'STONE');
    placeTile(state, createHex(6, 6), 'STONE');
    placeTile(state, createHex(7, 6), 'STONE');
    return state;
};

describe('grapple hook attachment emission', () => {
    it('emits attach and release effects for combo flow in deterministic order', () => {
        const state = setupComboState();
        const target = createHex(5, 6);
        const result = GRAPPLE_HOOK.execute(state, state.player, target, []);

        const attachIndex = result.effects.findIndex(e => e.type === 'AttachActors');
        const releaseIndex = result.effects.findIndex(e => e.type === 'ReleaseAttachment');

        expect(attachIndex).toBeGreaterThan(-1);
        expect(releaseIndex).toBeGreaterThan(-1);
        expect(attachIndex).toBeLessThan(releaseIndex);

        const attach = result.effects[attachIndex] as Extract<typeof result.effects[number], { type: 'AttachActors' }>;
        const release = result.effects[releaseIndex] as Extract<typeof result.effects[number], { type: 'ReleaseAttachment' }>;

        expect(attach.anchor).toBe(state.player.id);
        expect(attach.attached).toBe('hook-target');
        expect(release.actor).toBe(state.player.id);
        expect(release.counterpartId).toBe('hook-target');
    });

    it('does not emit attachment effects on blocked line of sight', () => {
        const state = setupComboState();
        placeTile(state, createHex(4, 6), 'WALL');
        const result = GRAPPLE_HOOK.execute(state, state.player, createHex(5, 6), []);

        expect(result.effects.some(e => e.type === 'AttachActors')).toBe(false);
        expect(result.effects.some(e => e.type === 'ReleaseAttachment')).toBe(false);
    });
});
