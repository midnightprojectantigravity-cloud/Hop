import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';
import { isStunned } from '../systems/status';

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

        const stunnedThisStep = (state.timelineEvents || []).some(ev =>
            ev.phase === 'STATUS_APPLY'
            && ev.type === 'ApplyStatus'
            && ev.payload?.status === 'stunned'
            && (
                ev.payload?.target === attacker.id
                || (
                    typeof ev.payload?.target === 'object'
                    && ev.payload?.target
                    && hexEquals(ev.payload.target as Point, attacker.position)
                )
            )
        );

        if (isStunned(attacker) || stunnedThisStep) {
            messages.push('Cannot attack while stunned!');
            return { effects, messages, consumesTurn: true };
        }

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

        // Faction check: Cannot attack friendlies
        if (targetActor.factionId === attacker.factionId) {
            messages.push('Cannot attack friendlies!');
            return { effects, messages, consumesTurn: false };
        }

        if (targetActor.subtype === 'bomb') {
            messages.push('Cannot attack a bomb!');
            return { effects, messages, consumesTurn: false };
        }

        // Calculate damage through the centralized combat calculator.
        let baseDamage = 1;
        if (activeUpgrades.includes('POWER_STRIKE')) baseDamage += 1;
        const combat = calculateCombat({
            attackerId: attacker.id,
            targetId: targetActor.id,
            skillId: 'BASIC_ATTACK',
            basePower: baseDamage,
            trinity: extractTrinityStats(attacker),
            targetTrinity: extractTrinityStats(targetActor),
            damageClass: 'physical',
            scaling: [{ attribute: 'body', coefficient: 0.5 }],
            statusMultipliers: [],
            inDangerPreviewHex: !!state.intentPreview?.dangerTiles?.some(p => hexEquals(p, attacker.position)),
            theoreticalMaxPower: baseDamage
        });
        const damage = combat.finalPower;

        // Apply damage
        effects.push({ type: 'Damage', target: 'targetActor', amount: damage, scoreEvent: combat.scoreEvent });
        const attackerName = attacker.type === 'player'
            ? 'You'
            : `${attacker.subtype || 'enemy'}#${attacker.id}`;
        const targetName = targetActor.type === 'player'
            ? 'you'
            : `${targetActor.subtype || 'enemy'}#${targetActor.id}`;
        messages.push(`${attackerName} attacked ${targetName}!`);

        // Vampiric upgrade: heal on kill (TODO: Add Heal effect type when implemented)
        if (activeUpgrades.includes('VAMPIRIC') && targetActor.hp <= damage) {
            messages.push('Vampiric heal!');
        }

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const attacker = getActorAt(state, origin);
        if (!attacker) return [];
        return getNeighbors(origin).filter(n => {
            const actor = getActorAt(state, n);
            return !!actor
                && actor.subtype !== 'bomb'
                && actor.id !== attacker.id
                && actor.factionId !== attacker.factionId;
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
