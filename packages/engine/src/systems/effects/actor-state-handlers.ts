import type { Actor } from '../../types';
import type { AtomicEffectHandlerMap } from './types';

export const actorStateEffectHandlers: AtomicEffectHandlerMap = {
    ModifyCooldown: (state, effect, context) => {
        const applyToActor = (actor: Actor): Actor => ({
            ...actor,
            activeSkills: actor.activeSkills?.map(s => {
                if (s.id !== effect.skillId) return s;
                return {
                    ...s,
                    currentCooldown: effect.setExact ? effect.amount : Math.max(0, s.currentCooldown + effect.amount)
                };
            })
        });

        const actorId = context.sourceId || state.player.id;
        if (actorId === state.player.id) {
            return { ...state, player: applyToActor(state.player) };
        }

        return {
            ...state,
            enemies: state.enemies.map(e => e.id === actorId ? applyToActor(e) : e),
            companions: state.companions?.map(e => e.id === actorId ? applyToActor(e) : e)
        };
    },
    SetStealth: (state, effect) => {
        const updateStealth = (actor: Actor) => ({ ...actor, stealthCounter: (actor.stealthCounter || 0) + effect.amount });

        if (effect.target === 'self') {
            return { ...state, player: updateStealth(state.player) };
        }

        return {
            ...state,
            enemies: state.enemies.map(e => e.id === effect.target ? updateStealth(e) : e),
            companions: state.companions?.map(e => e.id === effect.target ? updateStealth(e) : e)
        };
    },
    UpdateCompanionState: (state, effect, context) => {
        const targetId = effect.target === 'self' ? (context.sourceId || state.player.id) : effect.target;
        const updateFunc = (e: Actor) => {
            if (e.id !== targetId) return e;
            return {
                ...e,
                companionState: {
                    ...e.companionState,
                    mode: effect.mode || e.companionState?.mode,
                    markTarget: effect.markTarget !== undefined ? effect.markTarget : e.companionState?.markTarget,
                    orbitStep: effect.mode === 'scout' ? 0 : e.companionState?.orbitStep,
                    apexStrikeCooldown: effect.apexStrikeCooldown !== undefined ? effect.apexStrikeCooldown : e.companionState?.apexStrikeCooldown,
                    healCooldown: effect.healCooldown !== undefined ? effect.healCooldown : e.companionState?.healCooldown,
                }
            } as Actor;
        };

        return {
            ...state,
            enemies: state.enemies.map(updateFunc),
            companions: state.companions?.map(updateFunc)
        };
    }
};
