import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance } from '../hex';
import { pointToKey } from '../hex';
import { getActorAt } from '../helpers';
import { validateAxialDirection, validateRange } from '../systems/validation';
import { SpatialSystem } from '../systems/spatial-system';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';

const MULTI_SHOOT_COMBAT = {
    damageClass: 'physical' as const,
    attackProfile: 'projectile' as const,
    trackingSignature: 'projectile' as const,
    weights: { instinct: 1, mind: 1 }
};

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
        damage: 1,
    },
    combat: {
        damageClass: 'physical',
        attackProfile: 'projectile',
        trackingSignature: 'projectile',
        weights: { instinct: 1, mind: 1 }
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
            const actorAtPoint = getActorAt(_state, p);
            const combat = resolveSkillCombatDamage({
                attacker,
                target: actorAtPoint || ({ ...attacker, id: pointToKey(p), position: p, hp: 0, maxHp: 0 } as Actor),
                skillId: 'MULTI_SHOOT',
                basePower: 0,
                skillDamageMultiplier: MULTI_SHOOT.baseVariables.damage ?? 1,
                engagementContext: { distance: hexDistance(attacker.position, p) },
                ...MULTI_SHOOT_COMBAT,
                statusMultipliers: []
            });
            effects.push(createDamageEffectFromCombat(combat, p, 'multi_shoot'));
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
};
