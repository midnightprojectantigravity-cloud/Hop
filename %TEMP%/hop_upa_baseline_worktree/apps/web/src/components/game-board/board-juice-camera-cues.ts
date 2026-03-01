import type { JuiceSignaturePayloadV1 } from '@hop/engine';
import type { PointerPoint } from './board-juice-presentation-types';
import { normalizeBoardDirectionToScreen } from './board-juice-presentation-utils';

type DeferredCameraCue = {
    delayMs: number;
    shakeDurationMs: number;
    freezeDurationMs: number;
    kickDurationMs: number;
    kickOffset: PointerPoint;
};

export interface CameraCuePlan {
    shakeDurationMs: number;
    freezeDurationMs: number;
    kickDurationMs: number;
    kickOffset: PointerPoint;
    deferredCues: DeferredCameraCue[];
}

const SHAKE_BY_INTENSITY: Record<string, number> = {
    low: 110,
    medium: 160,
    high: 210,
    extreme: 260
};

const KICK_DISTANCE_BY_INTENSITY: Record<string, number> = {
    light: 6,
    medium: 10,
    heavy: 14
};

const KICK_DURATION_BY_INTENSITY: Record<string, number> = {
    light: 65,
    medium: 85,
    heavy: 110
};

export const collectCameraCuePlan = (visualEvents: ReadonlyArray<any>): CameraCuePlan => {
    let shakeDurationMs = 0;
    let freezeDurationMs = 0;
    let kickDurationMs = 0;
    let kickOffset: PointerPoint = { x: 0, y: 0 };
    let kickStrength = 0;
    const deferredCues: DeferredCameraCue[] = [];

    for (const ev of visualEvents) {
        if (ev.type === 'juice_signature') {
            const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
            if (payload?.protocol === 'juice-signature/v1') {
                const delayMs = Math.max(0, Number(payload.timing?.delayMs || 0));
                const shake = payload.camera?.shake;
                const freezeMs = Number(payload.camera?.freezeMs || 0);
                const kick = String(payload.camera?.kick || 'none');
                const delayedUnit = kick !== 'none' ? normalizeBoardDirectionToScreen(payload.direction) : null;
                const delayedKickPx = KICK_DISTANCE_BY_INTENSITY[kick] || 0;
                const delayedKickDuration = KICK_DURATION_BY_INTENSITY[kick] || 80;
                if (delayMs > 0 && (shake || freezeMs > 0 || (delayedUnit && delayedKickPx > 0))) {
                    deferredCues.push({
                        delayMs,
                        shakeDurationMs: shake ? (SHAKE_BY_INTENSITY[String(shake)] || 160) : 0,
                        freezeDurationMs: freezeMs > 0 ? Math.min(220, freezeMs) : 0,
                        kickDurationMs: delayedUnit && delayedKickPx > 0 ? delayedKickDuration : 0,
                        kickOffset: delayedUnit && delayedKickPx > 0
                            ? { x: delayedUnit.x * delayedKickPx, y: delayedUnit.y * delayedKickPx }
                            : { x: 0, y: 0 },
                    });
                    continue;
                }
                if (shake) {
                    shakeDurationMs = Math.max(shakeDurationMs, SHAKE_BY_INTENSITY[String(shake)] || 160);
                }
                if (freezeMs > 0) {
                    freezeDurationMs = Math.max(freezeDurationMs, Math.min(220, freezeMs));
                }
                if (kick !== 'none') {
                    const unit = normalizeBoardDirectionToScreen(payload.direction);
                    const kickPx = KICK_DISTANCE_BY_INTENSITY[kick] || 0;
                    if (unit && kickPx > 0 && kickPx >= kickStrength) {
                        kickStrength = kickPx;
                        kickOffset = { x: unit.x * kickPx, y: unit.y * kickPx };
                        kickDurationMs = Math.max(kickDurationMs, KICK_DURATION_BY_INTENSITY[kick] || 80);
                    }
                }
                continue;
            }
        }
        if (ev.type === 'shake') {
            const intensity = String((ev.payload as any)?.intensity || 'medium');
            shakeDurationMs = Math.max(shakeDurationMs, SHAKE_BY_INTENSITY[intensity] || 160);
        } else if (ev.type === 'freeze') {
            freezeDurationMs = Math.max(
                freezeDurationMs,
                Math.min(220, Math.max(50, Number((ev.payload as any)?.durationMs || 80)))
            );
        }
    }

    return {
        shakeDurationMs,
        freezeDurationMs,
        kickDurationMs,
        kickOffset,
        deferredCues,
    };
};

