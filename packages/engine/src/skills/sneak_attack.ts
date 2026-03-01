import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors } from '../hex';
import { getEnemyAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { calculateCombat, extractTrinityStats } from '../systems/combat/combat-calculator';

/**
 * SNEAK_ATTACK Skill
 * Melee range. Deals extra damage if stealthCounter > 0.
 */
export const SNEAK_ATTACK: SkillDefinition = {
    id: 'SNEAK_ATTACK',
    name: 'Sneak Attack',
    description: 'Attack an adjacent enemy. Deals massive damage if executed from stealth.',
    slot: 'offensive',
    icon: '🗡️👤',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
    },
    execute: (state: GameState, attacker: Actor, target?: Point) => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const enemy = getEnemyAt(state.enemies, target);
        if (!enemy) return { effects, messages: ['No target!'], consumesTurn: false };

        if (!validateRange(attacker.position, target, 1)) return { effects, messages: ['Out of range!'], consumesTurn: false };

        // Damage Calculation
        const isStealthed = (attacker.stealthCounter || 0) > 0;
        const baseDamage = isStealthed ? 5 : 3;
        const combat = calculateCombat({
            attackerId: attacker.id,
            targetId: enemy.id,
            skillId: 'SNEAK_ATTACK',
            basePower: baseDamage,
            trinity: extractTrinityStats(attacker),
            targetTrinity: extractTrinityStats(enemy),
            damageClass: 'physical',
            scaling: [{ attribute: 'instinct', coefficient: 0.25 }],
            statusMultipliers: []
        });

        effects.push({
            type: 'Damage',
            target: enemy.id,
            amount: combat.finalPower,
            reason: 'sneak_attack',
            source: attacker.position,
            scoreEvent: combat.scoreEvent
        });

        if (isStealthed) {
            effects.push({
                type: 'Juice',
                effect: 'flash',
                target,
                color: '#ff0000',
                metadata: {
                    signature: 'ATK.STRIKE.SHADOW.SNEAK_ATTACK',
                    family: 'attack',
                    primitive: 'strike',
                    phase: 'impact',
                    element: 'shadow',
                    variant: 'sneak_attack',
                    targetRef: { kind: 'target_hex' },
                    skillId: 'SNEAK_ATTACK',
                    flags: { crit: true }
                }
            });
            messages.push("SNEAK ATTACK!");
        } else {
            messages.push("Sneak attack (No stealth bonus).");
        }

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return getNeighbors(origin).filter(n => !!getEnemyAt(state.enemies, n));
    },
    upgrades: {},
    scenarios: getSkillScenarios('SNEAK_ATTACK')
};
