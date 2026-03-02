import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { createHex, hexEquals, pointToKey } from '../hex';
import { generateInitialState } from '../logic';
import { createActiveSkill, SkillRegistry } from '../skillRegistry';
import { applyEffects } from '../systems/effect-engine';
import { createEnemy } from '../systems/entities/entity-factory';
import { BASE_TILES } from '../systems/tiles/tile-registry';
import {
    clearCapabilityStateCacheForTests,
    registerCapabilitySkillDefinitionResolver
} from '../systems/capabilities/cache';
import { BASIC_MOVE } from '../skills/basic_move';

const TEST_MOTION_CORE = 'TEST_MOTION_CORE';
const TEST_MOTION_ADAPT = 'TEST_MOTION_ADAPT';

const createPassiveSkillDef = (
    id: string,
    capabilities: SkillDefinition['capabilities']
): SkillDefinition => ({
    id: id as any,
    name: id,
    description: id,
    slot: 'passive',
    icon: 'T',
    baseVariables: {
        range: 0,
        cost: 0,
        cooldown: 0
    },
    execute: (_state: GameState, _attacker: Actor, _target?: Point): { effects: AtomicEffect[]; messages: string[] } => ({
        effects: [],
        messages: []
    }),
    getValidTargets: () => [],
    capabilities,
    upgrades: {}
});

const TEST_SKILL_DEFS: Record<string, SkillDefinition> = {
    [TEST_MOTION_CORE]: createPassiveSkillDef(TEST_MOTION_CORE, {
        movement: [{
            domain: 'movement',
            providerId: 'test.motion.core',
            priority: 50,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'walk',
                    ignoreGroundHazards: false,
                    ignoreWalls: false,
                    allowPassThroughActors: false,
                    rangeModifier: 0
                }
            })
        }]
    }),
    [TEST_MOTION_ADAPT]: createPassiveSkillDef(TEST_MOTION_ADAPT, {
        movement: [{
            domain: 'movement',
            providerId: 'test.motion.adapt',
            priority: 10,
            resolutionMode: 'EXTEND',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'EXTEND',
                model: {
                    ignoreGroundHazards: true,
                    ignoreWalls: true,
                    allowPassThroughActors: true,
                    rangeModifier: 2
                }
            })
        }]
    })
};

const defaultCapabilityResolver = (skillId: string): SkillDefinition | undefined => SkillRegistry.get(skillId);
const testCapabilityResolver = (skillId: string): SkillDefinition | undefined =>
    TEST_SKILL_DEFS[skillId] || SkillRegistry.get(skillId);

const createTestPassiveSkill = (id: string) => ({
    id: id as any,
    name: id,
    description: id,
    slot: 'passive',
    cooldown: 0,
    currentCooldown: 0,
    range: 0,
    upgrades: [],
    activeUpgrades: []
});

const placeTile = (state: GameState, pos: Point, baseId: 'WALL' | 'LAVA'): void => {
    const base = BASE_TILES[baseId];
    state.tiles.set(pointToKey(pos), {
        baseId,
        position: pos,
        traits: new Set(base.defaultTraits),
        effects: []
    });
};

const makeState = (seed: string) => {
    const state = generateInitialState(1, seed);
    state.player = {
        ...state.player,
        position: createHex(2, 6),
        speed: 1,
        activeSkills: [createActiveSkill('BASIC_MOVE') as any]
    };
    return state;
};

describe.sequential('capabilities movement integration', () => {
    beforeEach(() => {
        registerCapabilitySkillDefinitionResolver(testCapabilityResolver);
        clearCapabilityStateCacheForTests();
    });

    afterEach(() => {
        registerCapabilitySkillDefinitionResolver(defaultCapabilityResolver);
        clearCapabilityStateCacheForTests();
    });

    it('extends BASIC_MOVE range and allows pass-through actor traversal', () => {
        const state = makeState('cap-move-pass-through');
        const target = createHex(2, 4);
        const blocker = createEnemy({
            id: 'cap-blocker',
            subtype: 'footman',
            position: createHex(2, 5),
            hp: 4,
            maxHp: 4,
            speed: 1,
            skills: ['BASIC_MOVE'],
            weightClass: 'Standard'
        });
        state.enemies = [blocker];
        state.player = {
            ...state.player,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createTestPassiveSkill(TEST_MOTION_CORE) as any,
                createTestPassiveSkill(TEST_MOTION_ADAPT) as any
            ]
        };

        const execution = BASIC_MOVE.execute(state, state.player, target);
        expect(execution.consumesTurn).toBe(true);
        expect(execution.effects.some(e => e.type === 'Displacement')).toBe(true);

        const moved = applyEffects(state, execution.effects, { sourceId: state.player.id });
        expect(hexEquals(moved.player.position, target)).toBe(true);
    });

    it('allows wall and hazard traversal during displacement simulation', () => {
        const wallTarget = createHex(2, 5);
        const lavaTarget = createHex(2, 4);

        const state = makeState('cap-move-wall-hazard');
        placeTile(state, wallTarget, 'WALL');
        placeTile(state, lavaTarget, 'LAVA');
        state.player = {
            ...state.player,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createTestPassiveSkill(TEST_MOTION_CORE) as any,
                createTestPassiveSkill(TEST_MOTION_ADAPT) as any
            ]
        };

        const stepOne = BASIC_MOVE.execute(state, state.player, wallTarget);
        expect(stepOne.consumesTurn).toBe(true);
        const afterWall = applyEffects(state, stepOne.effects, { sourceId: state.player.id });
        expect(hexEquals(afterWall.player.position, wallTarget)).toBe(true);

        const stepTwo = BASIC_MOVE.execute(afterWall, afterWall.player, lavaTarget);
        expect(stepTwo.consumesTurn).toBe(true);
        const afterLava = applyEffects(afterWall, stepTwo.effects, { sourceId: afterWall.player.id });
        expect(hexEquals(afterLava.player.position, lavaTarget)).toBe(true);
        expect(afterLava.player.hp).toBeGreaterThan(0);
    });
});
