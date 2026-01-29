import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateAxialDirection, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';

/**
 * MULTI_SHOOT Skill
 * Axial range 4, centered on target.
 * Deals 1 damage to target and neighbors.
 */
export const MULTI_SHOOT: SkillDefinition = {
    id: 'MULTI_SHOOT',
    name: 'Multi-Shoot',
    description: 'A spread of arrows. Axial range 4. Deals damage to target and neighbors.',
    slot: 'offensive',
    icon: '🏹',
    baseVariables: {
        range: 4,
        cost: 1,
        cooldown: 1,
    },
    execute: (_state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const { isAxial } = validateAxialDirection(attacker.position, target);

        if (!validateRange(attacker.position, target, 4) || !isAxial) {
            return { effects, messages: ['Invalid target! Axial range 4 only.'], consumesTurn: false };
        }

        // Damage target and neighbors
        const affected = [target, ...getNeighbors(target)];
        for (const p of affected) {
            effects.push({ type: 'Damage', target: p, amount: 1, reason: 'multi_shoot' });
        }

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#ffff00' });
        messages.push("Multi-Shoot!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return SpatialSystem.getAxialTargets(state, origin, 4);
    },
    upgrades: {},
    scenarios: getSkillScenarios('MULTI_SHOOT')
};
