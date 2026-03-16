import { describe, expect, it } from 'vitest';
import { createHex } from '../hex';
import { generateInitialState } from '../logic';
import { createActiveSkill } from '../skillRegistry';
import { buildSkillActions } from '../systems/ai/player/candidates';
import { createEnemy } from '../systems/entities/entity-factory';

describe('player candidate generation', () => {
    it('excludes passive no-op self skills marked as non-turn-consuming', () => {
        const state = generateInitialState(1, 'player-candidate-absorb-fire');
        state.player = {
            ...state.player,
            position: createHex(4, 4),
            activeSkills: [
                createActiveSkill('ABSORB_FIRE'),
                createActiveSkill('BASIC_ATTACK')
            ].filter(Boolean) as any[]
        };
        state.enemies = [
            createEnemy({
                id: 'candidate-target',
                subtype: 'footman',
                position: createHex(4, 3),
                hp: 8,
                maxHp: 8,
                speed: 1,
                skills: ['BASIC_MOVE', 'BASIC_ATTACK']
            })
        ];

        const actions = buildSkillActions(state);

        expect(actions.some(candidate => candidate.action.type === 'USE_SKILL' && candidate.action.payload.skillId === 'ABSORB_FIRE')).toBe(false);
        expect(actions.some(candidate => candidate.action.type === 'USE_SKILL' && candidate.action.payload.skillId === 'BASIC_ATTACK')).toBe(true);
    });
});
