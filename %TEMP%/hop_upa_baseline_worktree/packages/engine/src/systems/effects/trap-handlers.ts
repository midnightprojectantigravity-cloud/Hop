import { hexEquals } from '../../hex';
import type { AtomicEffectHandlerMap } from './types';

export const trapEffectHandlers: AtomicEffectHandlerMap = {
    PlaceTrap: (state, effect) => {
        const traps = state.traps || [];
        return {
            ...state,
            traps: [...traps, {
                position: effect.position,
                ownerId: effect.ownerId,
                isRevealed: false,
                cooldown: 0,
                volatileCore: effect.volatileCore,
                chainReaction: effect.chainReaction,
                resetCooldown: effect.resetCooldown
            }]
        };
    },
    RemoveTrap: (state, effect) => {
        if (!state.traps) return state;
        return {
            ...state,
            traps: effect.ownerId
                ? state.traps.filter(t => t.ownerId !== effect.ownerId)
                : state.traps.filter(t => !hexEquals(t.position, effect.position))
        };
    },
    SetTrapCooldown: (state, effect) => {
        if (!state.traps) return state;
        return {
            ...state,
            traps: state.traps.map(t => {
                if (effect.ownerId && t.ownerId !== effect.ownerId) return t;
                if (!hexEquals(t.position, effect.position)) return t;
                return {
                    ...t,
                    cooldown: Math.max(0, effect.cooldown)
                };
            })
        };
    }
};
