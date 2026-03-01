import type { JuiceSignaturePayloadV1, Point } from '@hop/engine';
import { pointToKey } from '@hop/engine';
import { resolveJuiceRecipe } from '../../visual/juice-resolver';
import type { JuiceEffect, WorldPoint } from './juice-types';

export type SignatureImpactMark = { at: number; signature: string };

interface BuildSignatureJuiceEffectsArgs {
    incoming: { type: string; payload: any }[];
    now: number;
    reducedMotion: boolean;
    recentSignatureImpactByTile: Map<string, SignatureImpactMark>;
}

const resolveAnchorHex = (anchor: any): Point | undefined => {
    const p = anchor?.hex;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') return p as Point;
    return undefined;
};

const resolveAnchorWorld = (anchor: any): WorldPoint | undefined => {
    const p = anchor?.world;
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return p as WorldPoint;
    return undefined;
};

export const buildSignatureJuiceEffects = ({
    incoming,
    now,
    reducedMotion,
    recentSignatureImpactByTile,
}: BuildSignatureJuiceEffectsArgs): JuiceEffect[] => {
    const additions: JuiceEffect[] = [];

    incoming.forEach((ev, idx) => {
        if (ev.type !== 'juice_signature') return;
        const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
        if (!payload || payload.protocol !== 'juice-signature/v1') return;

        const resolved = resolveJuiceRecipe({
            payload,
            reducedMotion
        });
        if (!resolved || resolved.recipe.rendererId === 'none') return;

        const contactHex = resolveAnchorHex(payload.contact);
        const targetHex = resolveAnchorHex(payload.target);
        const sourceHex = resolveAnchorHex(payload.source);
        const contactWorld = resolveAnchorWorld(payload.contact);
        const targetWorld = resolveAnchorWorld(payload.target);
        const sourceWorld = resolveAnchorWorld(payload.source);
        const primaryHex = contactHex || targetHex || sourceHex;
        const primaryWorld = contactWorld || targetWorld || sourceWorld;

        const base: Partial<JuiceEffect> = {
            id: `sig-${now}-${idx}`,
            startTime: now + Math.max(0, Number(payload.timing?.delayMs || 0)),
            ttlMs: resolved.ttlMs
        };

        if (
            (payload.signature === 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK' || payload.signature === 'ATK.STRIKE.PHYSICAL.AUTO_ATTACK')
            && payload.phase === 'impact'
            && targetHex
        ) {
            const key = pointToKey(targetHex);
            recentSignatureImpactByTile.set(key, { at: now, signature: payload.signature });
        }

        const textValue = payload.text?.value;
        switch (resolved.recipe.rendererId) {
            case 'basic_attack_strike': {
                if (!sourceHex || !targetHex) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: 'basic_attack_strike',
                    position: targetHex,
                    worldPosition: contactWorld || primaryWorld,
                    payload: {
                        phase: payload.phase,
                        intensity: payload.intensity || 'medium',
                        signature: payload.signature,
                        source: sourceHex,
                        target: targetHex,
                        sourceActorId: payload.source?.actorId,
                        targetActorId: payload.target?.actorId,
                        contactWorld: contactWorld,
                        contactHex: contactHex,
                        direction: payload.direction,
                        flags: payload.flags || {}
                    }
                });
                return;
            }
            case 'archer_shot_signature': {
                const endHex = targetHex || contactHex;
                if (!sourceHex || !endHex) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: 'archer_shot_signature',
                    position: endHex,
                    worldPosition: contactWorld || primaryWorld,
                    payload: {
                        phase: payload.phase,
                        intensity: payload.intensity || 'medium',
                        source: sourceHex,
                        target: endHex,
                        contactWorld,
                        path: payload.path || (payload.area?.kind === 'path' ? payload.area.points : undefined),
                        signature: payload.signature
                    }
                });
                return;
            }
            case 'impact':
            case 'flash':
            case 'lava_ripple':
            case 'explosion_ring':
            case 'kinetic_wave':
            case 'wall_crack':
            case 'hidden_fade':
            case 'generic_ring': {
                if (!primaryHex && !primaryWorld) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: resolved.recipe.rendererId,
                    position: primaryHex,
                    worldPosition: primaryWorld,
                    payload: {
                        signature: payload.signature,
                        color: payload.text?.color,
                        element: payload.element,
                        variant: payload.variant,
                        source: sourceHex,
                        target: targetHex
                    }
                });
                return;
            }
            case 'combat_text': {
                if (!textValue || (!primaryHex && !primaryWorld)) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: 'combat_text',
                    position: primaryHex,
                    worldPosition: primaryWorld,
                    payload: {
                        text: textValue,
                        color: payload.text?.color
                    }
                });
                return;
            }
            case 'spear_trail': {
                if ((!payload.path || payload.path.length === 0) && !(payload.area?.kind === 'path')) return;
                const path = payload.path || (payload.area?.kind === 'path' ? payload.area.points : []);
                if (!path || path.length === 0) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: 'spear_trail',
                    position: path[0],
                    payload: { path }
                });
                return;
            }
            case 'melee_lunge':
            case 'arrow_shot':
            case 'arcane_bolt':
            case 'generic_line': {
                const endHex = targetHex || contactHex;
                if (!endHex || !sourceHex) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: resolved.recipe.rendererId,
                    position: endHex,
                    payload: {
                        source: sourceHex,
                        signature: payload.signature,
                        element: payload.element
                    }
                });
                return;
            }
            case 'dash_blur': {
                const path = payload.path || (payload.area?.kind === 'path' ? payload.area.points : undefined);
                if (!path || path.length < 2) return;
                additions.push({
                    ...(base as JuiceEffect),
                    type: 'dash_blur',
                    position: path[path.length - 1],
                    payload: {
                        path,
                        source: path[0]
                    }
                });
                return;
            }
            default:
                return;
        }
    });

    return additions;
};
