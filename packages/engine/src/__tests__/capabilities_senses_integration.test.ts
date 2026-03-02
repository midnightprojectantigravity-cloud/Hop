import { describe, expect, it } from 'vitest';
import { createHex, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { createActiveSkill } from '../skillRegistry';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { validateLineOfSight } from '../systems/validation';

const placeTile = (state: any, pos: { q: number; r: number; s: number }, baseId: 'STONE' | 'WALL'): void => {
    const base = BASE_TILES[baseId];
    state.tiles.set(pointToKey(pos), {
        baseId,
        position: pos,
        traits: new Set(base.defaultTraits),
        effects: []
    });
};

describe('capabilities senses integration', () => {
    it('keeps legacy LoS behavior when observer has no sense capability providers', () => {
        const state = generateInitialState(1, 'sense-legacy-seed');
        const origin = createHex(2, 6);
        const target = createHex(2, 3);

        state.player = {
            ...state.player,
            position: origin,
            activeSkills: [createActiveSkill('BASIC_MOVE') as any]
        };
        state.enemies = [
            createEnemy({
                id: 'sense-target-legacy',
                subtype: 'footman',
                position: target,
                hp: 3,
                maxHp: 3,
                speed: 1,
                skills: ['BASIC_MOVE'],
                weightClass: 'Standard'
            })
        ];
        placeTile(state, createHex(2, 5), 'WALL');

        const legacy = validateLineOfSight(state, origin, target, { excludeActorId: state.player.id });
        const observerAware = validateLineOfSight(state, origin, target, {
            excludeActorId: state.player.id,
            observerActor: state.player
        });

        expect(observerAware).toEqual(legacy);
    });

    it('applies STANDARD_VISION range scaling with cap', () => {
        const state = generateInitialState(1, 'sense-standard-vision-seed');
        const origin = createHex(1, 8);
        const farTarget = createHex(1, 4); // distance 4

        state.player = {
            ...state.player,
            position: origin,
            activeSkills: [createActiveSkill('STANDARD_VISION') as any],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 0 }]
            ])
        };
        state.enemies = [
            createEnemy({
                id: 'sense-target-range',
                subtype: 'footman',
                position: farTarget,
                hp: 3,
                maxHp: 3,
                speed: 1,
                skills: ['BASIC_MOVE'],
                weightClass: 'Standard'
            })
        ];

        const lowMind = validateLineOfSight(state, origin, farTarget, {
            observerActor: state.player,
            excludeActorId: state.player.id
        });
        expect(lowMind.isValid).toBe(false);

        state.player = {
            ...state.player,
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 30, instinct: 0 }]
            ])
        };
        const highMind = validateLineOfSight(state, origin, farTarget, {
            observerActor: state.player,
            excludeActorId: state.player.id
        });
        expect(highMind.isValid).toBe(true);
    });

    it('allows VIBRATION_SENSE through walls only when target moved last turn', () => {
        const state = generateInitialState(1, 'sense-vibration-seed');
        const origin = createHex(3, 8);
        const target = createHex(3, 4);
        const wall = createHex(3, 6);

        state.player = {
            ...state.player,
            position: origin,
            activeSkills: [createActiveSkill('VIBRATION_SENSE') as any],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 40 }]
            ])
        };
        const movingTarget = createEnemy({
            id: 'sense-target-moving',
            subtype: 'footman',
            position: target,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE'],
            weightClass: 'Standard'
        });
        movingTarget.previousPosition = createHex(3, 5);
        state.enemies = [movingTarget];
        placeTile(state, wall, 'WALL');

        const moved = validateLineOfSight(state, origin, target, {
            observerActor: state.player,
            excludeActorId: state.player.id
        });
        expect(moved.isValid).toBe(true);

        movingTarget.previousPosition = { ...movingTarget.position };
        const notMoved = validateLineOfSight(state, origin, target, {
            observerActor: state.player,
            excludeActorId: state.player.id
        });
        expect(notMoved.isValid).toBe(false);
    });

    it('supports hard-block interdiction context for future blindness/smoke rules', () => {
        const state = generateInitialState(1, 'sense-hard-block-context');
        const origin = createHex(3, 8);
        const target = createHex(3, 4);
        const wall = createHex(3, 6);

        state.player = {
            ...state.player,
            position: origin,
            activeSkills: [createActiveSkill('STANDARD_VISION') as any, createActiveSkill('VIBRATION_SENSE') as any],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 30, instinct: 40 }]
            ])
        };
        const movingTarget = createEnemy({
            id: 'sense-target-hard-block',
            subtype: 'footman',
            position: target,
            hp: 3,
            maxHp: 3,
            speed: 1,
            skills: ['BASIC_MOVE'],
            weightClass: 'Standard'
        });
        movingTarget.previousPosition = createHex(3, 5);
        state.enemies = [movingTarget];
        placeTile(state, wall, 'WALL');

        const visibleWithoutInterdict = validateLineOfSight(state, origin, target, {
            observerActor: state.player,
            excludeActorId: state.player.id
        });
        expect(visibleWithoutInterdict.isValid).toBe(true);

        const blockedWithInterdict = validateLineOfSight(state, origin, target, {
            observerActor: state.player,
            excludeActorId: state.player.id,
            context: { statusBlind: true }
        });
        expect(blockedWithInterdict.isValid).toBe(false);
    });

    it('applies smoke-based hard interdiction context from observer tile effects', () => {
        const state = generateInitialState(1, 'sense-smoke-interdict');
        const origin = createHex(3, 8);
        const target = createHex(3, 4);

        state.player = {
            ...state.player,
            position: origin,
            activeSkills: [createActiveSkill('STANDARD_VISION') as any],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 30, instinct: 0 }]
            ])
        };
        state.enemies = [
            createEnemy({
                id: 'sense-target-smoke-interdict',
                subtype: 'footman',
                position: target,
                hp: 3,
                maxHp: 3,
                speed: 1,
                skills: ['BASIC_MOVE'],
                weightClass: 'Standard'
            })
        ];

        const observerTileKey = pointToKey(origin);
        const observerTile = state.tiles.get(observerTileKey) || {
            baseId: 'STONE',
            position: origin,
            traits: new Set(BASE_TILES.STONE.defaultTraits),
            effects: []
        };
        state.tiles.set(observerTileKey, {
            ...observerTile,
            effects: [...observerTile.effects, { id: 'SMOKE', duration: 2, potency: 1 }]
        });

        const blockedBySmoke = validateLineOfSight(state, origin, target, {
            observerActor: state.player,
            excludeActorId: state.player.id
        });
        expect(blockedBySmoke.isValid).toBe(false);

        const overrideVisible = validateLineOfSight(state, origin, target, {
            observerActor: state.player,
            excludeActorId: state.player.id,
            context: { smokeBlind: false }
        });
        expect(overrideVisible.isValid).toBe(true);
    });
});
