import { hexEquals } from '../../hex';
import type { Actor, Point } from '../../types';
import { appendTaggedMessage } from '../engine-messages';
import { appendJuiceSignature, buildJuiceSequenceId, getHexEdgeContactWorld, getLegacyJuiceSignatureTemplate } from '../visual/juice-signature';
import type { AtomicEffectHandlerMap } from './types';

export const juiceEffectHandlers: AtomicEffectHandlerMap = {
    Juice: (state, effect, context, api) => {
        let nextState = { ...state };
        const juiceMeta = (effect.metadata || {}) as Record<string, any>;
        const signaturePhase = (typeof juiceMeta.phase === 'string' ? juiceMeta.phase : undefined) as any;
        const legacyTemplate = getLegacyJuiceSignatureTemplate(effect.effect, {
            color: effect.color,
            text: effect.text
        });
        const template = {
            ...legacyTemplate,
            ...(typeof juiceMeta.signature === 'string' ? { signature: juiceMeta.signature } : {}),
            ...(typeof juiceMeta.family === 'string' ? { family: juiceMeta.family } : {}),
            ...(typeof juiceMeta.primitive === 'string' ? { primitive: juiceMeta.primitive } : {}),
            ...(typeof juiceMeta.element === 'string' ? { element: juiceMeta.element } : {}),
            ...(typeof juiceMeta.variant === 'string' ? { variant: juiceMeta.variant } : {}),
            ...(typeof juiceMeta.sourceRef === 'object' && juiceMeta.sourceRef ? { sourceRef: juiceMeta.sourceRef } : {}),
            ...(typeof juiceMeta.targetRef === 'object' && juiceMeta.targetRef ? { targetRef: juiceMeta.targetRef } : {}),
            ...(typeof juiceMeta.contactRef === 'object' && juiceMeta.contactRef ? { contactRef: juiceMeta.contactRef } : {})
        } as typeof legacyTemplate;
        const sourceActor = api.resolveActorById(nextState, context.sourceId);
        let signatureTargetId: string | undefined;
        let signatureTargetHex: Point | undefined;
        if (typeof effect.target === 'string') {
            signatureTargetId = effect.target === 'targetActor' ? (context.targetId || undefined) : effect.target;
            signatureTargetHex = api.resolveActorById(nextState, signatureTargetId)?.position;
        } else if (effect.target) {
            signatureTargetHex = effect.target;
            signatureTargetId = api.resolveActorAt(nextState, effect.target)?.id;
        } else if (context.targetId) {
            signatureTargetId = context.targetId;
            signatureTargetHex = api.resolveActorById(nextState, context.targetId)?.position;
        }

        const contactHex = (juiceMeta.contactHex && typeof juiceMeta.contactHex.q === 'number')
            ? juiceMeta.contactHex as Point
            : undefined;
        let contactWorld = (juiceMeta.contactWorld && typeof juiceMeta.contactWorld.x === 'number')
            ? juiceMeta.contactWorld as { x: number; y: number }
            : undefined;
        if (!contactWorld) {
            const contactFromHex = (juiceMeta.contactFromHex && typeof juiceMeta.contactFromHex.q === 'number')
                ? juiceMeta.contactFromHex as Point
                : undefined;
            const contactToHex = (juiceMeta.contactToHex && typeof juiceMeta.contactToHex.q === 'number')
                ? juiceMeta.contactToHex as Point
                : undefined;
            contactWorld = getHexEdgeContactWorld(contactFromHex, contactToHex);
        }

        nextState = appendJuiceSignature(nextState, {
            template,
            sourceId: context.sourceId,
            targetId: signatureTargetId,
            skillId: typeof juiceMeta.skillId === 'string' ? juiceMeta.skillId : undefined,
            reason: typeof juiceMeta.reason === 'string' ? juiceMeta.reason : undefined,
            sourceHex: sourceActor?.position,
            targetHex: signatureTargetHex,
            contactHex,
            contactWorld,
            path: effect.path,
            direction: effect.direction,
            phase: signaturePhase,
            sequenceId: typeof juiceMeta.sequenceId === 'string'
                ? juiceMeta.sequenceId
                : buildJuiceSequenceId(nextState, {
                    sourceId: context.sourceId,
                    skillId: typeof juiceMeta.skillId === 'string' ? juiceMeta.skillId : undefined,
                    phase: (signaturePhase || template.phase),
                    salt: effect.effect
                }),
            intensity: effect.intensity,
            text: effect.text ? {
                value: effect.text,
                tone: (typeof juiceMeta.textTone === 'string' ? juiceMeta.textTone : 'system') as any,
                color: effect.color
            } : undefined,
            timing: (typeof juiceMeta.timing === 'object' && juiceMeta.timing)
                ? juiceMeta.timing
                : effect.duration ? { durationMs: effect.duration, ttlMs: effect.duration } : undefined,
            camera: (typeof juiceMeta.camera === 'object' && juiceMeta.camera)
                ? juiceMeta.camera
                : effect.effect === 'shake'
                    ? { shake: effect.intensity || 'medium' }
                    : effect.effect === 'freeze'
                        ? { freezeMs: Math.max(0, Number(effect.duration || 80)) }
                        : undefined,
            area: (typeof juiceMeta.area === 'object' && juiceMeta.area) ? juiceMeta.area : undefined,
            flags: (typeof juiceMeta.flags === 'object' && juiceMeta.flags) ? juiceMeta.flags : undefined,
            meta: {
                legacyJuiceId: effect.effect,
                legacyMirrored: api.legacyMirroredJuiceIds.has(effect.effect),
                ...(typeof juiceMeta.statusId === 'string' ? { statusId: juiceMeta.statusId } : {})
            }
        });

        if (effect.effect === 'combat_text' && effect.text) {
            nextState.message = appendTaggedMessage(nextState.message, effect.text, 'VERBOSE', 'SYSTEM');
        }
        if (effect.effect === 'shake') {
            nextState.visualEvents = [...(nextState.visualEvents || []), {
                type: 'shake',
                payload: { intensity: effect.intensity || 'medium', direction: effect.direction }
            }];
        }
        if (effect.effect === 'freeze') {
            nextState.visualEvents = [...(nextState.visualEvents || []), {
                type: 'freeze',
                payload: { durationMs: Math.max(0, Number(effect.duration || 80)) }
            }];
        }
        if (effect.effect === 'impact' && effect.target) {
            const targetPos = typeof effect.target === 'string'
                ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                : effect.target;
            if (targetPos) {
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'impact', position: targetPos } }];
            }
        }
        if (effect.effect === 'flash' && effect.target) {
            const targetPos = typeof effect.target === 'string'
                ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                : effect.target;
            if (targetPos) {
                nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'flash', position: targetPos } }];
            }
        }
        if (effect.effect === 'spearTrail' && effect.path) {
            nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'spear_trail', path: effect.path } }];
        }
        if (effect.effect === 'lavaSink' && effect.target) {
            const targetPos = typeof effect.target === 'string'
                ? (effect.target === nextState.player.id ? nextState.player.position : nextState.enemies.find(e => e.id === effect.target)?.position)
                : (effect.target as Point);

            if (targetPos) {
                const dying = nextState.enemies.find((e: Actor) => hexEquals(e.position, targetPos));
                if (dying) {
                    nextState.dyingEntities = [...(nextState.dyingEntities || []), dying];
                    nextState.enemies = nextState.enemies.filter((e: Actor) => !hexEquals(e.position, targetPos));
                    if (nextState.companions) {
                        nextState.companions = nextState.companions.filter((e: Actor) => !hexEquals(e.position, targetPos));
                    }
                    nextState = api.addCorpseTraitAt(nextState, targetPos);
                    nextState.visualEvents = [...(nextState.visualEvents || []), { type: 'vfx', payload: { type: 'vaporize', position: targetPos } }];
                }
            }
        }

        return nextState;
    }
};
