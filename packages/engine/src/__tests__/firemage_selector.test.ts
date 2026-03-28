import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { gameReducer, generateInitialState } from '../logic';
import { DEFAULT_LOADOUTS } from '../systems/loadout';
import { selectByOnePlySimulation } from '../systems/ai/player/selector';
import { resolvePending } from '../systems/ai/player/selector';
import { chooseStrategicIntent } from '../systems/ai/player/policy';
import { getStrategicPolicyProfile } from '../systems/ai/strategic-policy';
import { createEnemy } from '../systems/entities/entity-factory';
import { applyIresMutationToActor } from '../systems/ires/state';
import { resolveIresRuleset } from '../systems/ires/config';
import { isPlayerTurn } from '../systems/initiative';

const advanceToPlayerTurn = <T extends ReturnType<typeof generateInitialState>>(state: T): T => {
    let cur = state;
    let safety = 0;
    while (!isPlayerTurn(cur) && safety < 12) {
        cur = resolvePending(gameReducer(cur, { type: 'ADVANCE_TURN' })) as T;
        safety++;
    }
    return cur;
};

describe('Firemage selector under IRES pressure', () => {
    it('prefers fireball over movement on a stable single-target opening', () => {
        const profile = getStrategicPolicyProfile('sp-v1-default');
        const base = generateInitialState(1, 'firemage-fireball-choice', 'firemage-fireball-choice', undefined, DEFAULT_LOADOUTS.FIREMAGE);
        const state = advanceToPlayerTurn({
            ...base,
            player: {
                ...base.player,
                position: createHex(4, 4)
            },
            enemies: [
                createEnemy({
                    id: 'firemage-fireball-target',
                    subtype: 'footman',
                    position: createHex(4, 2),
                    hp: 16,
                    maxHp: 16,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                })
            ]
        });

        const strategicIntent = chooseStrategicIntent(state, profile);
        const action = selectByOnePlySimulation(state, strategicIntent, profile, 'firemage-fireball-sim', 0);

        expect(strategicIntent).toBe('offense');
        expect(action).toEqual({
            type: 'USE_SKILL',
            payload: {
                skillId: 'FIREBALL',
                target: createHex(4, 2)
            }
        });
    });

    it('commits to a fire spell instead of neutral movement when clustered enemies are in range', () => {
        const profile = getStrategicPolicyProfile('sp-v1-default');
        const base = generateInitialState(1, 'firemage-firewall-choice', 'firemage-firewall-choice', undefined, DEFAULT_LOADOUTS.FIREMAGE);
        const state = advanceToPlayerTurn({
            ...base,
            player: {
                ...base.player,
                position: createHex(4, 4)
            },
            enemies: [
                createEnemy({
                    id: 'firemage-firewall-target-a',
                    subtype: 'footman',
                    position: createHex(4, 2),
                    hp: 16,
                    maxHp: 16,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                }),
                createEnemy({
                    id: 'firemage-firewall-target-b',
                    subtype: 'footman',
                    position: createHex(5, 2),
                    hp: 16,
                    maxHp: 16,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                })
            ]
        });

        const strategicIntent = chooseStrategicIntent(state, profile);
        const action = selectByOnePlySimulation(state, strategicIntent, profile, 'firemage-firewall-sim', 0);

        expect(strategicIntent).toBe('offense');
        expect(action.type).toBe('USE_SKILL');
        if (action.type === 'USE_SKILL') {
            expect(['FIREBALL', 'FIREWALL']).toContain(action.payload.skillId);
        }
    });

    it('chooses to rest in combat when exhaustion and resources are already redlining', () => {
        const profile = getStrategicPolicyProfile('sp-v1-default');
        const base = generateInitialState(1, 'firemage-rest-choice', 'firemage-rest-choice', undefined, DEFAULT_LOADOUTS.FIREMAGE);
        const config = resolveIresRuleset(base.ruleset);
        const player = applyIresMutationToActor(
            {
                ...base.player,
                position: createHex(4, 4)
            },
            {
                sparkDelta: -75,
                manaDelta: -14,
                exhaustionDelta: 72
            },
            config
        );
        const state = {
            ...base,
            player,
            enemies: [
                createEnemy({
                    id: 'firemage-rest-target',
                    subtype: 'footman',
                    position: createHex(4, 2),
                    hp: 18,
                    maxHp: 18,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                })
            ]
        };

        const strategicIntent = chooseStrategicIntent(state, profile);
        const action = selectByOnePlySimulation(state, strategicIntent, profile, 'firemage-rest-sim', 0);

        expect(strategicIntent).toBe('defense');
        expect(action).toEqual({ type: 'WAIT' });
    });

    it('paces before entering exhausted when a ranged cast would dump remaining spark', () => {
        const profile = getStrategicPolicyProfile('sp-v1-default');
        const base = generateInitialState(1, 'firemage-pre-exhaustion-pace', 'firemage-pre-exhaustion-pace', undefined, DEFAULT_LOADOUTS.FIREMAGE);
        const config = resolveIresRuleset(base.ruleset);
        const player = applyIresMutationToActor(
            {
                ...base.player,
                position: createHex(4, 4)
            },
            {
                sparkDelta: -80,
                manaDelta: -8,
                actionCountDelta: 1,
                movedThisTurn: true
            },
            config
        );
        const state = {
            ...base,
            player,
            enemies: [
                createEnemy({
                    id: 'firemage-pre-exhaustion-target',
                    subtype: 'footman',
                    position: createHex(4, 2),
                    hp: 18,
                    maxHp: 18,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                })
            ]
        };

        expect(state.player.ires?.currentState).toBe('base');

        const strategicIntent = chooseStrategicIntent(state, profile);
        const action = selectByOnePlySimulation(state, strategicIntent, profile, 'firemage-pre-exhaustion-sim', 1);

        expect(strategicIntent).toBe('defense');
        expect(action).toEqual({ type: 'WAIT' });
    });

    it('ends a stressed Firemage turn instead of forcing another action', () => {
        const profile = getStrategicPolicyProfile('sp-v1-default');
        const base = generateInitialState(1, 'firemage-end-turn-choice', 'firemage-end-turn-choice', undefined, DEFAULT_LOADOUTS.FIREMAGE);
        const config = resolveIresRuleset(base.ruleset);
        const player = applyIresMutationToActor(
            {
                ...base.player,
                position: createHex(4, 4)
            },
            {
                sparkDelta: -70,
                manaDelta: -16,
                exhaustionDelta: 66,
                actionCountDelta: 2,
                movedThisTurn: true,
                actedThisTurn: true
            },
            config
        );
        const state = {
            ...base,
            player,
            enemies: [
                createEnemy({
                    id: 'firemage-end-target',
                    subtype: 'footman',
                    position: createHex(5, 3),
                    hp: 20,
                    maxHp: 20,
                    speed: 1,
                    skills: ['BASIC_MOVE', 'BASIC_ATTACK']
                })
            ]
        };

        const strategicIntent = chooseStrategicIntent(state, profile);
        const action = selectByOnePlySimulation(state, strategicIntent, profile, 'firemage-end-turn-sim', 1);

        expect(strategicIntent).toBe('defense');
        expect(action).toEqual({ type: 'WAIT' });
    });
});
