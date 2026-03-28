import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { BULWARK_CHARGE } from '../skills/bulwark_charge';
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

const setupState = (): GameState => {
    const state = generateInitialState(1, 'bulwark-attachment-seed');
    const playerPos = createHex(4, 6);
    const targetPos = createHex(4, 5);
    const chainPos = createHex(4, 4);
    const enemyA = createEnemy({
        id: 'bulwark-target-a',
        subtype: 'footman',
        position: targetPos,
        hp: 3,
        maxHp: 3,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        weightClass: 'Standard'
    });
    const enemyB = createEnemy({
        id: 'bulwark-target-b',
        subtype: 'footman',
        position: chainPos,
        hp: 3,
        maxHp: 3,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
        weightClass: 'Standard'
    });

    state.player = { ...state.player, position: playerPos };
    state.enemies = [enemyA, enemyB];
    state.companions = [];
    state.tiles = new Map();
    placeTile(state, playerPos, 'STONE');
    placeTile(state, targetPos, 'STONE');
    placeTile(state, chainPos, 'STONE');
    placeTile(state, createHex(4, 3), 'STONE');
    placeTile(state, createHex(4, 2), 'STONE');
    return state;
};

describe('bulwark charge attachment emission', () => {
    it('emits attach and release around successful charge path', () => {
        const state = setupState();
        const result = BULWARK_CHARGE.execute(state, state.player, createHex(4, 5));

        const attachIndex = result.effects.findIndex(e => e.type === 'AttachActors');
        const releaseIndex = result.effects.findIndex(e => e.type === 'ReleaseAttachment');
        expect(attachIndex).toBeGreaterThan(-1);
        expect(releaseIndex).toBeGreaterThan(-1);
        expect(attachIndex).toBeLessThan(releaseIndex);

        const attach = result.effects[attachIndex] as Extract<typeof result.effects[number], { type: 'AttachActors' }>;
        const release = result.effects[releaseIndex] as Extract<typeof result.effects[number], { type: 'ReleaseAttachment' }>;
        expect(attach.anchor).toBe(state.player.id);
        expect(attach.attached).toBe('bulwark-target-a');
        expect(attach.sharedVectorScale).toBe(1);
        expect(release.actor).toBe(state.player.id);
        expect(release.counterpartId).toBe('bulwark-target-a');
    });

    it('does not emit attachment effects when chain is blocked', () => {
        const state = setupState();
        placeTile(state, createHex(4, 3), 'WALL');
        const result = BULWARK_CHARGE.execute(state, state.player, createHex(4, 5));
        expect(result.effects.some(e => e.type === 'AttachActors')).toBe(false);
        expect(result.effects.some(e => e.type === 'ReleaseAttachment')).toBe(false);
    });
});
