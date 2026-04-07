import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getActorAt } from '../helpers';
import { createDamageEffectFromCombat, resolveSkillCombatDamage } from '../systems/combat/combat-effect';

const FALCON_APEX_STRIKE_COMBAT = {
    damageClass: 'physical' as const,
    attackProfile: 'melee' as const,
    trackingSignature: 'melee' as const,
    weights: { instinct: 1 }
};

/**
 * FALCON_APEX_STRIKE Skill
 * 
 * Heavy attack for Predator mode. Deals 40 damage to a target within range 4.
 */
export const FALCON_APEX_STRIKE: SkillDefinition = {
    id: 'FALCON_APEX_STRIKE',
    name: 'Apex Strike',
    description: 'The falcon dives into a target for lethal damage.',
    slot: 'offensive',
    icon: '⚡',
    baseVariables: {
        range: 4,
        cost: 0,
        cooldown: 2,
        damage: 40,
    },
    combat: FALCON_APEX_STRIKE_COMBAT,
    execute: (state: GameState, attacker: Actor, target?: Point, activeUpgrades: string[] = []): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];
        const ownerId = attacker.companionOf;
        const owner = ownerId
            ? (ownerId === state.player.id ? state.player : state.enemies.find(e => e.id === ownerId))
            : undefined;
        const commandUpgrades = owner?.activeSkills?.find(s => s.id === 'FALCON_COMMAND')?.activeUpgrades || [];
        const hasApexPredator = activeUpgrades.includes('APEX_PREDATOR') || commandUpgrades.includes('APEX_PREDATOR');

        if (!target) return { effects, messages, consumesTurn: false };

        const targetActor = getActorAt(state, target);
        if (!targetActor) return { effects, messages, consumesTurn: false };

        // Cooldown check is handled by the caller/resolveFalconTurn usually, 
        // but we'll add it here for safety if we use engine.useSkill
        if (attacker.companionState?.apexStrikeCooldown && attacker.companionState.apexStrikeCooldown > 0) {
            return { effects, messages, consumesTurn: false };
        }

        const combat = resolveSkillCombatDamage({
            attacker,
            target: targetActor,
            skillId: 'FALCON_APEX_STRIKE',
            basePower: 0,
            skillDamageMultiplier: FALCON_APEX_STRIKE.baseVariables.damage ?? 1,
            ...FALCON_APEX_STRIKE_COMBAT,
            statusMultipliers: []
        });

        effects.push(createDamageEffectFromCombat(combat, targetActor.id, 'apex_strike'));

        effects.push({
            type: 'Juice',
            effect: 'impact',
            target: target,
            intensity: 'high',
            metadata: {
                signature: 'ATK.STRIKE.PHYSICAL.FALCON_APEX_STRIKE',
                family: 'attack',
                primitive: 'strike',
                phase: 'impact',
                element: 'physical',
                variant: 'falcon_apex_strike',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_hex' },
                skillId: 'FALCON_APEX_STRIKE',
                camera: { kick: 'medium' }
            }
        });

        effects.push({
            type: 'UpdateCompanionState',
            target: attacker.id,
            apexStrikeCooldown: hasApexPredator ? 1 : 2,
        });

        messages.push(`Falcon executes APEX STRIKE on ${targetActor.subtype || 'enemy'}!`);

        return { effects, messages, consumesTurn: true };
    },
    upgrades: {},
    getValidTargets: (state: GameState, origin: Point) => {
        // Range 4
        const result: Point[] = [];
        // Simplified: return all enemies in range 4
        state.enemies.forEach(e => {
            if (hexDistance(origin, e.position) <= 4) {
                result.push(e.position);
            }
        });
        return result;
    }
};
