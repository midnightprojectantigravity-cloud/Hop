import { getDirectionFromTo, hexEquals } from '../../hex';
import type { Actor, Point } from '../../types';
import { applyDamage, applyHeal } from '../entities/actor';
import { appendTaggedMessage } from '../engine-messages';
import { buildDamageBreakReleaseEffects } from '../movement/attachment-system';
import { buildBombDetonationEffects, hasVolatilePayload, isBombActor } from './bomb-runtime';
import { depositAilmentCounters, getActorAilmentCounters } from '../ailments/runtime';
import type { AtomicEffectHandlerMap } from './types';
import { addDyingEntityOnce, shouldLeaveCorpse } from './corpse-utils';
import { isAbsorbableFireDamage, resolveAbsorbFireHealAmount } from './fire-absorb';

const HAZARD_DAMAGE_REASONS = ['lava_sink', 'void_sink', 'hazard_intercept', 'lava_tick', 'fire_damage'] as const;

const hasReason = (reason: string | undefined, list: readonly string[]) => !!reason && list.includes(reason);
const resolveDamageElement = (effect: { damageElement?: string; scoreEvent?: { damageElement?: string } }): string | undefined =>
    effect.damageElement || effect.scoreEvent?.damageElement;

const applyIceAnnihilation = (
    state: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[0],
    targetId: string,
    burnAmount: number,
    freezeAmount: number,
    context: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[2],
    source: 'skill' | 'tile' | 'system'
): Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[0] => {
    const burnDeposit = Math.max(1, Math.floor(burnAmount));
    const freezeDeposit = Math.max(1, Math.floor(freezeAmount));
    let nextState = depositAilmentCounters(state, targetId, 'wet', burnDeposit, context, source);
    nextState = depositAilmentCounters(nextState, targetId, 'frozen', freezeDeposit, context, source);
    return nextState;
};

const markedPredatorBonus = (victim?: Actor): number =>
    victim?.statusEffects?.some(s => s.type === 'marked_predator') ? 1 : 0;

const triggerVolatileBombDetonation = (
    state: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[0],
    bomb: Actor,
    context: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[2],
    api: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[3]
) => api.applyEffects(
    state,
    buildBombDetonationEffects(bomb),
    {
        ...context,
        sourceId: context.sourceId || bomb.id,
        volatileBombVisited: [...(context.volatileBombVisited || []), bomb.id]
    }
);

const applyLeechRecovery = (
    state: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[0],
    sourceId: string | undefined,
    victimHpBefore: number,
    damageAmount: number,
    leechRatio: number | undefined,
    api: Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[3]
): Parameters<NonNullable<AtomicEffectHandlerMap['Damage']>>[0] => {
    if (!sourceId) return state;
    const ratio = Number(leechRatio || 0);
    if (!Number.isFinite(ratio) || ratio <= 0) return state;
    const healAmount = Math.max(0, Math.floor(Math.min(damageAmount, victimHpBefore) * ratio));
    if (healAmount <= 0) return state;
    return api.applyAtomicEffect(state, {
        type: 'Heal',
        target: sourceId,
        amount: healAmount
    });
};

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
        const damagedActorIds = new Set<string>();

        if (typeof effect.target === 'string') {
            if (effect.target === 'targetActor') targetActorId = context.targetId || '';
            else if (effect.target !== 'area') targetActorId = effect.target;
        } else {
            targetPos = effect.target as Point;
        }

        const damageElement = resolveDamageElement(effect);
        const isFireDamage = isAbsorbableFireDamage(damageElement);
        const hasEmberWard = nextState.upgrades?.includes('RELIC_EMBER_WARD');
        const hasCinderOrb = nextState.upgrades?.includes('RELIC_CINDER_ORB');

        if (targetActorId) {
            if (targetActorId === nextState.player.id) {
                const victim = nextState.player;
                const damageClass = effect.damageClass || effect.scoreEvent?.damageClass || 'physical';
                const traitScaled = api.scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, victim, damageClass, effect.reason);
                let damageAmount = traitScaled.amount;
                const victimHpBefore = victim.hp;
                damageAmount += markedPredatorBonus(victim);
                if (isFireDamage && hasEmberWard) {
                    damageAmount = Math.max(0, damageAmount - 1);
                }
                if (isFireDamage && victim.activeSkills?.some(s => s.id === 'ABSORB_FIRE')) {
                    const healAmount = resolveAbsorbFireHealAmount(damageAmount, hasCinderOrb ? 1 : 0);
                    if (hasCinderOrb) {
                        nextState.message = appendTaggedMessage(nextState.message, 'Cinder Orb amplifies the absorption.', 'INFO', 'COMBAT');
                    }
                    return api.applyAtomicEffect(nextState, {
                        type: 'Heal',
                        target: targetActorId,
                        amount: healAmount
                    });
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
                if (damageElement === 'ice' && damageAmount > 0) {
                    const burnCount = Math.max(0, getActorAilmentCounters(nextState.player).burn || 0);
                    if (victim?.id === nextState.player.id) {
                        if (burnCount > 0) {
                            nextState = applyIceAnnihilation(nextState, nextState.player.id, burnCount, damageAmount, context, 'skill');
                        }
                    } else if (victim && Math.max(0, getActorAilmentCounters(victim).burn || 0) > 0) {
                        nextState = applyIceAnnihilation(nextState, victim.id, Math.max(0, getActorAilmentCounters(victim).burn || 0), damageAmount, context, 'skill');
                    }
                }
                nextState.player = applyDamage(nextState.player, damageAmount);
                simulationTargetId = nextState.player.id;
                simulationPos = nextState.player.position;
                simulationAmount = damageAmount;
                nextState = applyLeechRecovery(nextState, context.sourceId, victimHpBefore, damageAmount, effect.leechRatio, api);
                if (damageAmount > 0) {
                    damagedActorIds.add(nextState.player.id);
                    nextState.runTelemetry = {
                        ...(nextState.runTelemetry || {
                            damageTaken: 0,
                            healingReceived: 0,
                            forcedDisplacementsTaken: 0,
                            controlIncidents: 0,
                            hazardDamageEvents: 0
                        }),
                        damageTaken: (nextState.runTelemetry?.damageTaken || 0) + damageAmount,
                        healingReceived: nextState.runTelemetry?.healingReceived || 0,
                        forcedDisplacementsTaken: nextState.runTelemetry?.forcedDisplacementsTaken || 0,
                        controlIncidents: nextState.runTelemetry?.controlIncidents || 0,
                        hazardDamageEvents: (nextState.runTelemetry?.hazardDamageEvents || 0) + (isHazardReason ? 1 : 0)
                    };
                }
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
                const deadVictims: Actor[] = [];
                const damageClass = effect.damageClass || effect.scoreEvent?.damageClass || 'physical';
                const traitScaled = api.scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, victim, damageClass, effect.reason);
                const scaledAmount = traitScaled.amount + markedPredatorBonus(victim);
                const victimHpBefore = victim?.hp || 0;
                if (isFireDamage && victim?.activeSkills?.some(s => s.id === 'ABSORB_FIRE')) {
                    const healAmount = resolveAbsorbFireHealAmount(scaledAmount, 0);
                    return api.applyAtomicEffect(nextState, {
                        type: 'Heal',
                        target: targetActorId,
                        amount: healAmount
                    });
                }
                if (damageElement === 'ice' && victim && Math.max(0, getActorAilmentCounters(victim).burn || 0) > 0) {
                    nextState = applyIceAnnihilation(nextState, victim.id, Math.max(0, getActorAilmentCounters(victim).burn || 0), scaledAmount, context, 'skill');
                }
                if (
                    victim
                    && isBombActor(victim)
                    && hasVolatilePayload(victim)
                    && scaledAmount > 0
                    && !(context.volatileBombVisited || []).includes(victim.id)
                ) {
                    return triggerVolatileBombDetonation(nextState, victim, context, api);
                }
                simulationTargetId = targetActorId || victim?.id;
                simulationPos = victimPos || victim?.position;
                simulationAmount = scaledAmount;
                if (scaledAmount > 0 && targetActorId) damagedActorIds.add(targetActorId);

                const updateDamage = (e: Actor) => {
                    if (e.id === targetActorId) {
                        const updated = applyDamage(e, scaledAmount);
                        if (updated.hp <= 0) {
                            deadVictims.push(e);
                            if (shouldLeaveCorpse(e)) {
                                corpsePositions.push(e.position);
                            }
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
                deadVictims.forEach(deadVictim => {
                    nextState = addDyingEntityOnce(nextState, deadVictim);
                });
                nextState = applyLeechRecovery(nextState, context.sourceId, victimHpBefore, scaledAmount, effect.leechRatio, api);
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
            const damageClass = effect.damageClass || effect.scoreEvent?.damageClass || 'physical';
            const traitScaled = api.scaleCombatProfileDamage(nextState, effect.amount, context.sourceId, targetAtPos, damageClass, effect.reason);
            const scaledAmount = traitScaled.amount;
            if (isFireDamage && targetAtPos?.activeSkills?.some(s => s.id === 'ABSORB_FIRE')) {
                const healAmount = resolveAbsorbFireHealAmount(scaledAmount, 0);
                return api.applyAtomicEffect(nextState, {
                    type: 'Heal',
                    target: targetAtPos.id,
                    amount: healAmount
                });
            }
            if (resolveDamageElement(effect) === 'ice' && targetAtPos && Math.max(0, getActorAilmentCounters(targetAtPos).burn || 0) > 0) {
                nextState = applyIceAnnihilation(nextState, targetAtPos.id, Math.max(0, getActorAilmentCounters(targetAtPos).burn || 0), scaledAmount, context, 'skill');
            }
            if (
                targetAtPos
                && isBombActor(targetAtPos)
                && hasVolatilePayload(targetAtPos)
                && (scaledAmount + markedPredatorBonus(targetAtPos)) > 0
                && !(context.volatileBombVisited || []).includes(targetAtPos.id)
            ) {
                return triggerVolatileBombDetonation(nextState, targetAtPos, context, api);
            }
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
                const playerDamage = scaledAmount + markedPredatorBonus(nextState.player);
                const victimHpBefore = nextState.player.hp;
                nextState.player = applyDamage(nextState.player, playerDamage);
                if (playerDamage > 0) {
                    damagedActorIds.add(nextState.player.id);
                    nextState.runTelemetry = {
                        ...(nextState.runTelemetry || {
                            damageTaken: 0,
                            healingReceived: 0,
                            forcedDisplacementsTaken: 0,
                            controlIncidents: 0,
                            hazardDamageEvents: 0
                        }),
                        damageTaken: (nextState.runTelemetry?.damageTaken || 0) + playerDamage,
                        healingReceived: nextState.runTelemetry?.healingReceived || 0,
                        forcedDisplacementsTaken: nextState.runTelemetry?.forcedDisplacementsTaken || 0,
                        controlIncidents: nextState.runTelemetry?.controlIncidents || 0,
                        hazardDamageEvents: (nextState.runTelemetry?.hazardDamageEvents || 0) + (isHazardReason ? 1 : 0)
                    };
                }
                if (isFireDamage) {
                    nextState.hazardBreaches = (nextState.hazardBreaches || 0) + 1;
                }
                nextState = applyLeechRecovery(nextState, context.sourceId, victimHpBefore, playerDamage, effect.leechRatio, api);
            }
            const deadVictimsAtPos: Actor[] = [];
            const leechRecoveriesAtPos: Array<{ victimHpBefore: number; damageAmount: number }> = [];
            const killedAtPositions: Point[] = [];
            const killedAtIds: string[] = [];
            const updateDamageAt = (e: Actor) => {
                if (hexEquals(e.position, targetPos)) {
                    const enemyDamage = scaledAmount + markedPredatorBonus(e);
                    const victimHpBefore = e.hp;
                    const updated = applyDamage(e, enemyDamage);
                    if (enemyDamage > 0) damagedActorIds.add(e.id);
                    if (updated.hp <= 0) {
                        deadVictimsAtPos.push(e);
                        killedAtIds.push(e.id);
                        if (shouldLeaveCorpse(e)) {
                            killedAtPositions.push(e.position);
                        }
                    }
                    leechRecoveriesAtPos.push({ victimHpBefore, damageAmount: enemyDamage });
                    return updated;
                }
                return e;
            };
            nextState.enemies = nextState.enemies.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
            if (nextState.companions) {
                nextState.companions = nextState.companions.map(updateDamageAt).filter((e: Actor) => e.hp > 0);
            }
            deadVictimsAtPos.forEach(deadVictim => {
                nextState = addDyingEntityOnce(nextState, deadVictim);
            });
            leechRecoveriesAtPos.forEach(({ victimHpBefore, damageAmount }) => {
                nextState = applyLeechRecovery(nextState, context.sourceId, victimHpBefore, damageAmount, effect.leechRatio, api);
            });
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

        for (const damagedActorId of damagedActorIds) {
            const releaseEffects = buildDamageBreakReleaseEffects(nextState, damagedActorId);
            if (releaseEffects.length === 0) continue;
            nextState = api.applyEffects(nextState, releaseEffects, {
                ...context,
                targetId: damagedActorId,
                attachmentVisited: [damagedActorId]
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
