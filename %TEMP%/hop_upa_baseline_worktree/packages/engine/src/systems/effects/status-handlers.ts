import type { Actor, Point } from '../../types';
import { addStatus } from '../entities/actor';
import { computeStatusDuration, extractTrinityStats } from '../combat/combat-calculator';
import { appendTaggedMessage } from '../engine-messages';
import type { AtomicEffectHandlerMap } from './types';

export const statusEffectHandlers: AtomicEffectHandlerMap = {
    Heal: (state, effect, context, api) => {
        let nextState = { ...state };
        const healActor = (actor: Actor): Actor => ({ ...actor, hp: Math.min(actor.maxHp, actor.hp + effect.amount) });
        const targetId = effect.target === 'targetActor' ? context.targetId : effect.target;
        let healedTargetId: string | undefined;
        let healedPos: Point | undefined;

        if (targetId) {
            const victim = targetId === nextState.player.id
                ? nextState.player
                : (nextState.enemies.find(e => e.id === targetId) || nextState.companions?.find(e => e.id === targetId));
            if (victim) {
                const name = targetId === nextState.player.id ? 'You' : (victim.subtype || victim.id);
                nextState.message = appendTaggedMessage(nextState.message, `${name} recover ${effect.amount} HP.`, 'INFO', 'COMBAT');

                if (targetId === nextState.player.id) {
                    nextState.player = healActor(nextState.player);
                    healedTargetId = nextState.player.id;
                    healedPos = nextState.player.position;
                } else {
                    const updateHeal = (e: Actor) => e.id === targetId ? healActor(e) : e;
                    nextState.enemies = nextState.enemies.map(updateHeal);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateHeal);
                    }
                    healedTargetId = victim.id;
                    healedPos = victim.position;
                }
            }
        }
        if (healedTargetId) {
            nextState = api.appendSimulationEvent(nextState, {
                type: 'Healed',
                targetId: healedTargetId,
                position: healedPos,
                payload: { amount: effect.amount, sourceId: context.sourceId }
            });
        }
        return nextState;
    },
    ApplyStatus: (state, effect, context, api) => {
        let nextState = { ...state };
        nextState = api.appendTimelineEvent(
            nextState,
            'STATUS_APPLY',
            'ApplyStatus',
            { status: effect.status, duration: effect.duration, target: effect.target },
            context,
            true,
            160
        );

        let targetActorId = '';
        let targetPos: Point | null = null;
        if (typeof effect.target === 'string') {
            if (effect.target === 'targetActor') targetActorId = context.targetId || '';
            else targetActorId = effect.target;
        } else {
            targetPos = effect.target as Point;
        }

        let resolvedPos = targetPos;
        const sourceActor = context.sourceId ? api.resolveActorById(nextState, context.sourceId) : undefined;
        const adjustedDuration = sourceActor
            ? computeStatusDuration(effect.duration, extractTrinityStats(sourceActor))
            : effect.duration;

        if (targetActorId) {
            const targetActor = targetActorId === nextState.player.id
                ? nextState.player
                : (nextState.enemies.find(e => e.id === targetActorId) || nextState.companions?.find(e => e.id === targetActorId));

            if (targetActor) {
                resolvedPos = targetActor.position;
                const name = targetActorId === nextState.player.id ? 'You' : `${targetActor.subtype || 'enemy'}#${targetActor.id}`;
                const suffix = targetActorId === nextState.player.id ? 'are' : 'is';
                nextState.message = appendTaggedMessage(nextState.message, `${name} ${suffix} ${effect.status}!`, 'INFO', 'COMBAT');

                if (targetActorId === nextState.player.id) {
                    nextState.player = addStatus(nextState.player, effect.status as any, adjustedDuration);
                } else {
                    const updateStatus = (e: Actor) => (e.id === targetActorId) ? addStatus(e, effect.status as any, adjustedDuration) : e;
                    nextState.enemies = nextState.enemies.map(updateStatus);
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.map(updateStatus);
                    }
                }
            }
        }

        if (effect.status === 'stunned' && resolvedPos) {
            nextState.visualEvents = [...(nextState.visualEvents || []),
            { type: 'shake', payload: { intensity: 'low' } },
            { type: 'vfx', payload: { type: 'stunBurst', position: resolvedPos } },
            { type: 'combat_text', payload: { text: 'STUNNED', position: resolvedPos } }
            ];
        }
        const resolvedTargetId = targetActorId || (resolvedPos ? api.resolveActorAt(nextState, resolvedPos)?.id : undefined);
        nextState = api.appendSimulationEvent(nextState, {
            type: 'StatusApplied',
            targetId: resolvedTargetId,
            position: resolvedPos || undefined,
            payload: {
                status: effect.status,
                duration: adjustedDuration,
                sourceId: context.sourceId
            }
        });
        return nextState;
    }
};
