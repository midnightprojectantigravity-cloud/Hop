import { getDirectionFromTo, hexEquals } from '../../hex';
import type { Actor, Point } from '../../types';
import { applyDamage, applyHeal } from '../entities/actor';
import { appendTaggedMessage } from '../engine-messages';
import type { AtomicEffectHandlerMap } from './types';

const HAZARD_DAMAGE_REASONS = ['lava_sink', 'void_sink', 'hazard_intercept', 'lava_tick', 'fire_damage'] as const;
const FIRE_DAMAGE_REASONS = ['fire_damage', 'lava_sink', 'burning', 'hazard_intercept', 'lava_tick', 'oil_explosion', 'void_sink'] as const;

const hasReason = (reason: string | undefined, list: readonly string[]) => !!reason && list.includes(reason);

const markedPredatorBonus = (victim?: Actor): number =>
    victim?.statusEffects?.some(s => s.type === 'marked_predator') ? 1 : 0;

export const damageEffectHandlers: AtomicEffectHandlerMap = {
    Damage: (state, effect, context, api) => {
        let nextState = { ...state };
        const isHazardReason = hasReason(effect.reason, HAZARD_DAMAGE_REASONS);
        if (isHazardReason) {
            nextState = api.appendTimelineEvent(
                nextState,
                'HAZARD_CHECK',
                'Damage',
                { reason: effect.reason, amount: effect.amount, target: effect.target },
                context,
                true,
                200
            );
        }
        nextState = api.appendTimelineEvent(
            nextState,
            'DAMAGE_APPLY',
            'Damage',
            { reason: effect.reason, amount: effect.amount, target: effect.target, scoreEvent: effect.scoreEvent },
            context,
            true,
            180
        );

        let targetActorId = '';
        let targetPos: Point | null = null;
        let simulationTargetId: string | undefined;
        let simulationPos: Point | undefined;
        let simulationAmount = effect.amount;

        if (typeof effect.target === 'string') {
            if (effect.target === 'targetActor') targetActorId = context.targetId || '';
            else if (effect.target !== 'area') targetActorId = effect.target;
        } else {
            targetPos = effect.target as Point;
        }

        const isFireDamage = hasReason(effect.reason, FIRE_DAMAGE_REASONS);
        const hasEmberWard = nextState.upgrades?.includes('RELIC_EMBER_WARD');
        const hasCinderOrb = nextState.upgrades?.includes('RELIC_CINDER_ORB');

        if (isFireDamage && targetActorId) {
            const victim = targetActorId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetActorId);
            const hasAbsorb = victim?.activeSkills?.some(s => s.id === 'ABSORB_FIRE');
            let adjustedAmount = effect.amount;

            if (targetActorId === nextState.player.id && hasEmberWard) {
                adjustedAmount = Math.max(0, adjustedAmount - 1);
                nextState.message = appendTaggedMessage(nextState.message, 'Ember Ward dampens the flames.', 'INFO', 'COMBAT');
            }

            if (hasAbsorb) {
                const healAmount = adjustedAmount + (targetActorId === nextState.player.id && hasCinderOrb ? 1 : 0);
                if (targetActorId === nextState.player.id && hasCinderOrb) {
                    nextState.message = appendTaggedMessage(nextState.message, 'Cinder Orb amplifies the absorption.', 'INFO', 'COMBAT');
                }
                return api.applyAtomicEffect(nextState, {
                    type: 'Heal',
                    target: targetActorId,
                    amount: healAmount
                });
            }
        }

        if (targetActorId) {
            if (targetActorId === nextState.player.id) {
                const victim = nextState.player;
                const damageClass = effect.scoreEvent?.damageClass || 'physical';
                const traitScaled = api.scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, victim, damageClass, effect.reason);
                let damageAmount = traitScaled.amount;
                damageAmount += markedPredatorBonus(victim);
                if (isFireDamage && hasEmberWard) {
                    damageAmount = Math.max(0, damageAmount - 1);
                }
                if (effect.scoreEvent) {
                    nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), {
                        ...effect.scoreEvent,
                        finalPower: damageAmount,
                        traitOutgoingMultiplier: traitScaled.outgoing,
                        traitIncomingMultiplier: traitScaled.incoming,
                        traitTotalMultiplier: traitScaled.total
                    }].slice(-500);
                }
                nextState.player = applyDamage(nextState.player, damageAmount);
                simulationTargetId = nextState.player.id;
                simulationPos = nextState.player.position;
                simulationAmount = damageAmount;
                if (isFireDamage) {
                    nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                }
                if (isFireDamage && hasCinderOrb) {
                    nextState.player = applyHeal(nextState.player, 1);
                    nextState.message = appendTaggedMessage(nextState.message, 'Cinder Orb restores 1 HP.', 'INFO', 'COMBAT');
                }
            } else {
                const victim = nextState.enemies.find(e => e.id === targetActorId);
                const victimPos = targetActorId === nextState.player.id ? nextState.player.position : victim?.position;
                const corpsePositions: Point[] = [];
                const damageClass = effect.scoreEvent?.damageClass || 'physical';
                const traitScaled = api.scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, victim, damageClass, effect.reason);
                const scaledAmount = traitScaled.amount + markedPredatorBonus(victim);
                simulationTargetId = targetActorId || victim?.id;
                simulationPos = victimPos || victim?.position;
                simulationAmount = scaledAmount;

                const updateDamage = (e: Actor) => {
                    if (e.id === targetActorId) {
                        const updated = applyDamage(e, scaledAmount);
                        if (updated.hp <= 0) {
                            nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                            corpsePositions.push(e.position);
                        }
                        return updated;
                    }
                    return e;
                };
                if (effect.scoreEvent) {
                    nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), {
                        ...effect.scoreEvent,
                        finalPower: scaledAmount,
                        traitOutgoingMultiplier: traitScaled.outgoing,
                        traitIncomingMultiplier: traitScaled.incoming,
                        traitTotalMultiplier: traitScaled.total
                    }].slice(-500);
                }
                nextState.enemies = nextState.enemies.map(updateDamage).filter((e: Actor) => e.hp > 0);
                if (nextState.companions) {
                    nextState.companions = nextState.companions.map(updateDamage).filter((e: Actor) => e.hp > 0);
                }
                if (corpsePositions.length > 0) {
                    nextState = api.appendTimelineEvent(
                        nextState,
                        'DEATH_RESOLVE',
                        'Damage',
                        { targetActorId, reason: effect.reason || 'damage' },
                        { ...context, targetId: targetActorId },
                        true,
                        260
                    );
                }
                corpsePositions.forEach(pos => {
                    nextState = api.addCorpseTraitAt(nextState, pos);
                });

                if (victimPos) {
                    nextState.visualEvents = [...(nextState.visualEvents || []),
                    { type: 'vfx', payload: { type: 'impact', position: victimPos } }
                    ];
                }

                if (targetActorId === nextState.player.id && (nextState.player.stealthCounter || 0) > 0) {
                    nextState.player = { ...nextState.player, stealthCounter: Math.max(0, (nextState.player.stealthCounter || 0) - 1) };
                } else if (targetActorId !== nextState.player.id) {
                    const updateStealth = (e: Actor) => e.id === targetActorId ? { ...e, stealthCounter: Math.max(0, (e.stealthCounter || 0) - 1) } : e;
                    nextState.enemies = nextState.enemies.map(updateStealth);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateStealth);
                    }
                }

                if (targetActorId === nextState.player.id && nextState.player.archetype === 'HUNTER' && (effect as any).source) {
                    const rollDirIdx = getDirectionFromTo((effect as any).source, nextState.player.position);
                    if (rollDirIdx !== -1) {
                        nextState.message = appendTaggedMessage(nextState.message, 'You roll away!', 'INFO', 'COMBAT');
                    }
                }

                if (victim && victim.archetype === 'HUNTER' && (effect as any).source) {
                    const rollDirIdx = getDirectionFromTo((effect as any).source, victim.position);
                    if (rollDirIdx !== -1) {
                        nextState.message = appendTaggedMessage(nextState.message, `${victim.subtype || victim.id} rolls away!`, 'INFO', 'COMBAT');
                    }
                }
            }
        } else if (targetPos) {
            const targetAtPos = api.resolveActorAt(nextState, targetPos);
            const damageClass = effect.scoreEvent?.damageClass || 'physical';
            const traitScaled = api.scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, targetAtPos, damageClass, effect.reason);
            const scaledAmount = traitScaled.amount;
            simulationTargetId = targetAtPos?.id;
            simulationPos = targetPos;
            simulationAmount = scaledAmount + markedPredatorBonus(targetAtPos || undefined);
            nextState.visualEvents = [...(nextState.visualEvents || []),
            { type: 'vfx', payload: { type: 'impact', position: targetPos } }
            ];
            if (effect.scoreEvent && targetAtPos) {
                nextState.combatScoreEvents = [...(nextState.combatScoreEvents || []), {
                    ...effect.scoreEvent,
                    targetId: targetAtPos.id,
                    finalPower: scaledAmount,
                    traitOutgoingMultiplier: traitScaled.outgoing,
                    traitIncomingMultiplier: traitScaled.incoming,
                    traitTotalMultiplier: traitScaled.total
                }].slice(-500);
            }
            if (hexEquals(nextState.player.position, targetPos)) {
                nextState.player = applyDamage(nextState.player, scaledAmount + markedPredatorBonus(nextState.player));
                if (isFireDamage) {
                    nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                }
            }
            const updateDamageAt = (e: Actor) => {
                if (hexEquals(e.position, targetPos)) {
                    const updated = applyDamage(e, scaledAmount + markedPredatorBonus(e));
                    if (updated.hp <= 0) {
                        nextState.dyingEntities = [...(nextState.dyingEntities || []), e];
                        killedAtIds.push(e.id);
                        killedAtPositions.push(e.position);
                    }
                    return updated;
                }
                return e;
            };
            const killedAtPositions: Point[] = [];
            const killedAtIds: string[] = [];
            nextState.enemies = nextState.enemies.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
            if (nextState.companions) {
                nextState.companions = nextState.companions.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
            }
            killedAtIds.forEach(deadId => {
                nextState = api.appendTimelineEvent(
                    nextState,
                    'DEATH_RESOLVE',
                    'Damage',
                    { targetActorId: deadId, reason: effect.reason || 'area_damage' },
                    { ...context, targetId: deadId },
                    true,
                    260
                );
            });
            killedAtPositions.forEach(pos => {
                nextState = api.addCorpseTraitAt(nextState, pos);
            });
        }

        if (simulationAmount > 0) {
            nextState = api.appendSimulationEvent(nextState, {
                type: 'DamageTaken',
                targetId: simulationTargetId || targetActorId || undefined,
                position: simulationPos,
                payload: {
                    amount: simulationAmount,
                    reason: effect.reason,
                    sourceId: context.sourceId
                }
            });
        }

        return nextState;
    }
};
