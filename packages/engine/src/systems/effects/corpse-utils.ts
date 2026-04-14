import type { Actor, GameState } from '../../types';

export const shouldLeaveCorpse = (actor?: Pick<Actor, 'subtype' | 'companionOf'> | null): boolean => {
    if (!actor) return false;
    if (actor.subtype === 'skeleton' && actor.companionOf) return false;
    return true;
};

export const addDyingEntityOnce = (state: GameState, actor: Actor): GameState => {
    const dyingEntities = state.dyingEntities || [];
    if (dyingEntities.some(entry => entry.id === actor.id)) return state;
    return {
        ...state,
        dyingEntities: [...dyingEntities, actor]
    };
};
