import type { Actor } from '../../types';
import { applyDamage } from '../entities/actor';
import { appendJuiceSignature, getHexEdgeContactWorld } from '../visual/juice-signature';
import type { AtomicEffectHandlerMap } from './types';

export const impactEffectHandlers: AtomicEffectHandlerMap = {
    Impact: (state, effect, context, api) => {
        let nextState = { ...state };
        const targetId = effect.target;
        const actor = targetId === nextState.player.id ? nextState.player : nextState.enemies.find(e => e.id === targetId);
        if (!actor) return nextState;

        const collisionDir = effect.direction;
        const projectedContactHex = collisionDir
            ? {
                q: actor.position.q + collisionDir.q,
                r: actor.position.r + collisionDir.r,
                s: actor.position.s + collisionDir.s
            }
            : undefined;
        const contactWorld = projectedContactHex ? getHexEdgeContactWorld(actor.position, projectedContactHex) : undefined;
        nextState = appendJuiceSignature(nextState, {
            template: {
                signature: collisionDir ? 'ENV.COLLISION.KINETIC.IMPACT' : 'ATK.STRIKE.PHYSICAL.IMPACT',
                family: collisionDir ? 'environment' : 'attack',
                primitive: collisionDir ? 'collision' : 'strike',
                phase: 'impact',
                element: collisionDir ? 'kinetic' : 'physical',
                variant: 'impact',
                sourceRef: { kind: 'source_actor' },
                targetRef: { kind: 'target_actor' },
                contactRef: { kind: 'contact_world' }
            },
            sourceId: context.sourceId,
            targetId,
            sourceHex: api.resolveActorById(nextState, context.sourceId)?.position,
            targetHex: actor.position,
            contactHex: projectedContactHex,
            contactWorld,
            direction: effect.direction,
            intensity: effect.damage > 1 ? 'high' : 'medium',
            flags: { blocked: Boolean(collisionDir) },
            meta: {
                legacyJuiceId: 'impact',
                legacyMirrored: true,
                reason: 'impact'
            }
        });
        if (effect.damage > 0) {
            if (targetId === nextState.player.id) {
                nextState.player = applyDamage(nextState.player, effect.damage);
            } else {
                const updateImpact = (e: Actor) => e.id === targetId ? applyDamage(e, effect.damage) : e;
                nextState.enemies = nextState.enemies.map(updateImpact).filter(e => e.hp > 0);
                if (nextState.companions) {
                    nextState.companions = nextState.companions.map(updateImpact).filter(e => e.hp > 0);
                }
            }
        }
        return nextState;
    }
};
