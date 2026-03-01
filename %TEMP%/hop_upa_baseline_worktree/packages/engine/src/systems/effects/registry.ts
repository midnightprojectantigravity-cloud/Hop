import type { AtomicEffect, GameState } from '../../types';
import type { AtomicEffectContext, AtomicEffectHandlerApi, AtomicEffectHandlerMap } from './types';
import { actorStateEffectHandlers } from './actor-state-handlers';
import { ailmentEffectHandlers } from './ailment-handlers';
import { corpseEffectHandlers } from './corpse-handlers';
import { damageEffectHandlers } from './damage-handlers';
import { displacementEffectHandlers } from './displacement-handlers';
import { impactEffectHandlers } from './impact-handlers';
import { itemHazardEffectHandlers } from './item-hazard-handlers';
import { juiceEffectHandlers } from './juice-handlers';
import { metaEffectHandlers } from './meta-handlers';
import { statusEffectHandlers } from './status-handlers';
import { structureEffectHandlers } from './structure-handlers';
import { trapEffectHandlers } from './trap-handlers';

export const atomicEffectHandlers: AtomicEffectHandlerMap = {
    ...metaEffectHandlers,
    ...corpseEffectHandlers,
    ...damageEffectHandlers,
    ...displacementEffectHandlers,
    ...itemHazardEffectHandlers,
    ...trapEffectHandlers,
    ...actorStateEffectHandlers,
    ...ailmentEffectHandlers,
    ...statusEffectHandlers,
    ...impactEffectHandlers,
    ...juiceEffectHandlers,
    ...structureEffectHandlers
};

export const tryApplyRegisteredAtomicEffect = (
    state: GameState,
    effect: AtomicEffect,
    context: AtomicEffectContext,
    api: AtomicEffectHandlerApi
): GameState | null => {
    const handler = (atomicEffectHandlers as Partial<Record<AtomicEffect['type'], unknown>>)[effect.type];
    if (typeof handler !== 'function') return null;
    return (handler as (s: GameState, e: AtomicEffect, c: AtomicEffectContext, a: AtomicEffectHandlerApi) => GameState)(
        state,
        effect,
        context,
        api
    );
};
