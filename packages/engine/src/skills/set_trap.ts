import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors } from '../hex';
import { getSkillScenarios } from '../scenarios';
import { isBlockedByWall, isBlockedByLava } from '../systems/validation';

/**
 * SET_TRAP Skill
 * Place a trap on a target tile.
 */
export const SET_TRAP: SkillDefinition = {
    id: 'SET_TRAP',
    name: 'Set Trap',
    description: 'Place a hidden trap. Roots units for 3 turns.',
    slot: 'utility',
    icon: '🪤',
    baseVariables: {
        range: 1,
        cost: 1,
        cooldown: 2,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (isBlockedByWall(state, target) || isBlockedByLava(state, target)) {
            return { effects, messages: ['Cannot place trap here!'], consumesTurn: false };
        }

        effects.push({ type: 'PlaceTrap', position: target, ownerId: attacker.id });
        effects.push({
            type: 'Juice',
            effect: 'combat_text',
            target,
            text: 'Trapped',
            metadata: {
                signature: 'UI.TEXT.NEUTRAL.SET_TRAP',
                family: 'ui',
                primitive: 'text',
                phase: 'instant',
                element: 'neutral',
                variant: 'set_trap',
                targetRef: { kind: 'target_hex' },
                skillId: 'SET_TRAP',
                textTone: 'status'
            }
        });

        messages.push("Trap set.");

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return getNeighbors(origin).filter(n => !isBlockedByWall(state, n) && !isBlockedByLava(state, n));
    },
    upgrades: {},
    scenarios: getSkillScenarios('SET_TRAP')
};
