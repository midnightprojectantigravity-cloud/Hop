import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors } from '../hex';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateAxialDirection, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/SpatialSystem';
import { calculateCombat, extractTrinityStats } from '../systems/combat-calculator';

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
        const trinity = extractTrinityStats(attacker);
        for (const p of affected) {
            const actorAtPoint = getActorAt(_state, p);
            const combat = calculateCombat({
                attackerId: attacker.id,
                targetId: actorAtPoint?.id || pointToKey(p),
                skillId: 'MULTI_SHOOT',
                basePower: 1,
                trinity,
                targetTrinity: actorAtPoint ? extractTrinityStats(actorAtPoint) : undefined,
                damageClass: 'physical',
                scaling: [{ attribute: 'instinct', coefficient: 0.1 }, { attribute: 'mind', coefficient: 0.1 }],
                statusMultipliers: []
            });
            effects.push({ type: 'Damage', target: p, amount: combat.finalPower, reason: 'multi_shoot', scoreEvent: combat.scoreEvent });
        }

        effects.push({
            type: 'Juice',
            effect: 'flash',
            target,
            color: '#ffff00',
            metadata: {
                signature: 'ATK.SHOOT.PHYSICAL.MULTI_SHOOT',
                family: 'attack',
                primitive: 'shoot',
                phase: 'impact',
                element: 'physical',
                variant: 'multi_shoot',
                targetRef: { kind: 'target_hex' },
                skillId: 'MULTI_SHOOT'
            }
        });
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
