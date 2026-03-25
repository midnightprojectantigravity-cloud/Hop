import { afterEach, describe, expect, it } from 'vitest';
import { hexDistance, hexEquals, pointToKey } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { createActiveSkill, COMPOSITIONAL_SKILLS, SkillRegistry } from '../skillRegistry';
import type { AtomicEffect, Actor, GameState, Point, SkillDefinition } from '../types';
import { clearCapabilityStateCacheForTests } from '../systems/capabilities/cache';
import { getDefaultMovementCapabilityModel, resolveMovementCapabilities } from '../systems/capabilities/movement';
import { resolveSkillMovementPolicy } from '../systems/capabilities/movement-policy';
import { applyEffects } from '../systems/effect-engine';
import { createMockState, p, placeTile } from './test_utils';

const TEST_REPLACE_SKILL_ID = 'TEST_MOVE_REPLACE_CAP';
const TEST_EXTEND_SKILL_ID = 'TEST_MOVE_EXTEND_CAP';
const TEST_BLOCK_SKILL_ID = 'TEST_MOVE_BLOCK_CAP';

const toPassiveDefinition = (
    id: string,
    movementProviders: NonNullable<SkillDefinition['capabilities']>['movement']
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
    upgrades: {},
    capabilities: {
        movement: movementProviders
    }
});

const registerTestSkill = (definition: SkillDefinition): void => {
    (COMPOSITIONAL_SKILLS as unknown as Record<string, SkillDefinition>)[definition.id] = definition;
};

const unregisterTestSkill = (id: string): void => {
    delete (COMPOSITIONAL_SKILLS as unknown as Record<string, SkillDefinition>)[id];
};

afterEach(() => {
    unregisterTestSkill(TEST_REPLACE_SKILL_ID);
    unregisterTestSkill(TEST_EXTEND_SKILL_ID);
    unregisterTestSkill(TEST_BLOCK_SKILL_ID);
    clearCapabilityStateCacheForTests();
});

describe('movement capability runtime integration', () => {
    it('resolves replace then extend movement models from actor capabilities', () => {
        registerTestSkill(toPassiveDefinition(TEST_REPLACE_SKILL_ID, [{
            domain: 'movement',
            providerId: 'test.replace',
            priority: 30,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'teleport',
                    ignoreWalls: true,
                    ignoreGroundHazards: true
                }
            })
        }]));
        registerTestSkill(toPassiveDefinition(TEST_EXTEND_SKILL_ID, [{
            domain: 'movement',
            providerId: 'test.extend',
            priority: 10,
            resolutionMode: 'EXTEND',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'EXTEND',
                model: {
                    rangeModifier: 3,
                    allowPassThroughActors: true
                }
            })
        }]));

        const state = generateInitialState(1, 'cap-move-resolve-seed');
        clearCapabilityStateCacheForTests();
        state.player = {
            ...state.player,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill(TEST_REPLACE_SKILL_ID as any) as any,
                createActiveSkill(TEST_EXTEND_SKILL_ID as any) as any
            ]
        };

        const resolved = resolveMovementCapabilities(state, state.player, { skillId: 'BASIC_MOVE' });
        expect(resolved.meta.decision).toBe('allow');
        expect(resolved.model.pathing).toBe('teleport');
        expect(resolved.model.ignoreWalls).toBe(true);
        expect(resolved.model.ignoreGroundHazards).toBe(true);
        expect(resolved.model.allowPassThroughActors).toBe(true);
        expect(resolved.model.rangeModifier).toBe(3);
    });

    it('falls back to default model when a hard block provider interdicts movement', () => {
        registerTestSkill(toPassiveDefinition(TEST_REPLACE_SKILL_ID, [{
            domain: 'movement',
            providerId: 'test.replace',
            priority: 30,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'teleport',
                    ignoreWalls: true
                }
            })
        }]));
        registerTestSkill(toPassiveDefinition(TEST_BLOCK_SKILL_ID, [{
            domain: 'movement',
            providerId: 'test.block',
            priority: 99,
            resolutionMode: 'EXTEND',
            resolve: () => ({
                decision: 'block',
                blockKind: 'hard',
                resolutionMode: 'EXTEND'
            })
        }]));

        const state = generateInitialState(1, 'cap-move-block-seed');
        clearCapabilityStateCacheForTests();
        state.player = {
            ...state.player,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill(TEST_REPLACE_SKILL_ID as any) as any,
                createActiveSkill(TEST_BLOCK_SKILL_ID as any) as any
            ]
        };

        const resolved = resolveMovementCapabilities(state, state.player, { skillId: 'BASIC_MOVE' });
        expect(resolved.meta.decision).toBe('block');
        expect(resolved.meta.blockedByHardBlock).toBe(true);
        expect(resolved.model).toEqual(getDefaultMovementCapabilityModel());
    });

    it('applies movement capability model to BASIC_MOVE targeting and execution', () => {
        registerTestSkill(toPassiveDefinition(TEST_REPLACE_SKILL_ID, [{
            domain: 'movement',
            providerId: 'test.replace',
            priority: 30,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'teleport',
                    ignoreWalls: true,
                    ignoreGroundHazards: true,
                    rangeModifier: 3
                }
            })
        }]));

        const baseState = generateInitialState(1, 'cap-move-basic-runtime');
        clearCapabilityStateCacheForTests();
        const baseMoveSkill = createActiveSkill('BASIC_MOVE') as any;
        const basePlayer = {
            ...baseState.player,
            speed: 1,
            activeSkills: [baseMoveSkill]
        };
        const baseView = {
            ...baseState,
            player: basePlayer
        };
        const basicMoveDef = SkillRegistry.get('BASIC_MOVE');
        expect(basicMoveDef?.getValidTargets).toBeTruthy();
        const baseTargets = basicMoveDef!.getValidTargets!(baseView, basePlayer.position);
        const baseMaxDistance = baseTargets.reduce((max, point) => Math.max(max, hexDistance(basePlayer.position, point)), 0);

        const capabilityPlayer = {
            ...basePlayer,
            activeSkills: [
                ...basePlayer.activeSkills,
                createActiveSkill(TEST_REPLACE_SKILL_ID as any) as any
            ]
        };
        const capabilityFlagOffState = {
            ...baseView,
            player: capabilityPlayer,
            ruleset: {
                ...baseView.ruleset!,
                capabilities: {
                    ...baseView.ruleset!.capabilities!,
                    movementRuntimeEnabled: false
                }
            }
        };
        const capabilityFlagOffTargets = basicMoveDef!.getValidTargets!(capabilityFlagOffState, capabilityPlayer.position);
        const capabilityFlagOffMaxDistance = capabilityFlagOffTargets.reduce(
            (max, point) => Math.max(max, hexDistance(capabilityPlayer.position, point)),
            0
        );
        expect(capabilityFlagOffMaxDistance).toBe(baseMaxDistance);

        const capabilityState = {
            ...baseView,
            player: capabilityPlayer,
            ruleset: {
                ...baseView.ruleset!,
                capabilities: {
                    ...baseView.ruleset!.capabilities!,
                    movementRuntimeEnabled: true
                }
            }
        };
        clearCapabilityStateCacheForTests();

        const capabilityTargets = basicMoveDef!.getValidTargets!(capabilityState, capabilityPlayer.position);
        const farTarget = capabilityTargets.find(point => hexDistance(capabilityPlayer.position, point) > baseMaxDistance);
        expect(farTarget).toBeTruthy();

        const baseAttempt = basicMoveDef!.execute(baseView, basePlayer, farTarget);
        expect(baseAttempt.consumesTurn).toBe(false);

        const capabilityAttempt = basicMoveDef!.execute(capabilityState, capabilityPlayer, farTarget);
        expect(capabilityAttempt.consumesTurn).toBe(true);
        const displacement = capabilityAttempt.effects.find(effect => effect.type === 'Displacement') as Extract<AtomicEffect, { type: 'Displacement' }> | undefined;
        expect(displacement?.destination).toEqual(farTarget);
        expect(displacement?.simulatePath).toBe(false);
        expect(displacement?.ignoreGroundHazards).toBe(true);
    });

    it('applies ignoreWalls capabilities during displacement runtime for BASIC_MOVE', () => {
        const state = createMockState();
        state.player = {
            ...state.player,
            position: p(4, 4),
            previousPosition: p(4, 4),
            speed: 2,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('BURROW') as any
            ]
        };
        state.ruleset = {
            ...state.ruleset,
            capabilities: {
                ...(state.ruleset?.capabilities || {
                    loadoutPassivesEnabled: false,
                    movementRuntimeEnabled: false,
                    version: 'capabilities-v1' as const
                }),
                movementRuntimeEnabled: true
            }
        };

        for (let q = 0; q < 10; q++) {
            for (let r = 0; r < 10; r++) {
                placeTile(state, p(q, r), [], 'STONE');
            }
        }

        const target = p(6, 4);
        const lava = p(6, 5);
        placeTile(state, p(5, 4), ['BLOCKS_MOVEMENT'] as any, 'WALL');
        placeTile(state, p(5, 3), ['BLOCKS_MOVEMENT'] as any, 'WALL');
        placeTile(state, p(6, 3), ['BLOCKS_MOVEMENT'] as any, 'WALL');
        placeTile(state, p(4, 5), ['BLOCKS_MOVEMENT'] as any, 'WALL');
        placeTile(state, p(5, 5), ['BLOCKS_MOVEMENT'] as any, 'WALL');
        placeTile(state, lava, ['HAZARDOUS', 'LAVA', 'LIQUID'] as any, 'LAVA');

        const basicMoveDef = SkillRegistry.get('BASIC_MOVE');
        expect(basicMoveDef?.getValidTargets).toBeTruthy();
        const validTargets = basicMoveDef!.getValidTargets!(state, state.player.position);
        expect(validTargets).toContainEqual(target);
        expect(validTargets.some(point => hexEquals(point, p(5, 4)))).toBe(false);
        expect(validTargets.some(point => hexEquals(point, lava))).toBe(false);

        const execution = basicMoveDef!.execute(state, state.player, target);
        expect(execution.consumesTurn).toBe(true);

        const displacement = execution.effects.find(
            (effect): effect is Extract<AtomicEffect, { type: 'Displacement' }> => effect.type === 'Displacement'
        );
        expect(displacement?.ignoreWalls).toBe(true);

        const next = applyEffects(state, execution.effects, { sourceId: state.player.id });
        expect(next.player.position).toEqual(target);
    });

    it('prefers a walkable route around blockers before tunneling through them', () => {
        const state = createMockState();
        state.player = {
            ...state.player,
            position: p(4, 4),
            previousPosition: p(4, 4),
            speed: 3,
            activeSkills: [
                createActiveSkill('BASIC_MOVE') as any,
                createActiveSkill('BURROW') as any
            ]
        };
        state.ruleset = {
            ...state.ruleset,
            capabilities: {
                ...(state.ruleset?.capabilities || {
                    loadoutPassivesEnabled: false,
                    movementRuntimeEnabled: false,
                    version: 'capabilities-v1' as const
                }),
                movementRuntimeEnabled: true
            }
        };

        for (let q = 0; q < 10; q++) {
            for (let r = 0; r < 10; r++) {
                placeTile(state, p(q, r), [], 'STONE');
            }
        }

        const target = p(6, 4);
        placeTile(state, p(5, 4), ['BLOCKS_MOVEMENT'] as any, 'WALL');

        const basicMoveDef = SkillRegistry.get('BASIC_MOVE');
        const execution = basicMoveDef!.execute(state, state.player, target);
        expect(execution.consumesTurn).toBe(true);

        const displacement = execution.effects.find(
            (effect): effect is Extract<AtomicEffect, { type: 'Displacement' }> => effect.type === 'Displacement'
        );
        expect(displacement?.path).toEqual([
            p(4, 4),
            p(5, 3),
            p(6, 3),
            p(6, 4)
        ]);

        const next = applyEffects(state, execution.effects, { sourceId: state.player.id });
        expect(next.player.position).toEqual(target);
    });

    it('applies movement capability runtime when enabled through START_RUN overrides', () => {
        registerTestSkill(toPassiveDefinition(TEST_REPLACE_SKILL_ID, [{
            domain: 'movement',
            providerId: 'test.replace',
            priority: 30,
            resolutionMode: 'REPLACE',
            resolve: () => ({
                decision: 'allow',
                resolutionMode: 'REPLACE',
                model: {
                    pathing: 'teleport',
                    ignoreWalls: true,
                    ignoreGroundHazards: true,
                    rangeModifier: 3
                }
            })
        }]));

        const seed = 'cap-move-start-run-runtime-toggle';
        const hub = gameReducer(generateInitialState(1, `${seed}:hub`), { type: 'EXIT_TO_HUB' });
        const runDisabled = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed,
                rulesetOverrides: {
                    capabilities: {
                        movementRuntimeEnabled: false
                    }
                }
            }
        });
        const runEnabled = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                seed,
                rulesetOverrides: {
                    capabilities: {
                        movementRuntimeEnabled: true
                    }
                }
            }
        });

        const withTestSkill = (state: GameState): GameState => ({
            ...state,
            player: {
                ...state.player,
                speed: 1,
                activeSkills: [
                    ...state.player.activeSkills,
                    createActiveSkill(TEST_REPLACE_SKILL_ID as any) as any
                ]
            }
        });

        const disabledState = withTestSkill(runDisabled);
        const enabledState = withTestSkill(runEnabled);
        clearCapabilityStateCacheForTests();

        const basicMoveDef = SkillRegistry.get('BASIC_MOVE');
        expect(basicMoveDef?.getValidTargets).toBeTruthy();

        const disabledTargets = basicMoveDef!.getValidTargets!(disabledState, disabledState.player.position);
        const disabledMaxDistance = disabledTargets.reduce(
            (max, point) => Math.max(max, hexDistance(disabledState.player.position, point)),
            0
        );

        const enabledTargets = basicMoveDef!.getValidTargets!(enabledState, enabledState.player.position);
        const enabledMaxDistance = enabledTargets.reduce(
            (max, point) => Math.max(max, hexDistance(enabledState.player.position, point)),
            0
        );

        expect(enabledMaxDistance).toBeGreaterThan(disabledMaxDistance);
        const farTarget = enabledTargets.find(point => hexDistance(enabledState.player.position, point) > disabledMaxDistance);
        expect(farTarget).toBeTruthy();

        const disabledAttempt = basicMoveDef!.execute(disabledState, disabledState.player, farTarget);
        expect(disabledAttempt.consumesTurn).toBe(false);

        const enabledAttempt = basicMoveDef!.execute(enabledState, enabledState.player, farTarget);
        expect(enabledAttempt.consumesTurn).toBe(true);
        const displacement = enabledAttempt.effects.find(effect => effect.type === 'Displacement') as Extract<AtomicEffect, { type: 'Displacement' }> | undefined;
        expect(displacement?.destination).toEqual(farTarget);
        expect(displacement?.simulatePath).toBe(false);
        expect(displacement?.ignoreGroundHazards).toBe(true);
    });

    it('resolves built-in movement passive capability models', () => {
        const state = generateInitialState(1, 'cap-move-builtins');
        clearCapabilityStateCacheForTests();

        const withMovementPassive = (skillId: 'FLIGHT' | 'PHASE_STEP' | 'BURROW') => ({
            ...state,
            player: {
                ...state.player,
                activeSkills: [
                    createActiveSkill('BASIC_MOVE') as any,
                    createActiveSkill(skillId) as any
                ]
            }
        });

        const flight = resolveMovementCapabilities(withMovementPassive('FLIGHT'), withMovementPassive('FLIGHT').player, { skillId: 'BASIC_MOVE' });
        expect(flight.model.pathing).toBe('flight');
        expect(flight.model.ignoreGroundHazards).toBe(true);
        expect(flight.model.ignoreWalls).toBe(false);
        expect(flight.model.allowPassThroughActors).toBe(false);
        expect(flight.model.rangeModifier).toBe(0);

        const phaseStep = resolveMovementCapabilities(withMovementPassive('PHASE_STEP'), withMovementPassive('PHASE_STEP').player, { skillId: 'BASIC_MOVE' });
        expect(phaseStep.model.pathing).toBe('teleport');
        expect(phaseStep.model.ignoreGroundHazards).toBe(true);
        expect(phaseStep.model.ignoreWalls).toBe(true);
        expect(phaseStep.model.allowPassThroughActors).toBe(true);
        expect(phaseStep.model.rangeModifier).toBe(-1);

        const burrow = resolveMovementCapabilities(withMovementPassive('BURROW'), withMovementPassive('BURROW').player, { skillId: 'BASIC_MOVE' });
        expect(burrow.model.pathing).toBe('walk');
        expect(burrow.model.ignoreGroundHazards).toBe(true);
        expect(burrow.model.ignoreWalls).toBe(true);
        expect(burrow.model.allowPassThroughActors).toBe(false);
        expect(burrow.model.rangeModifier).toBe(0);
    });

    it('applies archetype-mapped movement passives only when movement runtime is enabled', () => {
        const seed = 'cap-move-archetype-mapping';
        const hub = gameReducer(generateInitialState(1, `${seed}:hub`), { type: 'EXIT_TO_HUB' });
        const expectedByLoadout = {
            VANGUARD: { skillId: 'BURROW', pathing: 'walk', ignoreWalls: true, ignoreGroundHazards: true, allowPassThroughActors: false, rangeModifier: 0 },
            SKIRMISHER: { skillId: 'FLIGHT', pathing: 'flight', ignoreWalls: false, ignoreGroundHazards: true, allowPassThroughActors: false, rangeModifier: 0 },
            FIREMAGE: { skillId: 'FLIGHT', pathing: 'flight', ignoreWalls: false, ignoreGroundHazards: true, allowPassThroughActors: false, rangeModifier: 0 },
            NECROMANCER: { skillId: 'BURROW', pathing: 'walk', ignoreWalls: true, ignoreGroundHazards: true, allowPassThroughActors: false, rangeModifier: 0 },
            HUNTER: { skillId: 'BURROW', pathing: 'walk', ignoreWalls: true, ignoreGroundHazards: true, allowPassThroughActors: false, rangeModifier: 0 },
            ASSASSIN: { skillId: 'PHASE_STEP', pathing: 'teleport', ignoreWalls: true, ignoreGroundHazards: true, allowPassThroughActors: true, rangeModifier: -1 }
        } as const;

        for (const [loadoutId, expected] of Object.entries(expectedByLoadout) as Array<
            [keyof typeof expectedByLoadout, (typeof expectedByLoadout)[keyof typeof expectedByLoadout]]
        >) {
            const runtimeOff = gameReducer(hub, {
                type: 'START_RUN',
                payload: {
                    loadoutId,
                    seed: `${seed}:${loadoutId}:off`,
                    rulesetOverrides: {
                        capabilities: {
                            loadoutPassivesEnabled: true,
                            movementRuntimeEnabled: false
                        }
                    }
                }
            });

            const runtimeOn = gameReducer(hub, {
                type: 'START_RUN',
                payload: {
                    loadoutId,
                    seed: `${seed}:${loadoutId}:on`,
                    rulesetOverrides: {
                        capabilities: {
                            loadoutPassivesEnabled: true,
                            movementRuntimeEnabled: true
                        }
                    }
                }
            });

            expect(runtimeOn.player.activeSkills.some(skill => skill.id === expected.skillId)).toBe(true);

            const policyOff = resolveSkillMovementPolicy(runtimeOff, runtimeOff.player, {
                skillId: 'BASIC_MOVE',
                baseRange: 3
            });
            const policyOn = resolveSkillMovementPolicy(runtimeOn, runtimeOn.player, {
                skillId: 'BASIC_MOVE',
                baseRange: 3
            });

            expect(policyOff.pathing).toBe('walk');
            expect(policyOff.ignoreWalls).toBe(false);
            expect(policyOff.ignoreGroundHazards).toBe(false);
            expect(policyOff.allowPassThroughActors).toBe(false);
            expect(policyOff.range).toBe(3);

            expect(policyOn.pathing).toBe(expected.pathing);
            expect(policyOn.ignoreWalls).toBe(expected.ignoreWalls);
            expect(policyOn.ignoreGroundHazards).toBe(expected.ignoreGroundHazards);
            expect(policyOn.allowPassThroughActors).toBe(expected.allowPassThroughActors);
            expect(policyOn.range).toBe(Math.max(0, 3 + expected.rangeModifier));
        }
    });

    it('does not treat BLOCKS_LOS-only tiles (smoke) as movement walls', () => {
        const state = generateInitialState(1, 'cap-move-smoke-tile');
        clearCapabilityStateCacheForTests();
        const basicMoveDef = SkillRegistry.get('BASIC_MOVE');
        expect(basicMoveDef?.getValidTargets).toBeTruthy();

        const player = {
            ...state.player,
            speed: 1,
            activeSkills: [createActiveSkill('BASIC_MOVE') as any]
        };
        const view = {
            ...state,
            player
        };

        const baselineTargets = basicMoveDef!.getValidTargets!(view, player.position);
        expect(baselineTargets.length).toBeGreaterThan(0);
        const smokeTarget = baselineTargets[0];
        const smokeKey = pointToKey(smokeTarget);
        const targetTile = view.tiles.get(smokeKey) ?? {
            position: smokeTarget,
            baseId: 'STONE',
            traits: new Set(['WALKABLE']),
            effects: []
        };
        view.tiles.set(smokeKey, {
            ...targetTile!,
            effects: [...targetTile!.effects, { id: 'SMOKE', duration: 2, potency: 1 }]
        });

        const targets = basicMoveDef!.getValidTargets!(view, player.position);
        expect(targets.some(point => point.q === smokeTarget.q && point.r === smokeTarget.r)).toBe(true);

        const result = basicMoveDef!.execute(view, player, smokeTarget);
        expect(result.consumesTurn).toBe(true);
    });
});
