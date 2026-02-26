import { hexEquals } from '../../hex';
import type { AtomicEffectHandlerMap } from './types';

export const corpseEffectHandlers: AtomicEffectHandlerMap = {
    SpawnCorpse: (state, effect, _context, api) => api.addCorpseTraitAt(state, effect.position),
    RemoveCorpse: (state, effect, _context, api) => {
        const nextState = api.removeCorpseTraitAt(state, effect.position);
        return {
            ...nextState,
            dyingEntities: (nextState.dyingEntities || []).filter(cp => !hexEquals(cp.position, effect.position))
        };
    }
};
