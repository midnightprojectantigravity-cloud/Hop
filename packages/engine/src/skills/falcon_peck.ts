import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';

/**
 * FALCON_PECK Skill
 * 
 * The Falcon's basic attack. Deals 1 damage to an adjacent enemy.
 * This is the Falcon's version of BASIC_ATTACK.
 */
export const FALCON_PECK: SkillDefinition = {
    id: 'FALCON_PECK',
    name: 'Peck',
    description: 'The falcon pecks an adjacent enemy for 1 damage.',
    slot: 'passive',
    icon: '🦅',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) {
            return { effects, messages, consumesTurn: false };
        }

        // Find entity at target
        const targetActor = getActorAt(state, target);
        if (!targetActor || targetActor.factionId === 'player') {
            return { effects, messages, consumesTurn: false };
        }

        // Validate range
        if (hexDistance(attacker.position, target) > 1) {
            return { effects, messages, consumesTurn: false };
        }

        const combat = calculateCombat({
            attackerId: attacker.id,
            targetId: targetActor.id,
            skillId: 'FALCON_PECK',
            basePower: 1,
            trinity: extractTrinityStats(attacker),
            targetTrinity: extractTrinityStats(targetActor),
            damageClass: 'physical',
            scaling: [{ attribute: 'instinct', coefficient: 0.15 }],
            statusMultipliers: []
        });

        // Apply damage
        effects.push({
            type: 'Damage',
            target: targetActor.id,
            amount: combat.finalPower,
            reason: 'falcon_peck',
            scoreEvent: combat.scoreEvent
        });

        effects.push({
            type: 'Juice',
            effect: 'combat_text',
            target: target,
            text: 'Peck!',
            intensity: 'low'
        });

        messages.push(`Falcon pecked ${targetActor.subtype || 'enemy'}!`);

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        return getNeighbors(origin).filter(n => {
            const actor = getActorAt(state, n);
            return actor && actor.factionId === 'enemy';
        });
    },
    upgrades: {
        TWIN_TALONS: {
            id: 'TWIN_TALONS',
            name: 'Twin Talons',
            description: 'Peck hits 2 adjacent targets instead of 1.',
        },
    },
    scenarios: getSkillScenarios('FALCON_PECK'),
};
