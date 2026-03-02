import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { createActiveSkill } from '../skillRegistry';
import { getCapabilityCompileCountForTests, clearCapabilityStateCacheForTests } from '../systems/capabilities/cache';
import { foldCapabilityDecisions } from '../systems/capabilities/resolver';
import { resolveMovementModelFromProviderResultsForTests } from '../systems/capabilities/movement';
import { validateLineOfSight } from '../systems/validation';

describe('capability resolver', () => {
    it('hard block overrides allows', () => {
        const folded = foldCapabilityDecisions([
            { providerKey: 'a', priority: 5, decision: 'allow' },
            { providerKey: 'b', priority: 1, decision: 'block', blockKind: 'hard' }
        ]);
        expect(folded.decision).toBe('block');
        expect(folded.blockedByHardBlock).toBe(true);
    });

    it('soft block wins ties against allow', () => {
        const folded = foldCapabilityDecisions([
            { providerKey: 'a', priority: 8, decision: 'allow' },
            { providerKey: 'b', priority: 8, decision: 'block', blockKind: 'soft' }
        ]);
        expect(folded.decision).toBe('block');
    });

    it('higher allow priority beats soft block', () => {
        const folded = foldCapabilityDecisions([
            { providerKey: 'a', priority: 9, decision: 'allow' },
            { providerKey: 'b', priority: 8, decision: 'block', blockKind: 'soft' }
        ]);
        expect(folded.decision).toBe('allow');
    });

    it('compiles capability bundle once per actor per state', () => {
        const state = generateInitialState(1, 'capability-cache-state');
        const vision = createActiveSkill('STANDARD_VISION');
        expect(vision).toBeTruthy();
        state.player = {
            ...state.player,
            position: createHex(2, 6),
            activeSkills: [vision as any]
        };

        clearCapabilityStateCacheForTests();
        expect(getCapabilityCompileCountForTests()).toBe(0);

        // Trigger capability compilation through LoS checks.
        state.player.activeSkills.forEach(() => {
            // no-op loop to keep deterministic ordering explicit in test body
        });
        const firstCompileState = { ...state };
        const secondCompileState = { ...state };

        // State A compile
        validateLineOfSight(firstCompileState, state.player.position, createHex(2, 5), {
            observerActor: firstCompileState.player,
            excludeActorId: firstCompileState.player.id
        });
        validateLineOfSight(firstCompileState, state.player.position, createHex(2, 5), {
            observerActor: firstCompileState.player,
            excludeActorId: firstCompileState.player.id
        });
        expect(getCapabilityCompileCountForTests()).toBe(1);

        // New immutable state instance should compile again.
        validateLineOfSight(secondCompileState, state.player.position, createHex(2, 5), {
            observerActor: secondCompileState.player,
            excludeActorId: secondCompileState.player.id
        });
        expect(getCapabilityCompileCountForTests()).toBe(2);
    });

    it('movement model resolves replace then extends deterministically', () => {
        const model = resolveMovementModelFromProviderResultsForTests([
            {
                compiled: { skillId: 'S2', providerId: 'replace.high', priority: 30, resolutionMode: 'REPLACE', provider: null as any },
                result: {
                    decision: 'allow',
                    resolutionMode: 'REPLACE',
                    model: {
                        pathing: 'flight',
                        ignoreWalls: true
                    }
                }
            },
            {
                compiled: { skillId: 'S1', providerId: 'extend.low', priority: 10, resolutionMode: 'EXTEND', provider: null as any },
                result: {
                    decision: 'allow',
                    resolutionMode: 'EXTEND',
                    model: {
                        rangeModifier: 2
                    }
                }
            },
            {
                compiled: { skillId: 'S1', providerId: 'extend.mid', priority: 15, resolutionMode: 'EXTEND', provider: null as any },
                result: {
                    decision: 'allow',
                    resolutionMode: 'EXTEND',
                    model: {
                        allowPassThroughActors: true
                    }
                }
            }
        ] as any);

        expect(model.pathing).toBe('flight');
        expect(model.ignoreWalls).toBe(true);
        expect(model.allowPassThroughActors).toBe(true);
        expect(model.rangeModifier).toBe(2);
    });
});
