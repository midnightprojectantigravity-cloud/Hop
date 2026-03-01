import { resolveForce } from '../combat/force';
import type { AtomicEffectHandlerMap } from './types';

export const forceEffectHandlers: AtomicEffectHandlerMap = {
    ApplyForce: (state, effect, context, api) => {
        let targetActorId = '';
        if (effect.target === 'self') targetActorId = context.sourceId || state.player.id;
        else if (effect.target === 'targetActor') targetActorId = context.targetId || '';
        else targetActorId = effect.target;

        if (!targetActorId) return state;

        const resolution = resolveForce(state, {
            source: effect.source,
            targetActorId,
            mode: effect.mode,
            magnitude: effect.magnitude,
            maxDistance: effect.maxDistance,
            collision: effect.collision,
            damageReason: effect.damageReason
        });

        if (resolution.effects.length === 0) return state;

        return api.applyEffects(state, resolution.effects, {
            ...context,
            targetId: targetActorId
        });
    }
};

