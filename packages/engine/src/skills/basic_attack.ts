import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';

/**
 * Basic Attack - A targeted melee attack skill.
 * Triggers by clicking on a neighboring hex occupied by an enemy.
 * Can be attached to any entity (player or enemy).
 */
export const BASIC_ATTACK: SkillDefinition = {
    id: 'BASIC_ATTACK',
    name: 'Basic Attack',
    description: 'Strike an adjacent enemy for 1 damage.',
    // Basic attack is a passive/melee interaction (punch) and should not occupy the offensive slot
    slot: 'passive',
    icon: '⚔️',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) {
            messages.push('Select a target!');
            return { effects, messages, consumesTurn: false };
        }

        // Validate range
        let range = 1;
        if (activeUpgrades.includes('EXTENDED_REACH')) range += 1;

        if (!validateRange(attacker.position, target, range)) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        // Find entity at target
        const targetActor = getActorAt(state, target);
        if (!targetActor || targetActor.id === attacker.id) {
            messages.push('No enemy at target!');
            return { effects, messages, consumesTurn: false };
        }

        if (targetActor.subtype === 'bomb') {
            messages.push('Cannot attack a bomb!');
            return { effects, messages, consumesTurn: false };
        }

        // Calculate damage
        let damage = 1;
        if (activeUpgrades.includes('POWER_STRIKE')) damage += 1;

        // Apply damage
        effects.push({ type: 'Damage', target: 'targetActor', amount: damage });
        const attackerName = attacker.type === 'player' ? 'You' : (attacker.subtype || 'Enemy');
        const targetName = targetActor.type === 'player' ? 'you' : (targetActor.subtype || 'enemy');
        messages.push(`${attackerName} attacked ${targetName}!`);

        // Vampiric upgrade: heal on kill (TODO: Add Heal effect type when implemented)
        if (activeUpgrades.includes('VAMPIRIC') && targetActor.hp <= damage) {
            messages.push('Vampiric heal!');
        }

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return getNeighbors(origin).filter(n => {
            const actor = getActorAt(state, n);
            return actor && actor.id !== state.player.id && actor.subtype !== 'bomb';
        });
    },
    upgrades: {
        EXTENDED_REACH: {
            id: 'EXTENDED_REACH',
            name: 'Extended Reach',
            description: 'Attack range +1'
        },
        POWER_STRIKE: {
            id: 'POWER_STRIKE',
            name: 'Power Strike',
            description: 'Damage +1'
        },
        VAMPIRIC: {
            id: 'VAMPIRIC',
            name: 'Vampiric',
            description: 'Heal 1 HP on kill'
        },
    },
    scenarios: getSkillScenarios('BASIC_ATTACK')
};
