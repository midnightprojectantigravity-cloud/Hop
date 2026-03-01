import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { createActiveSkill } from '../skillRegistry';
import { evaluateEntity, evaluateTile } from '../systems/evaluation/evaluation';
import type { Actor } from '../types';
import type { Tile } from '../systems/tiles/tile-types';

describe('Evaluation monotonic sanity', () => {
    it('hazardous lava tile is harder than plain stone tile', () => {
        const stone: Tile = {
            baseId: 'STONE',
            position: createHex(0, 0),
            traits: new Set(['WALKABLE']),
            effects: []
        };
        const lava: Tile = {
            baseId: 'LAVA',
            position: createHex(0, 1),
            traits: new Set(['HAZARDOUS', 'LIQUID', 'LAVA']),
            effects: []
        };
        const stoneGrade = evaluateTile(stone);
        const lavaGrade = evaluateTile(lava);
        expect(lavaGrade.difficultyGrade).toBeGreaterThan(stoneGrade.difficultyGrade);
        expect(lavaGrade.envelope.risk).toBeGreaterThan(stoneGrade.envelope.risk);
    });

    it('entity with stronger stats/loadout has higher grade envelope dimensions', () => {
        const weak: Actor = {
            id: 'weak',
            type: 'enemy',
            subtype: 'footman',
            position: createHex(1, 1),
            hp: 1,
            maxHp: 1,
            speed: 1,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: [createActiveSkill('BASIC_ATTACK')]
        };
        const strong: Actor = {
            ...weak,
            id: 'strong',
            hp: 3,
            maxHp: 3,
            speed: 2,
            activeSkills: [
                createActiveSkill('BASIC_ATTACK'),
                createActiveSkill('FIREBALL')
            ]
        };
        const weakGrade = evaluateEntity(weak);
        const strongGrade = evaluateEntity(strong);
        expect(strongGrade.envelope.survivability).toBeGreaterThan(weakGrade.envelope.survivability);
        expect(strongGrade.envelope.power).toBeGreaterThanOrEqual(weakGrade.envelope.power);
        expect(strongGrade.numericGrade).toBeGreaterThan(weakGrade.numericGrade);
    });
});
