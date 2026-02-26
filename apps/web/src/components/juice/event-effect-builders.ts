import { hexToPixel, TILE_SIZE, pointToKey } from '@hop/engine';
import type { SimulationEvent } from '@hop/engine';
import type { JuiceActorSnapshot, JuiceEffect, JuiceEffectType } from './juice-types';
import type { SignatureImpactMark } from './signature-effects';

interface BuildLegacyVfxEffectsArgs {
    incoming: { type: string; payload: any }[];
    now: number;
}

interface BuildSimulationDamageCueEffectsArgs {
    incoming: SimulationEvent[];
    now: number;
    startIndex: number;
    actorById: Map<string, JuiceActorSnapshot>;
    recentSignatureImpactByTile: Map<string, SignatureImpactMark>;
    classifyDamageCueType: (sourceSubtype: string | undefined, reason: string, distancePx: number) => JuiceEffectType | null;
}

export const buildLegacyVfxEffects = ({ incoming, now }: BuildLegacyVfxEffectsArgs): JuiceEffect[] => {
    const newEffects: JuiceEffect[] = [];

    incoming.forEach((ev, idx) => {
        const id = `juice-${now}-${idx}`;
        if (ev.type === 'vfx' && ev.payload?.type === 'impact') {
            if (ev.payload.position) {
                newEffects.push({
                    id,
                    type: 'impact',
                    position: ev.payload.position,
                    startTime: now
                });
            }
        } else if (ev.type === 'vfx' && ev.payload?.type === 'flash') {
            if (ev.payload.position) {
                newEffects.push({
                    id,
                    type: 'flash',
                    position: ev.payload.position,
                    startTime: now
                });
            }
        } else if (ev.type === 'vfx' && ev.payload?.type === 'spear_trail') {
            if (ev.payload.path && ev.payload.path.length > 0) {
                newEffects.push({
                    id,
                    type: 'spear_trail',
                    position: ev.payload.path[0],
                    payload: ev.payload,
                    startTime: now
                });
            }
        } else if (ev.type === 'vfx' && ev.payload?.type === 'vaporize') {
            if (ev.payload.position) {
                newEffects.push({
                    id,
                    type: 'vaporize',
                    position: ev.payload.position,
                    startTime: now
                });
            }
        } else if (ev.type === 'vfx' && ev.payload?.type === 'lava_ripple') {
            if (ev.payload.position) {
                newEffects.push({
                    id,
                    type: 'lava_ripple',
                    position: ev.payload.position,
                    startTime: now
                });
            }
        } else if (ev.type === 'vfx' && ev.payload?.type === 'explosion_ring') {
            if (ev.payload.position) {
                newEffects.push({
                    id,
                    type: 'explosion_ring',
                    position: ev.payload.position,
                    startTime: now
                });
            }
        }
    });

    return newEffects;
};

export const buildSimulationDamageCueEffects = ({
    incoming,
    now,
    startIndex,
    actorById,
    recentSignatureImpactByTile,
    classifyDamageCueType,
}: BuildSimulationDamageCueEffectsArgs): JuiceEffect[] => {
    const additions: JuiceEffect[] = [];

    incoming.forEach((ev, idx) => {
        if (ev.type !== 'DamageTaken' || !ev.position) return;
        const targetPos = ev.position;
        const sourceId = String(ev.payload?.sourceId || '');
        const source = sourceId ? actorById.get(sourceId) : undefined;
        const reason = String(ev.payload?.reason || '');
        const signatureImpact = recentSignatureImpactByTile.get(pointToKey(targetPos));
        const isStrikeSignature = signatureImpact?.signature === 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK'
            || signatureImpact?.signature === 'ATK.STRIKE.PHYSICAL.AUTO_ATTACK';
        const hasFreshStrikeSignature = !!(signatureImpact && isStrikeSignature && (now - signatureImpact.at) <= 260);
        const isMeleeStrikeReason = reason.includes('basic_attack') || reason.includes('auto_attack');

        if (source?.position) {
            const fromPx = hexToPixel(source.position, TILE_SIZE);
            const toPx = hexToPixel(targetPos, TILE_SIZE);
            const distancePx = Math.hypot(toPx.x - fromPx.x, toPx.y - fromPx.y);
            const cueType = hasFreshStrikeSignature && isMeleeStrikeReason
                ? null
                : classifyDamageCueType(source.subtype, reason, distancePx);
            if (cueType) {
                additions.push({
                    id: `sim-cue-${now}-${startIndex + idx}`,
                    type: cueType,
                    position: targetPos,
                    payload: {
                        source: source.position,
                        sourceSubtype: source.subtype,
                        reason
                    },
                    startTime: now
                });
            }
        }

        if (!(hasFreshStrikeSignature && isMeleeStrikeReason)) {
            additions.push({
                id: `sim-impact-${now}-${startIndex + idx}`,
                type: 'impact',
                position: targetPos,
                startTime: now
            });
        }
    });

    return additions;
};
