import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { getAilmentDefinition } from '../data/ailments';
import { gainAilmentResilienceXp } from '../systems/ailments/hardening';

describe('ACAE hardening growth', () => {
    it('grows resistance per run and respects cap', () => {
        const state = generateInitialState(1, 'acae-hardening-seed');
        const burn = getAilmentDefinition('burn');
        expect(burn).toBeDefined();
        if (!burn) return;

        const components = new Map(state.player.components || []);
        components.set('ailment_profile', {
            type: 'ailment_profile',
            baseResistancePct: { burn: 0 },
            resistanceGrowthRate: 1.5
        });
        let actor: typeof state.player = {
            ...state.player,
            components
        };

        for (let i = 0; i < 120; i++) {
            actor = gainAilmentResilienceXp(actor, 'burn', 10, burn).actor;
        }

        const resilience = actor.components?.get('ailment_resilience') as { resistancePct?: Record<string, number> } | undefined;
        const burnPct = Number(resilience?.resistancePct?.burn || 0);
        expect(burnPct).toBeLessThanOrEqual(burn.hardening.capPct);
        expect(burnPct).toBeGreaterThan(0);
    });
});
