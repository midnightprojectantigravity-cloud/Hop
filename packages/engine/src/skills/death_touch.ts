import type { Actor, AtomicEffect, GameState, Point, SkillDefinition } from '../types';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';
import { extractTrinityStats } from '../systems/combat/combat-calculator';
import { getNeighbors, hexEquals } from '../hex';
import { getActorAt } from '../helpers';

/**
 * Death Touch
 * A short-range magical strike that carries death element damage.
 */
export const DEATH_TOUCH: SkillDefinition = {
    id: 'DEATH_TOUCH',
    name: 'Death Touch',
    description: 'Touch a target and deal death elemental damage. Range 1.',
    slot: 'offensive',
    icon: '☠️',
    baseVariables: {
        range: 1,
        cost: 1,
        cooldown: 1,
        basePower: 20,
        damage: 40
    },
    metabolicBandProfile: {
        bandId: 'heavy',
        resourceMode: 'mana_only',
        countsAsMovement: false,
        countsAsAction: true,
        travelEligible: false,
        manaCostOffset: -1,
        baseStrainOffset: -3,
        scopeTags: ['player_default']
    },
    combat: {
        damageClass: 'magical',
        damageSubClass: 'touch',
        damageElement: 'death',
        attackProfile: 'spell',
        trackingSignature: 'melee',
        weights: { mind: 1 }
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) {
            messages.push('Select a target!');
            return { effects, messages, consumesTurn: false };
        }

        if (!getNeighbors(attacker.position).some(p => hexEquals(p, target))) {
            messages.push('Target out of range!');
            return { effects, messages, consumesTurn: false };
        }

        const targetActor = getActorAt(state, target);
        if (!targetActor || targetActor.id === attacker.id) {
            messages.push('No enemy at target!');
            return { effects, messages, consumesTurn: false };
        }

        if (targetActor.factionId === attacker.factionId) {
            messages.push('Cannot target friendlies!');
            return { effects, messages, consumesTurn: false };
        }

        const combat = resolveSkillCombatDamage({
            attacker,
            target: targetActor,
            skillId: 'DEATH_TOUCH',
            basePower: DEATH_TOUCH.baseVariables.basePower ?? 0,
            skillDamageMultiplier: DEATH_TOUCH.baseVariables.damage ?? 1,
            ...DEATH_TOUCH.combat,
            engagementContext: { distance: 1 },
            statusMultipliers: [],
            theoreticalMaxPower: (DEATH_TOUCH.baseVariables.basePower ?? 0) + (DEATH_TOUCH.baseVariables.damage ?? 1) * Math.max(0, extractTrinityStats(attacker).mind || 0)
        });

        effects.push(createDamageEffectFromCombat(combat, targetActor.id, 'death_touch'));
        messages.push('Death Touch!');

        return {
            effects,
            messages,
            consumesTurn: true
        };
    },
    getValidTargets: (state: GameState, origin: Point) => getNeighbors(origin).filter(p => {
        const targetActor = getActorAt(state, p);
        return !!targetActor && targetActor.factionId !== getActorAt(state, origin)?.factionId;
    }),
    upgrades: {}
};
