import { describe, expect, it } from 'vitest';
import { applyEffects } from '../systems/effect-engine';
import { generateInitialState } from '../logic';

describe('ACAE effect handler integration', () => {
    it('handles apply/deposit/clear ailment effects via effect engine', () => {
        let state = generateInitialState(1, 'acae-handler-seed');
        state.ruleset = { ailments: { acaeEnabled: true, version: 'acae-v1' } };
        const target = state.enemies[0];

        state = applyEffects(state, [
            { type: 'ApplyAilment', target: target.id, ailment: 'bleed', skillMultiplier: 100, baseDeposit: 2 }
        ], {
            sourceId: state.player.id,
            targetId: target.id
        });

        const afterApply = state.enemies.find(e => e.id === target.id);
        const countersAfterApply = (afterApply?.components?.get('ailments') as { counters?: Record<string, number> } | undefined)?.counters || {};
        expect(Number(countersAfterApply.bleed || 0)).toBeGreaterThan(0);

        state = applyEffects(state, [
            { type: 'ClearAilmentCounters', target: target.id, ailment: 'bleed', amount: 999, reason: 'test_clear' }
        ], {
            sourceId: state.player.id,
            targetId: target.id
        });

        const afterClear = state.enemies.find(e => e.id === target.id);
        const countersAfterClear = (afterClear?.components?.get('ailments') as { counters?: Record<string, number> } | undefined)?.counters || {};
        expect(Number(countersAfterClear.bleed || 0)).toBe(0);
    });
});
