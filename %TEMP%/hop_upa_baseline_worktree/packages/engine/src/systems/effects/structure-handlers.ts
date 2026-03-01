import { pointToKey } from '../../hex';
import type { Actor } from '../../types';
import { appendTaggedMessages } from '../engine-messages';
import { ensureActorTrinity } from '../entities/entity-factory';
import { addToQueue } from '../initiative';
import { TileResolver } from '../tiles/tile-effects';
import { BASE_TILES } from '../tiles/tile-registry';
import type { AtomicEffectHandlerMap } from './types';

export const structureEffectHandlers: AtomicEffectHandlerMap = {
    UpdateComponent: (state, effect, context) => {
        let nextState = { ...state };
        const updateActor = (actor: Actor, key: string, value: any): Actor => {
            const newComponents = new Map(actor.components || []);
            newComponents.set(key, value);
            return {
                ...actor,
                components: newComponents
            };
        };

        if (effect.target === 'self') {
            nextState.player = updateActor(nextState.player, effect.key, effect.value);
            return nextState;
        }

        if (effect.target === 'targetActor' && context.targetId) {
            if (context.targetId === nextState.player.id) {
                nextState.player = updateActor(nextState.player, effect.key, effect.value);
                return nextState;
            }

            const updateComp = (e: Actor) => e.id === context.targetId ? updateActor(e, effect.key, effect.value) : e;
            nextState.enemies = nextState.enemies.map(updateComp);
            if (nextState.companions) {
                nextState.companions = nextState.companions.map(updateComp);
            }
        }

        return nextState;
    },
    SpawnActor: (state, effect) => {
        let nextState = { ...state };
        const normalizedActor = ensureActorTrinity(effect.actor);
        nextState.enemies = [...nextState.enemies, normalizedActor];
        if (normalizedActor.companionOf) {
            nextState.companions = [...(nextState.companions || []), normalizedActor];
        }
        if (nextState.initiativeQueue) {
            nextState.initiativeQueue = addToQueue(nextState.initiativeQueue, normalizedActor);
        }
        return nextState;
    },
    PlaceFire: (state, effect, context) => {
        let nextState = { ...state, tiles: new Map(state.tiles) };
        const key = pointToKey(effect.position);
        let tile = nextState.tiles.get(key);
        if (!tile) {
            tile = {
                baseId: 'STONE',
                position: effect.position,
                traits: new Set(BASE_TILES.STONE!.defaultTraits),
                effects: []
            };
        } else {
            tile = {
                ...tile,
                traits: new Set(tile.traits),
                effects: [...tile.effects]
            };
        }
        nextState.tiles.set(key, tile);

        const result = TileResolver.applyEffect(tile, 'FIRE', effect.duration, 1, nextState, context.sourceId);
        if (result.messages.length > 0) {
            nextState.message = appendTaggedMessages(nextState.message, result.messages, 'INFO', 'HAZARD');
        }
        return nextState;
    }
};
