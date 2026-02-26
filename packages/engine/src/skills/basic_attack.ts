import type { SkillDefinition, GameState, Actor, AtomicEffect, Point } from '../types';
import { getDirectionFromTo, getNeighbors, hexDirection, hexEquals } from '../hex';
import { getActorAt } from '../helpers';
import { getSkillScenarios } from '../scenarios';
import { validateRange } from '../systems/validation';
import { calculateCombat, extractTrinityStats } from '../systems/combat/combat-calculator';
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

        // Validate melee range
        const range = 1;

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
        if (activeUpgrades.includes('POWER_STRIKE')) baseDamage += 2;
        const heldPosition = hexEquals(attacker.previousPosition || attacker.position, attacker.position);
        if (activeUpgrades.includes('EXTENDED_REACH') && heldPosition) {
            baseDamage += 1;
        }
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

        const netDamage = Math.max(0, damage - (targetActor.temporaryArmor || 0));
        const predictedLethal = (targetActor.hp - netDamage) <= 0;
        const attackDirIdx = getDirectionFromTo(attacker.position, targetActor.position);
        const attackDirVec = attackDirIdx >= 0 ? hexDirection(attackDirIdx) : undefined;
        const strikeIntensity: 'low' | 'medium' | 'high' | 'extreme' =
            predictedLethal ? 'extreme'
                : damage >= 4 ? 'high'
                    : damage >= 2 ? 'medium'
                        : 'low';

        // Four-phase signature sequence for strike readability (migration-safe via Juice metadata).
        effects.push({
            type: 'Juice',
            effect: 'lightImpact',
            target: 'targetActor',
            intensity: 'low',
            metadata: {
                signature: 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK',
                family: 'attack',
                primitive: 'strike',
                phase: 'anticipation',
                element: 'physical',
                variant: 'basic_attack',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                skillId: 'BASIC_ATTACK',
                timing: { delayMs: 0, durationMs: 110, ttlMs: 140 }
            }
        });
        effects.push({
            type: 'Juice',
            effect: 'dashBlur',
            target: targetActor.id,
            path: [attacker.position, targetActor.position],
            intensity: strikeIntensity === 'extreme' ? 'high' : 'medium',
            metadata: {
                signature: 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK',
                family: 'attack',
                primitive: 'strike',
                phase: 'travel',
                element: 'physical',
                variant: 'basic_attack',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                skillId: 'BASIC_ATTACK',
                timing: { delayMs: 110, durationMs: 70, ttlMs: 100 }
            }
        });

        // Emit impact juice before Damage so target anchors still resolve on lethal first hits.
        effects.push({
            type: 'Juice',
            effect: 'heavyImpact',
            target: targetActor.id,
            intensity: strikeIntensity,
            direction: attackDirVec,
            metadata: {
                signature: 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK',
                family: 'attack',
                primitive: 'strike',
                phase: 'impact',
                element: 'physical',
                variant: 'basic_attack',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                ...(attackDirVec ? {
                    contactRef: { kind: 'contact_world' },
                    contactHex: targetActor.position,
                    contactToHex: targetActor.position,
                    contactFromHex: attacker.position
                } : {}),
                skillId: 'BASIC_ATTACK',
                camera: {
                    kick: strikeIntensity === 'extreme'
                        ? 'heavy'
                        : strikeIntensity === 'high'
                            ? 'medium'
                            : 'light',
                    freezeMs: strikeIntensity === 'extreme' ? 80 : 55
                },
                timing: { delayMs: 180, durationMs: 90, ttlMs: 150 },
                flags: {
                    lethal: predictedLethal,
                    ...(strikeIntensity === 'extreme' ? { crit: true } : {})
                }
            }
        });
        // Apply damage
        effects.push({ type: 'Damage', target: 'targetActor', amount: damage, reason: 'basic_attack', scoreEvent: combat.scoreEvent });
        effects.push({
            type: 'Juice',
            effect: 'lightImpact',
            target: targetActor.id,
            intensity: 'low',
            metadata: {
                signature: 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK',
                family: 'attack',
                primitive: 'strike',
                phase: 'aftermath',
                element: 'physical',
                variant: 'basic_attack',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                skillId: 'BASIC_ATTACK',
                timing: { delayMs: 280, durationMs: 130, ttlMs: 170 }
            }
        });

        const attackerName = attacker.type === 'player'
            ? 'You'
            : `${attacker.subtype || 'enemy'}#${attacker.id}`;
        const targetName = targetActor.type === 'player'
            ? 'you'
            : `${targetActor.subtype || 'enemy'}#${targetActor.id}`;
        messages.push(`${attackerName} attacked ${targetName}!`);

        // Vampiric upgrade: heal on kill (TODO: Add Heal effect type when implemented)
        if (activeUpgrades.includes('VAMPIRIC')) {
            if ((targetActor.hp - netDamage) <= 0) {
                const vampiricHeal = 1;
                effects.push({ type: 'Heal', target: attacker.id, amount: vampiricHeal });
                messages.push('Vampiric heal!');
            }
        }

        return { effects, messages, consumesTurn: true };
    },
    getValidTargets: (state: GameState, origin: Point) => {
        const attacker = getActorAt(state, origin);
        if (!attacker) return [];
        const candidates = getNeighbors(origin);
        return candidates.filter(n => {
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
            name: 'Disciplined Stance',
            description: '+1 damage when attacking without moving first.'
        },
        POWER_STRIKE: {
            id: 'POWER_STRIKE',
            name: 'Power Strike',
            description: 'Damage +2'
        },
        VAMPIRIC: {
            id: 'VAMPIRIC',
            name: 'Vampiric',
            description: 'Heal 1 HP on kill'
        },
    },
    scenarios: getSkillScenarios('BASIC_ATTACK')
};
