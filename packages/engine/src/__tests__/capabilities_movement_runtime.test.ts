import { afterEach, describe, expect, it } from 'vitest';
import { hexDistance, pointToKey } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { createActiveSkill, COMPOSITIONAL_SKILLS, SkillRegistry } from '../skillRegistry';
import type { AtomicEffect, Actor, GameState, Point, SkillDefinition } from '../types';
import { clearCapabilityStateCacheForTests } from '../systems/capabilities/cache';
import { getDefaultMovementCapabilityModel, resolveMovementCapabilities } from '../systems/capabilities/movement';

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
