import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getHexLine, hexEquals, hexDirection } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange, validateAxialDirection, hasClearLineToActor } from '../systems/validation';
import { calculateCombat, extractTrinityStats } from '../systems/combat/combat-calculator';

/**
 * ARCHER_SHOT
 * Dedicated enemy ranged line-shot skill (separate from player SPEAR_THROW loop).
 */
export const ARCHER_SHOT: SkillDefinition = {
    id: 'ARCHER_SHOT',
    name: 'Archer Shot',
    description: 'Fire an arrow in a straight line at a hostile target.',
    slot: 'offensive',
    icon: '🏹',
    baseVariables: {
        range: 4,
        cost: 0,
        cooldown: 0,
        damage: 1,
    },
    execute: (state: GameState, shooter: Actor, target?: Point): { effects: AtomicEffect[]; messages: string[]; consumesTurn?: boolean } => {
        const effects: AtomicEffect[] = [];
        const messages: string[] = [];

        if (!target) return { effects, messages, consumesTurn: false };

        if (!validateRange(shooter.position, target, 4)) {
            return { effects, messages: ['Out of range!'], consumesTurn: false };
        }

        const axial = validateAxialDirection(shooter.position, target);
        if (!axial.isAxial) {
            return { effects, messages: ['Target must be axial.'], consumesTurn: false };
        }

        const targetActor = getActorAt(state, target);
        if (!targetActor || targetActor.id === shooter.id) {
            return { effects, messages: ['No target at location.'], consumesTurn: false };
        }
        if (targetActor.factionId === shooter.factionId) {
            return { effects, messages: ['Cannot target ally.'], consumesTurn: false };
        }

        if (!hasClearLineToActor(state, shooter.position, target, targetActor.id, shooter.id)) {
            return { effects, messages: ['No clear line of sight.'], consumesTurn: false };
        }

        const trinity = extractTrinityStats(shooter);
        const combat = calculateCombat({
            attackerId: shooter.id,
            targetId: targetActor.id,
            skillId: 'ARCHER_SHOT',
            basePower: 1,
            trinity,
            targetTrinity: extractTrinityStats(targetActor),
            damageClass: 'physical',
            scaling: [{ attribute: 'instinct', coefficient: 0.2 }],
            statusMultipliers: []
        });

        const linePath = getHexLine(shooter.position, target);
        const intensity: 'low' | 'medium' | 'high' | 'extreme' =
            combat.finalPower >= 4 ? 'high'
                : combat.finalPower >= 2 ? 'medium'
                    : 'low';
        const shotDir = axial.directionIndex >= 0 ? hexDirection(axial.directionIndex) : undefined;

        effects.push({
            type: 'Juice',
            effect: 'aimingLaser',
            target,
            intensity: 'low',
            metadata: {
                signature: 'ATK.SHOOT.PHYSICAL.ARROW',
                family: 'attack',
                primitive: 'shoot',
                phase: 'anticipation',
                element: 'physical',
                variant: 'arrow',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                path: linePath,
                skillId: 'ARCHER_SHOT',
                timing: { durationMs: 70, ttlMs: 90 }
            }
        });

        effects.push({
            type: 'Juice',
            effect: 'spearTrail',
            path: linePath,
            target,
            intensity,
            metadata: {
                signature: 'ATK.SHOOT.PHYSICAL.ARROW',
                family: 'attack',
                primitive: 'shoot',
                phase: 'travel',
                element: 'physical',
                variant: 'arrow',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                skillId: 'ARCHER_SHOT',
                timing: { delayMs: 50, durationMs: 80, ttlMs: 110 }
            }
        });

        effects.push({
            type: 'Juice',
            effect: 'lightImpact',
            target: targetActor.id,
            intensity,
            direction: shotDir,
            metadata: {
                signature: 'ATK.SHOOT.PHYSICAL.ARROW',
                family: 'attack',
                primitive: 'shoot',
                phase: 'impact',
                element: 'physical',
                variant: 'arrow',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                contactRef: { kind: 'contact_world' },
                contactHex: targetActor.position,
                contactFromHex: shooter.position,
                contactToHex: targetActor.position,
                skillId: 'ARCHER_SHOT',
                timing: { delayMs: 95, durationMs: 60, ttlMs: 110 }
            }
        });

        effects.push({
            type: 'Damage',
            target: targetActor.id,
            amount: combat.finalPower,
            reason: 'archer_shot',
            scoreEvent: combat.scoreEvent
        });

        messages.push('Archer shot!');
        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const shooter = getActorAt(state, origin) as Actor | undefined;
        if (!shooter) return [];
        const candidates: Actor[] = [
            state.player,
            ...state.enemies,
            ...(state.companions || [])
        ].filter((a): a is Actor => !!a && a.hp > 0);

        return candidates
            .filter(a =>
                a.id !== shooter.id
                && a.factionId !== shooter.factionId
                && validateRange(origin, a.position, 4)
                && validateAxialDirection(origin, a.position).isAxial
                && hasClearLineToActor(state, origin, a.position, a.id, shooter.id)
            )
            .map(a => a.position)
            .filter((p, idx, arr) => arr.findIndex(other => hexEquals(other, p)) === idx);
    },
    upgrades: {},
    scenarios: getSkillScenarios('ARCHER_SHOT')
};
