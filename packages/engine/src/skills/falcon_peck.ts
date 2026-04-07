import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getNeighbors, hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';

const FALCON_PECK_COMBAT = {
    damageClass: 'physical' as const,
    attackProfile: 'melee' as const,
    trackingSignature: 'melee' as const,
    weights: { instinct: 1 }
};

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
    slot: 'offensive',
    icon: '🦅',
    baseVariables: {
        range: 1,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    combat: FALCON_PECK_COMBAT,
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        const ownerId = attacker.companionOf;
        const owner = ownerId
            ? (ownerId === state.player.id ? state.player : state.enemies.find(e => e.id === ownerId))
            : undefined;
        const commandUpgrades = owner?.activeSkills?.find(s => s.id === 'FALCON_COMMAND')?.activeUpgrades || [];
        const hasTwinTalons = activeUpgrades.includes('TWIN_TALONS')
            || commandUpgrades.includes('TWIN_TALONS')
            || commandUpgrades.includes('FALCON_TWIN_TALONS');

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

        const targetActors = [targetActor];
        if (hasTwinTalons) {
            const extra = getNeighbors(attacker.position)
                .map(p => getActorAt(state, p))
                .filter((a): a is Actor => !!a && a.id !== targetActor.id && a.factionId === 'enemy')[0];
            if (extra) targetActors.push(extra);
        }

        for (const victim of targetActors) {
            const combat = resolveSkillCombatDamage({
                attacker,
                target: victim,
                skillId: 'FALCON_PECK',
                basePower: 0,
                skillDamageMultiplier: FALCON_PECK.baseVariables.damage ?? 1,
                ...FALCON_PECK_COMBAT,
                statusMultipliers: []
            });

            effects.push(createDamageEffectFromCombat(combat, victim.id, 'falcon_peck'));
        }

        effects.push({
            type: 'Juice',
            effect: 'combat_text',
            target: target,
            text: 'Peck!',
            intensity: 'low',
            metadata: {
                signature: 'UI.TEXT.PHYSICAL.FALCON_PECK',
                family: 'ui',
                primitive: 'text',
                phase: 'instant',
                element: 'physical',
                variant: 'falcon_peck',
                targetRef: { kind: 'target_hex' },
                skillId: 'FALCON_PECK',
                textTone: 'damage'
            }
        });

        messages.push(hasTwinTalons && targetActors.length > 1
            ? `Falcon pecked ${targetActors.length} enemies!`
            : `Falcon pecked ${targetActor.subtype || 'enemy'}!`);

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
