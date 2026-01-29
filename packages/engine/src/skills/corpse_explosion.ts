import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance, getNeighbors, hexEquals } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';

/**
 * CORPSE_EXPLOSION Skill
 * Detonate a corpse for AoE damage.
 */
export const CORPSE_EXPLOSION: SkillDefinition = {
    id: 'CORPSE_EXPLOSION',
    name: 'Corpse Explosion',
    description: 'Detonate a target corpse, dealing damage in a 1-tile radius.',
    slot: 'offensive',
    icon: '🧨💀',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const corpses = state.dyingEntities || [];
        const hasCorpse = corpses.some(cp => hexEquals(cp.position, target));
        if (!hasCorpse) {
            return { effects, messages: ['A corpse is required!'], consumesTurn: false };
        }

        if (!validateRange(attacker.position, target, 4)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        // 1. Remove the corpse
        effects.push({ type: 'RemoveCorpse', position: target });

        // 2. Damage AoE
        const affected = [target, ...getNeighbors(target)];
        for (const p of affected) {
            effects.push({ type: 'Damage', target: p, amount: 2, reason: 'corpse_explosion' });
        }

        effects.push({ type: 'Juice', effect: 'explosion_ring', target });
        effects.push({ type: 'Juice', effect: 'shake', intensity: 'high' });
        effects.push({ type: 'Juice', effect: 'combat_text', target, text: 'BOOM!' });

        messages.push("Corpse exploded!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return (state.dyingEntities || []).filter(cp => hexDistance(origin, cp.position) <= 4).map(e => e.position);
    },
    upgrades: {},
    scenarios: getSkillScenarios('CORPSE_EXPLOSION')
};
