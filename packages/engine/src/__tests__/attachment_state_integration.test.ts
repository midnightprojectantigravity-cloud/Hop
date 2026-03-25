import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { getComponent, type AttachmentComponent } from '../systems/components';
import { applyEffects } from '../systems/effect-engine';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import type { GameState, Point } from '../types';

const placeStone = (state: GameState, pos: Point): void => {
    state.tiles.set(pointToKey(pos), {
        baseId: 'STONE',
        position: pos,
        traits: new Set(BASE_TILES.STONE.defaultTraits),
        effects: []
    });
};

const placeWall = (state: GameState, pos: Point): void => {
    state.tiles.set(pointToKey(pos), {
        baseId: 'WALL',
        position: pos,
        traits: new Set(BASE_TILES.WALL.defaultTraits),
        effects: []
    });
};

const setupAttachmentState = () => {
    const state = generateInitialState(1, 'attachment-state-seed');
    const anchorPos = createHex(4, 4);
    const attachedPos = createHex(5, 4);
    const anchorId = 'anchor-enemy';
    const attachedId = 'attached-enemy';

    const anchor = createEnemy({
        id: anchorId,
        subtype: 'footman',
        position: anchorPos,
        hp: 5,
        maxHp: 5,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK']
    });
    const attached = createEnemy({
        id: attachedId,
        subtype: 'footman',
        position: attachedPos,
        hp: 5,
        maxHp: 5,
        speed: 1,
        skills: ['BASIC_MOVE', 'BASIC_ATTACK']
    });

    const tiles = new Map(state.tiles);
    const seeded: GameState = {
        ...state,
        player: { ...state.player, position: createHex(2, 2) },
        enemies: [anchor, attached],
        companions: [],
        tiles
    };

    placeStone(seeded, anchorPos);
    placeStone(seeded, attachedPos);
    placeStone(seeded, createHex(4, 5));
    placeStone(seeded, createHex(5, 5));
    return { state: seeded, anchorId, attachedId };
};

const getAttachmentLinks = (state: GameState, actorId: string) => {
    const actor = actorId === state.player.id
        ? state.player
        : state.enemies.find(e => e.id === actorId) || state.companions?.find(e => e.id === actorId);
    const attachment = getComponent<AttachmentComponent>(actor?.components, 'attachment');
    return attachment?.links || [];
};

describe('attachment state integration', () => {
    it('moves attached counterpart with shared vector when anchor displaces', () => {
        const { state, anchorId, attachedId } = setupAttachmentState();
        const attached = applyEffects(state, [{
            type: 'AttachActors',
            anchor: anchorId,
            attached: attachedId,
            mode: 'tow'
        }], { sourceId: anchorId, targetId: attachedId });

        const moved = applyEffects(attached, [{
            type: 'Displacement',
            target: anchorId,
            source: createHex(4, 4),
            destination: createHex(4, 5),
            simulatePath: true
        }], { sourceId: anchorId, targetId: anchorId });

        const movedAnchor = moved.enemies.find(e => e.id === anchorId)!;
        const movedAttached = moved.enemies.find(e => e.id === attachedId)!;

        expect(movedAnchor.position).toEqual(createHex(4, 5));
        expect(movedAttached.position).toEqual(createHex(5, 5));
        expect(getAttachmentLinks(moved, anchorId).length).toBe(1);
        expect(getAttachmentLinks(moved, attachedId).length).toBe(1);
    });

    it('supports manual release and prevents subsequent shared movement', () => {
        const { state, anchorId, attachedId } = setupAttachmentState();
        const attached = applyEffects(state, [{
            type: 'AttachActors',
            anchor: anchorId,
            attached: attachedId,
            mode: 'tow'
        }], { sourceId: anchorId, targetId: attachedId });

        const released = applyEffects(attached, [{
            type: 'ReleaseAttachment',
            actor: anchorId,
            counterpartId: attachedId,
            reason: 'manual_release'
        }], { sourceId: anchorId, targetId: attachedId });

        const moved = applyEffects(released, [{
            type: 'Displacement',
            target: anchorId,
            source: createHex(4, 4),
            destination: createHex(4, 5),
            simulatePath: true
        }], { sourceId: anchorId, targetId: anchorId });

        const movedAttached = moved.enemies.find(e => e.id === attachedId)!;
        expect(movedAttached.position).toEqual(createHex(5, 4));
        expect(getAttachmentLinks(moved, anchorId).length).toBe(0);
        expect(getAttachmentLinks(moved, attachedId).length).toBe(0);
    });

    it('releases attachment when counterpart cannot follow due to obstacle break', () => {
        const { state, anchorId, attachedId } = setupAttachmentState();
        placeWall(state, createHex(5, 5));

        const attached = applyEffects(state, [{
            type: 'AttachActors',
            anchor: anchorId,
            attached: attachedId,
            mode: 'tow'
        }], { sourceId: anchorId, targetId: attachedId });

        const moved = applyEffects(attached, [{
            type: 'Displacement',
            target: anchorId,
            source: createHex(4, 4),
            destination: createHex(4, 5),
            simulatePath: true
        }], { sourceId: anchorId, targetId: anchorId });

        const movedAttached = moved.enemies.find(e => e.id === attachedId)!;
        expect(movedAttached.position).toEqual(createHex(5, 4));
        expect(getAttachmentLinks(moved, anchorId).length).toBe(0);
        expect(getAttachmentLinks(moved, attachedId).length).toBe(0);
    });

    it('releases attachment on damage break', () => {
        const { state, anchorId, attachedId } = setupAttachmentState();
        const attached = applyEffects(state, [{
            type: 'AttachActors',
            anchor: anchorId,
            attached: attachedId,
            mode: 'tow',
            breakOnDamage: true
        }], { sourceId: anchorId, targetId: attachedId });

        const damaged = applyEffects(attached, [{
            type: 'Damage',
            target: attachedId,
            amount: 1,
            reason: 'test_damage'
        }], { sourceId: anchorId, targetId: attachedId });

        expect(getAttachmentLinks(damaged, anchorId).length).toBe(0);
        expect(getAttachmentLinks(damaged, attachedId).length).toBe(0);
    });

    it('releases attachment on configured status break', () => {
        const { state, anchorId, attachedId } = setupAttachmentState();
        const attached = applyEffects(state, [{
            type: 'AttachActors',
            anchor: anchorId,
            attached: attachedId,
            mode: 'tow',
            breakOnStatuses: ['stunned']
        }], { sourceId: anchorId, targetId: attachedId });

        const statusApplied = applyEffects(attached, [{
            type: 'ApplyStatus',
            target: attachedId,
            status: 'stunned',
            duration: 1
        }], { sourceId: anchorId, targetId: attachedId });

        expect(getAttachmentLinks(statusApplied, anchorId).length).toBe(0);
        expect(getAttachmentLinks(statusApplied, attachedId).length).toBe(0);
    });
});
