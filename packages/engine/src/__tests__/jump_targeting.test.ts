import { describe, expect, it } from 'vitest';
import { SkillRegistry } from '../skillRegistry';
import { createMockState, p, placeTile } from './test_utils';

describe('jump targeting', () => {
    it('allows jumping over hazards but not landing on them', () => {
        const state = createMockState();
        state.player = {
            ...state.player,
            position: p(4, 4),
            previousPosition: p(4, 4)
        };

        for (let q = 0; q < 9; q += 1) {
            for (let r = 0; r < 11; r += 1) {
                placeTile(state, p(q, r), [], 'STONE');
            }
        }

        const lava = p(4, 3);
        const farLanding = p(4, 2);
        placeTile(state, lava, ['HAZARDOUS', 'LAVA', 'LIQUID'] as any, 'LAVA');

        const jumpDef = SkillRegistry.get('JUMP');
        const targets = jumpDef?.getValidTargets?.(state, state.player.position) || [];

        expect(targets).not.toContainEqual(lava);
        expect(targets).toContainEqual(farLanding);

        const execution = jumpDef?.execute(state, state.player, lava);
        expect(execution?.consumesTurn).toBe(false);
        expect(execution?.messages).toContain('Cannot land on hazard!');
    });
});
