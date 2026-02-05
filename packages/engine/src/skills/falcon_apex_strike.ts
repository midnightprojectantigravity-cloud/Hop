import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { hexDistance } from '../hex';
import { getActorAt } from '../helpers';

/**
 * FALCON_APEX_STRIKE Skill
 * 
 * Heavy attack for Predator mode. Deals 40 damage to a target within range 4.
 */
export const FALCON_APEX_STRIKE: SkillDefinition = {
    id: 'FALCON_APEX_STRIKE',
    name: 'Apex Strike',
    description: 'The falcon dives into a target for lethal damage.',
    slot: 'passive',
    icon: '⚡',
    baseVariables: {
        range: 4,
        cost: 0,
        cooldown: 2,
        damage: 40,
    },
    execute: (state: GameState, attacker: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        const targetActor = getActorAt(state, target);
        if (!targetActor) return { effects, messages, consumesTurn: false };

        // Cooldown check is handled by the caller/resolveFalconTurn usually, 
        // but we'll add it here for safety if we use engine.useSkill
        if (attacker.companionState?.apexStrikeCooldown && attacker.companionState.apexStrikeCooldown > 0) {
            return { effects, messages, consumesTurn: false };
        }

        effects.push({
            type: 'Damage',
            target: targetActor.id,
            amount: 40,
            reason: 'apex_strike'
        });

        effects.push({
            type: 'Juice',
            effect: 'impact',
            target: target,
            intensity: 'high'
        });

        effects.push({
            type: 'UpdateCompanionState',
            target: attacker.id,
            apexStrikeCooldown: 2,
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
