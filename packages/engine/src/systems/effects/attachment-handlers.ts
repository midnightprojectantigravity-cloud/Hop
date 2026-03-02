import { attachActors, releaseAttachment } from '../movement/attachment-system';
import type { AtomicEffectHandlerMap } from './types';

const resolveActorTarget = (
    statePlayerId: string,
    value: 'self' | 'targetActor' | string,
    sourceId?: string,
    targetId?: string
): string => {
    if (value === 'self') return sourceId || statePlayerId;
    if (value === 'targetActor') return targetId || '';
    return value;
};

export const attachmentEffectHandlers: AtomicEffectHandlerMap = {
    AttachActors: (state, effect, context) => {
        const anchorId = resolveActorTarget(state.player.id, effect.anchor, context.sourceId, context.targetId);
        const attachedId = resolveActorTarget(state.player.id, effect.attached, context.sourceId, context.targetId);
        if (!anchorId || !attachedId || anchorId === attachedId) return state;
        return attachActors(state, anchorId, attachedId, {
            mode: effect.mode,
            sharedVectorScale: effect.sharedVectorScale,
            breakOnDamage: effect.breakOnDamage,
            breakOnStatuses: effect.breakOnStatuses
        });
    },
    ReleaseAttachment: (state, effect, context) => {
        const actorId = resolveActorTarget(state.player.id, effect.actor, context.sourceId, context.targetId);
        if (!actorId) return state;
        return releaseAttachment(state, actorId, {
            counterpartId: effect.counterpartId,
            linkId: effect.linkId
        });
    }
};
