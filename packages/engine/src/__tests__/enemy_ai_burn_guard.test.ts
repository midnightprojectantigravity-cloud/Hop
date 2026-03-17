import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { selectEnemyDecision } from '../systems/ai/enemy/selector';
import { createEnemy } from '../systems/entities/entity-factory';
import { applyIresMutationToActor, resolveIresRuleset } from '../systems/ires';

describe('enemy ai burn guard', () => {
    it('chooses WAIT over self-burning spark actions', () => {
        const base = generateInitialState(1, 'enemy-ai-burn-guard');
        const playerPos = createHex(4, 5);
        const exhaustedEnemy = applyIresMutationToActor(createEnemy({
            id: 'burn_guard_enemy',
            subtype: 'raider',
            position: createHex(5, 5),
            speed: 1,
            skills: ['BASIC_MOVE', 'BASIC_ATTACK'],
            trinity: { body: 6, mind: 3, instinct: 4 }
        }), {
            exhaustionDelta: 80
        }, resolveIresRuleset(base.ruleset));
        const state = {
            ...base,
            player: {
                ...base.player,
                position: playerPos,
                previousPosition: playerPos
            },
            enemies: [exhaustedEnemy],
            companions: []
        };

        const selected = selectEnemyDecision({
            enemy: exhaustedEnemy,
            playerPos,
            state
        });

        expect(exhaustedEnemy.ires?.isExhausted).toBe(true);
        expect(selected.decision.action.type).toBe('WAIT');
        expect(selected.decision.action.skillId).toBe('WAIT_SKILL');
    });
});
