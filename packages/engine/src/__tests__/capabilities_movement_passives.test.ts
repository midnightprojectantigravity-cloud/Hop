import { describe, expect, it } from 'vitest';
import { createHex, hexEquals, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { createActiveSkill } from '../skillRegistry';
import { BASIC_MOVE } from '../skills/basic_move';
import { applyEffects } from '../systems/effect-engine';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import { canLandOnHazard } from '../systems/validation';
import { getEnemyCatalogEntry } from '../data/enemies';

const placeTile = (state: ReturnType<typeof generateInitialState>, pos: { q: number; r: number; s: number }, baseId: 'WALL' | 'LAVA') => {
    const base = BASE_TILES[baseId];
    state.tiles.set(pointToKey(pos), {
        baseId,
        position: pos,
        traits: new Set(base.defaultTraits),
        effects: []
    });
};

describe('movement capability passives', () => {
    it('FLIGHT enables hazard-safe landing on lava through movement capability resolution', () => {
        const state = generateInitialState(1, 'movement-passive-flight');
        const lavaHex = createHex(2, 5);
        placeTile(state, lavaHex, 'LAVA');

        state.player = {
            ...state.player,
            activeSkills: [createActiveSkill('FLIGHT') as any],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 0, instinct: 30 }]
            ])
        };

        const canLand = canLandOnHazard(state, state.player, lavaHex, { skillId: 'BASIC_MOVE' });
        expect(canLand).toBe(true);
    });

    it('PHASE_STEP allows BASIC_MOVE execution through walls', () => {
        const state = generateInitialState(1, 'movement-passive-phase');
        const origin = createHex(2, 6);
        const target = createHex(2, 5);
        placeTile(state, target, 'WALL');

        state.player = {
            ...state.player,
            position: origin,
            speed: 1,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('PHASE_STEP') as any
            ],
            components: new Map([
                ['trinity', { type: 'trinity', body: 0, mind: 24, instinct: 0 }]
            ])
        };

        const execution = BASIC_MOVE.execute(state, state.player, target);
        expect(execution.consumesTurn).toBe(true);

        const afterMove = applyEffects(state, execution.effects, { sourceId: state.player.id });
        expect(hexEquals(afterMove.player.position, target)).toBe(true);
    });

    it('BURROW allows BASIC_MOVE to path through occupied tiles', () => {
        const state = generateInitialState(1, 'movement-passive-burrow');
        const origin = createHex(2, 6);
        const blockerPos = createHex(2, 5);
        const target = createHex(2, 4);

        state.player = {
            ...state.player,
            position: origin,
            speed: 2,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('BURROW') as any
            ],
            components: new Map([
                ['trinity', { type: 'trinity', body: 20, mind: 0, instinct: 0 }]
            ])
        };
        state.enemies = [
            createEnemy({
                id: 'burrow-blocker',
                subtype: 'footman',
                position: blockerPos,
                hp: 2,
                maxHp: 2,
                speed: 1,
                skills: ['BASIC_MOVE'],
                weightClass: 'Standard'
            })
        ];

        const execution = BASIC_MOVE.execute(state, state.player, target);
        expect(execution.consumesTurn).toBe(true);

        const afterMove = applyEffects(state, execution.effects, { sourceId: state.player.id });
        expect(hexEquals(afterMove.player.position, target)).toBe(true);
    });

    it('enemy catalog wires movement passives into runtime loadouts', () => {
        expect(getEnemyCatalogEntry('pouncer')?.runtimeSkills.passive).toContain('BURROW');
        expect(getEnemyCatalogEntry('warlock')?.runtimeSkills.passive).toContain('PHASE_STEP');
        expect(getEnemyCatalogEntry('sentinel')?.runtimeSkills.passive).toContain('FLIGHT');
    });
});
