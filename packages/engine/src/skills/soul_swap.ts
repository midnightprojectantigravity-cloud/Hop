import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';

/**
 * SOUL_SWAP Skill
 * Swap positions with a player-aligned minion.
 */
export const SOUL_SWAP: SkillDefinition = {
    id: 'SOUL_SWAP',
    name: 'Soul Swap',
    description: 'Instantly swap positions with a player-aligned minion.',
    slot: 'utility',
    icon: '🔁👻',
    baseVariables: {
        range: 6,
        cost: 0,
        cooldown: 3,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (!validateRange(attacker.position, target, 6)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        const minion = getActorAt(state, target);
        if (!minion || minion.factionId !== 'player' || minion.id === attacker.id) {
            return { effects, messages: ['Target must be a minion!'], consumesTurn: false };
        }

        // SWAP!
        effects.push({ type: 'Displacement', target: attacker.id, destination: target });
        effects.push({ type: 'Displacement', target: minion.id, destination: attacker.position });

        effects.push({
            type: 'Juice',
            effect: 'flash',
            target,
            color: '#330066',
            metadata: {
                signature: 'MOVE.BLINK.ARCANE.SOUL_SWAP_ARRIVE',
                family: 'movement',
                primitive: 'blink',
                phase: 'instant',
                element: 'arcane',
                variant: 'soul_swap_arrival',
                targetRef: { kind: 'target_hex' },
                skillId: 'SOUL_SWAP'
            }
        });
        effects.push({
            type: 'Juice',
            effect: 'flash',
            target: attacker.position,
            color: '#330066',
            metadata: {
                signature: 'MOVE.BLINK.ARCANE.SOUL_SWAP_DEPART',
                family: 'movement',
                primitive: 'blink',
                phase: 'instant',
                element: 'arcane',
                variant: 'soul_swap_departure',
                targetRef: { kind: 'target_hex' },
                skillId: 'SOUL_SWAP'
            }
        });

        messages.push("Soul Swapped!");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        // Find all player-aligned enemies (minions) in range
        return state.enemies
            .filter(e => e.factionId === 'player' && validateRange(origin, e.position, 6))
            .map(e => e.position);
    },
    upgrades: {},
    scenarios: getSkillScenarios('SOUL_SWAP')
};
