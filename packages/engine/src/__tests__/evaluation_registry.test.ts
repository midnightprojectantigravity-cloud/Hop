import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { createDefaultEvaluationRegistry, type GradeEnvelope } from '../systems/evaluation';
import type { SkillIntentProfile, Actor } from '../types';
import type { Tile } from '../systems/tile-types';

const validateEnvelope = (env: GradeEnvelope) => {
    expect(typeof env.power).toBe('number');
    expect(typeof env.survivability).toBe('number');
    expect(typeof env.control).toBe('number');
    expect(typeof env.mobility).toBe('number');
    expect(typeof env.economy).toBe('number');
    expect(typeof env.risk).toBe('number');
    expect(typeof env.complexity).toBe('number');
    expect(typeof env.objectivePressure).toBe('number');
};

describe('Evaluation Registry', () => {
    it('supports all evaluation kinds with shared envelope', () => {
        const registry = createDefaultEvaluationRegistry();
        const skillProfile: SkillIntentProfile = {
            id: 'BASIC_ATTACK',
            intentTags: ['damage'],
            target: { range: 1, pattern: 'single' },
            estimates: { damage: 4 },
            economy: { cost: 0, cooldown: 0, consumesTurn: true },
            risk: { selfExposure: 0.2, hazardAffinity: 0 },
            complexity: 1
        };
        const tile: Tile = {
            baseId: 'STONE',
            position: createHex(0, 0),
            traits: new Set(['WALKABLE']),
            effects: []
        };
        const actor: Actor = {
            id: 'a1',
            type: 'enemy',
            subtype: 'grunt',
            position: createHex(1, 1),
            hp: 4,
            maxHp: 4,
            speed: 50,
            factionId: 'enemy',
            statusEffects: [],
            temporaryArmor: 0,
            activeSkills: []
        };
        const mapInput = { id: 'm1', tiles: new Map([['0,0', tile]]), stairsPosition: createHex(0, 0) };
        const encounter = { id: 'e1', map: mapInput, enemies: [actor] };

        const kinds = [
            registry.evaluate('skill', skillProfile),
            registry.evaluate('tile', tile),
            registry.evaluate('entity', actor),
            registry.evaluate('map', mapInput),
            registry.evaluate('encounter', encounter)
        ];
        for (const grade of kinds) {
            validateEnvelope(grade.envelope);
            expect(typeof grade.numericGrade).toBe('number');
            expect(typeof grade.efficiencyGrade).toBe('number');
            expect(typeof grade.difficultyGrade).toBe('number');
        }
    });

    it('is deterministic for same input payloads', () => {
        const registry = createDefaultEvaluationRegistry();
        const tile: Tile = {
            baseId: 'LAVA',
            position: createHex(1, 0),
            traits: new Set(['HAZARDOUS', 'LIQUID']),
            effects: []
        };
        const first = registry.evaluate('tile', tile);
        const second = registry.evaluate('tile', tile);
        expect(first).toEqual(second);
    });
});
