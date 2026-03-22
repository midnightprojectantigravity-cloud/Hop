import { describe, expect, it } from 'vitest';
import { getInitiativeScore } from '../systems/initiative';
import { generateInitialState } from '../logic';
import type { TrinityComponent } from '../systems/components';

describe('initiative trinity_ratio_v2', () => {
    it('uses composite instinct and mind with speed as modifier', () => {
        const state = generateInitialState(1, 'initiative-v2');
        const actor = {
            ...state.player,
            speed: 5,
            components: new Map<string, TrinityComponent>([['trinity', { type: 'trinity', body: 2, mind: 10, instinct: 20 }]])
        };
        const ruleset = {
            ...(state.ruleset || {}),
            combat: { version: 'trinity_ratio_v2' as const }
        };

        const score = getInitiativeScore(actor, ruleset);
        expect(score).toBeCloseTo((0.7 * 20) + (0.3 * 10) + 5, 5);
    });
});
