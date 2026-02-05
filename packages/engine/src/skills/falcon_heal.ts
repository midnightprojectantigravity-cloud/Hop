import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getActorAt } from '../helpers';

/**
 * FALCON_HEAL Skill
 * 
 * Healing ability for Roost mode. Heals adjacent ally for 1 health.
 */
export const FALCON_HEAL: SkillDefinition = {
    id: 'FALCON_HEAL',
    name: 'Roost Heal',
    description: 'The falcon roosts and restores health to its companion.',
    slot: 'passive',
    icon: '✨',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 1,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const hunter = getActorAt(state, target);
        if (!hunter) return { effects, messages, consumesTurn: false };

        // Cooldown check
        if (attacker.companionState?.healCooldown && attacker.companionState.healCooldown > 0) {
            return { effects, messages, consumesTurn: false };
        }

        effects.push({
            type: 'Heal',
            target: hunter.id,
            amount: 1
        });

        effects.push({
            type: 'Juice',
            effect: 'flash',
            target: hunter.position,
            color: '#00ff88'
        });

        effects.push({
            type: 'UpdateCompanionState',
            target: attacker.id,
            healCooldown: 1,
        });

        messages.push('Falcon roosts. You feel restored.');

        return { effects, messages, consumesTurn: true };
    },
    upgrades: {},
    getValidTargets: (state: GameState, origin: Point) => {
        // Range 1 (adjacent)
        const result: Point[] = [];
        const player = state.player;
        if (hexDistance(origin, player.position) <= 1) {
            result.push(player.position);
        }
        return result;
    }
};
