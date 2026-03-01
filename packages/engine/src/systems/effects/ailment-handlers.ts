import type { AtomicEffectHandlerMap } from './types';
import {
    applyAilmentToTarget,
    clearAilmentCounters,
    depositAilmentCounters
} from '../ailments/runtime';

export const ailmentEffectHandlers: AtomicEffectHandlerMap = {
    ApplyAilment: (state, effect, context) => {
        return applyAilmentToTarget(
            state,
            effect.target,
            effect.ailment,
            effect.skillMultiplier || 0,
            effect.baseDeposit,
            context,
            'skill'
        );
    },
    DepositAilmentCounters: (state, effect, context) => {
        return depositAilmentCounters(
            state,
            effect.target,
            effect.ailment,
            effect.amount,
            context,
            effect.source || 'system'
        );
    },
    ClearAilmentCounters: (state, effect, context) => {
        return clearAilmentCounters(
            state,
            effect.target,
            effect.ailment,
            effect.amount,
            effect.reason,
            context
        );
    }
};

