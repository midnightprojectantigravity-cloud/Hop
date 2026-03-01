import {
    hexEquals,
    hexToPixel,
    TILE_SIZE,
    type GameState,
    type JuiceSignaturePayloadV1,
    type Point,
} from '@hop/engine';
import type { EntityPoseEffect, PoseTransformFrame } from './board-juice-presentation-types';
import { normalizeBoardDirectionToScreen, resolveJuiceAnchorHex, resolveJuiceAnchorWorld } from './board-juice-presentation-utils';

interface BuildPoseEffectsArgs {
    gameState: GameState;
    visualEvents: ReadonlyArray<any>;
    nowMs: number;
}

export const buildPoseEffectsFromVisualEvents = ({
    gameState,
    visualEvents,
    nowMs,
}: BuildPoseEffectsArgs): EntityPoseEffect[] => {
    const additions: EntityPoseEffect[] = [];
    const actors = [
        gameState.player,
        ...gameState.enemies,
        ...(gameState.companions || []),
        ...(gameState.dyingEntities || []),
    ];
    const actorByIdLocal = new Map(actors.map(a => [a.id, a]));
    const findActorIdAtHex = (hex: Point | undefined): string | undefined => {
        if (!hex) return undefined;
        for (const a of actors) {
            if (hexEquals(a.position, hex)) return a.id;
        }
        return undefined;
    };

    const pushPose = (
        actorId: string | undefined,
        phaseKey: string,
        from: PoseTransformFrame,
        to: PoseTransformFrame,
        startTime: number,
        durationMs: number,
        easing: EntityPoseEffect['easing']
    ) => {
        if (!actorId) return;
        additions.push({
            id: `${phaseKey}:${actorId}:${startTime}`,
            actorId,
            startTime,
            endTime: startTime + Math.max(30, durationMs),
            easing,
            from,
            to
        });
    };

    for (let i = 0; i < visualEvents.length; i++) {
        const ev = visualEvents[i];
        if (ev.type !== 'juice_signature') continue;
        const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
        if (!payload || payload.protocol !== 'juice-signature/v1') continue;
        if (payload.signature !== 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK' && payload.signature !== 'ATK.STRIKE.PHYSICAL.AUTO_ATTACK') continue;

        const phase = String(payload.phase || 'impact');
        const sourceHex = resolveJuiceAnchorHex(payload.source);
        const targetHex = resolveJuiceAnchorHex(payload.target);
        const sourceActorId = String(payload.meta?.sourceId || payload.source?.actorId || '') || findActorIdAtHex(sourceHex);
        const targetActorId = payload.target?.actorId || findActorIdAtHex(targetHex);
        if (!sourceHex || !targetHex || !sourceActorId) continue;

        const srcPix = hexToPixel(sourceHex, TILE_SIZE);
        const fallbackTarget = hexToPixel(targetHex, TILE_SIZE);
        const contactWorld = resolveJuiceAnchorWorld(payload.contact) || fallbackTarget;
        let dx = contactWorld.x - srcPix.x;
        let dy = contactWorld.y - srcPix.y;
        let dist = Math.hypot(dx, dy);
        if (!Number.isFinite(dist) || dist < 0.001) {
            const unit = normalizeBoardDirectionToScreen(payload.direction);
            if (unit) {
                dx = unit.x;
                dy = unit.y;
                dist = 1;
            } else {
                const tgtPix = hexToPixel(targetHex, TILE_SIZE);
                dx = tgtPix.x - srcPix.x;
                dy = tgtPix.y - srcPix.y;
                dist = Math.max(1, Math.hypot(dx, dy));
            }
        }
        const ux = dx / Math.max(1, dist);
        const uy = dy / Math.max(1, dist);
        const delayMs = Math.max(0, Number(payload.timing?.delayMs || 0));
        const durationMs = Math.max(40, Number(payload.timing?.durationMs || payload.timing?.ttlMs || 110));
        const startTime = nowMs + delayMs;
        const seq = String(payload.meta?.sequenceId || `strike-${nowMs}-${i}`);
        const intensity = String(payload.intensity || 'medium');
        const isAuto = payload.signature === 'ATK.STRIKE.PHYSICAL.AUTO_ATTACK';
        const intensityFlinch = intensity === 'extreme' ? 16 : intensity === 'high' ? 13 : intensity === 'low' ? 8 : 11;
        const backPull = Math.min(TILE_SIZE * (isAuto ? 0.3 : 0.46), dist * (isAuto ? 0.22 : 0.32));
        const thrustReach = Math.min(TILE_SIZE * (isAuto ? 0.55 : 0.82), dist * (isAuto ? 0.62 : 0.9));
        const impactReach = Math.min(TILE_SIZE * (isAuto ? 0.62 : 0.9), dist * (isAuto ? 0.72 : 0.98));
        const recoilReach = Math.min(TILE_SIZE * (isAuto ? 0.22 : 0.34), dist * (isAuto ? 0.24 : 0.36));

        if (phase === 'anticipation') {
            pushPose(
                sourceActorId,
                `${seq}:anticipation`,
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                { offsetX: -ux * backPull, offsetY: -uy * backPull, scaleX: 0.92, scaleY: 1.08 },
                startTime,
                durationMs,
                'out'
            );
            continue;
        }

        if (phase === 'travel') {
            pushPose(
                sourceActorId,
                `${seq}:travel`,
                { offsetX: -ux * backPull, offsetY: -uy * backPull, scaleX: 0.94, scaleY: 1.06 },
                { offsetX: ux * thrustReach, offsetY: uy * thrustReach, scaleX: 1.09, scaleY: 0.93 },
                startTime,
                durationMs,
                'inOut'
            );
            continue;
        }

        if (phase === 'impact') {
            pushPose(
                sourceActorId,
                `${seq}:impact-src`,
                { offsetX: ux * (impactReach * 0.92), offsetY: uy * (impactReach * 0.92), scaleX: 1.06, scaleY: 0.95 },
                { offsetX: ux * impactReach, offsetY: uy * impactReach, scaleX: 1.02, scaleY: 0.98 },
                startTime,
                durationMs,
                'out'
            );
            pushPose(
                targetActorId,
                `${seq}:impact-tgt`,
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                { offsetX: ux * intensityFlinch, offsetY: uy * intensityFlinch, scaleX: 1.03, scaleY: 0.94 },
                startTime,
                durationMs,
                'out'
            );
            continue;
        }

        if (phase === 'aftermath') {
            pushPose(
                sourceActorId,
                `${seq}:after-src`,
                { offsetX: ux * recoilReach, offsetY: uy * recoilReach, scaleX: 1.01, scaleY: 0.99 },
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                startTime,
                durationMs,
                'out'
            );
            pushPose(
                targetActorId,
                `${seq}:after-tgt`,
                { offsetX: ux * (intensityFlinch * 0.35), offsetY: uy * (intensityFlinch * 0.35), scaleX: 1.01, scaleY: 0.99 },
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                startTime,
                durationMs,
                'out'
            );
        }
    }

    for (let i = 0; i < visualEvents.length; i++) {
        const ev = visualEvents[i];
        if (ev.type !== 'juice_signature') continue;
        const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
        if (!payload || payload.protocol !== 'juice-signature/v1') continue;

        const sig = String(payload.signature || '');
        const phase = String(payload.phase || 'impact');
        if (phase !== 'impact') continue;

        const delayMs = Math.max(0, Number(payload.timing?.delayMs || 0));
        const durationMs = Math.max(45, Number(payload.timing?.durationMs || payload.timing?.ttlMs || 110));
        const startTime = nowMs + delayMs;
        const sourceHex = resolveJuiceAnchorHex(payload.source);
        const targetHex = resolveJuiceAnchorHex(payload.target);
        const sourceWorld = resolveJuiceAnchorWorld(payload.source);
        const targetWorld = resolveJuiceAnchorWorld(payload.target);
        const contactWorld = resolveJuiceAnchorWorld(payload.contact);
        const sourceIdFromMeta = String(payload.meta?.sourceId || payload.source?.actorId || '');
        const sourceActor = sourceIdFromMeta ? actorByIdLocal.get(sourceIdFromMeta) : undefined;
        const sourceActorId = sourceActor?.id || findActorIdAtHex(sourceHex);
        const targetActorId = payload.target?.actorId || findActorIdAtHex(targetHex);

        const resolveDir = (): { x: number; y: number } | null => {
            const unitFromPayload = normalizeBoardDirectionToScreen(payload.direction);
            if (unitFromPayload) return unitFromPayload;
            const src = sourceHex ? hexToPixel(sourceHex, TILE_SIZE) : sourceWorld;
            const tgt = (contactWorld || targetWorld || (targetHex ? hexToPixel(targetHex, TILE_SIZE) : undefined));
            if (src && tgt) {
                const dx = tgt.x - src.x;
                const dy = tgt.y - src.y;
                const mag = Math.hypot(dx, dy);
                if (mag > 0.001) return { x: dx / mag, y: dy / mag };
            }
            return null;
        };
        const unit = resolveDir();
        if (!unit) continue;

        if (sig === 'ATK.PULSE.KINETIC.WAVE') {
            const recoil = 8;
            const castPush = 10;
            pushPose(
                sourceActorId,
                `${payload.meta?.sequenceId || sig}:pulse-caster`,
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                { offsetX: -unit.x * recoil, offsetY: -unit.y * recoil, scaleX: 0.96, scaleY: 1.05 },
                startTime,
                Math.max(40, Math.floor(durationMs * 0.5)),
                'out'
            );
            pushPose(
                sourceActorId,
                `${payload.meta?.sequenceId || sig}:pulse-caster-return`,
                { offsetX: -unit.x * (recoil * 0.6), offsetY: -unit.y * (recoil * 0.6), scaleX: 0.98, scaleY: 1.02 },
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                startTime + Math.floor(durationMs * 0.45),
                Math.max(50, Math.floor(durationMs * 0.65)),
                'out'
            );
            pushPose(
                targetActorId,
                `${payload.meta?.sequenceId || sig}:pulse-target`,
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                { offsetX: unit.x * castPush, offsetY: unit.y * castPush, scaleX: 1.03, scaleY: 0.95 },
                startTime,
                durationMs,
                'out'
            );
            continue;
        }

        if (sig.startsWith('ENV.COLLISION.KINETIC.')) {
            const collisionFlinch = sig === 'ENV.COLLISION.KINETIC.SHIELD_BASH' ? 14 : 10;
            const sourceDrive = sig === 'ENV.COLLISION.KINETIC.SHIELD_BASH' ? 7 : 0;
            if (sourceDrive > 0) {
                pushPose(
                    sourceActorId,
                    `${payload.meta?.sequenceId || sig}:collision-source`,
                    { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                    { offsetX: unit.x * sourceDrive, offsetY: unit.y * sourceDrive, scaleX: 1.03, scaleY: 0.97 },
                    startTime,
                    Math.max(45, Math.floor(durationMs * 0.55)),
                    'out'
                );
            }
            pushPose(
                targetActorId,
                `${payload.meta?.sequenceId || sig}:collision-target`,
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                { offsetX: unit.x * collisionFlinch, offsetY: unit.y * collisionFlinch, scaleX: 1.02, scaleY: 0.92 },
                startTime,
                durationMs,
                'out'
            );
            continue;
        }
    }

    return additions;
};

