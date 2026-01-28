import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { validateAxialDirection, validateRange } from '../systems/validation';
import { getAxialTargetsWithOptions } from '../systems/navigation';



/**
 * FIREBALL Skill
 * Range 3, Axial Only.
 * Deals 1 damage to target and neighbors.
 * Leaves fire at target.
 */
export const FIREBALL: SkillDefinition = {
    id: 'FIREBALL',
    name: 'Fireball',
    description: 'Launch a sphere of flame. Range 3, Axial. Deals damage and leaves fire.',
    slot: 'offensive',
    icon: '🔥',
    baseVariables: {
        range: 3,
        cost: 1,
        cooldown: 2,
    },
    execute: (_state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const { isAxial } = validateAxialDirection(attacker.position, target);

        if (!validateRange(attacker.position, target, 3) || !isAxial) {
            return { effects, messages: ['Invalid target! Range 3, Axial only.'], consumesTurn: false };
        }

        // Damage target and neighbors
        const affected = [target, ...getNeighbors(target)];
        for (const p of affected) {
            effects.push({ type: 'Damage', target: p, amount: 1, reason: 'fireball' });
            effects.push({ type: 'PlaceFire', position: p, duration: 3 });
        }

        effects.push({ type: 'Juice', effect: 'flash', target, color: '#ff4400' });
        effects.push({ type: 'Juice', effect: 'shake', intensity: 'medium' });

        messages.push("Fireball!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return getAxialTargetsWithOptions(state, origin, 3);
    },
    upgrades: {},
    scenarios: getSkillScenarios('FIREBALL')
};
