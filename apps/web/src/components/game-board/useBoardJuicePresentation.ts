import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
    hexEquals,
    hexToPixel,
    TILE_SIZE,
    type GameState,
    type JuiceSignaturePayloadV1,
    type Point,
} from '@hop/engine';

type PointerPoint = { x: number; y: number };

type JuiceDebugEntry = {
    id: string;
    sequenceId: string;
    signature: string;
    phase: string;
    primitive: string;
    timestamp: number;
};

type WorldPoint = { x: number; y: number };

type PoseTransformFrame = {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
};

type EntityPoseEffect = {
    id: string;
    actorId: string;
    startTime: number;
    endTime: number;
    easing: 'out' | 'inOut';
    from: PoseTransformFrame;
    to: PoseTransformFrame;
};

interface UseBoardJuicePresentationArgs {
    gameState: GameState;
}

interface UseBoardJuicePresentationResult {
    isShaking: boolean;
    isFrozen: boolean;
    cameraKickOffsetPx: PointerPoint;
    juiceDebugOverlayEnabled: boolean;
    juiceDebugEntries: JuiceDebugEntry[];
    entityPoseEffects: EntityPoseEffect[];
    entityPoseNowMs: number;
    setEntityPoseEffects: Dispatch<SetStateAction<EntityPoseEffect[]>>;
    setEntityPoseNowMs: Dispatch<SetStateAction<number>>;
    resetBoardJuicePresentation: () => void;
}

const normalizeBoardDirectionToScreen = (direction: Point | undefined): { x: number; y: number } | null => {
    if (!direction || typeof direction.q !== 'number' || typeof direction.r !== 'number' || typeof direction.s !== 'number') {
        return null;
    }
    const { x, y } = hexToPixel(direction, TILE_SIZE);
    const mag = Math.hypot(x, y);
    if (!Number.isFinite(mag) || mag <= 0.0001) return null;
    return { x: x / mag, y: y / mag };
};

const resolveJuiceAnchorHex = (anchor: any): Point | undefined => {
    const p = anchor?.hex;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') return p as Point;
    return undefined;
};

const resolveJuiceAnchorWorld = (anchor: any): WorldPoint | undefined => {
    const p = anchor?.world;
    if (p && typeof p.x === 'number' && typeof p.y === 'number') return p as WorldPoint;
    return undefined;
};

export const useBoardJuicePresentation = ({
    gameState,
}: UseBoardJuicePresentationArgs): UseBoardJuicePresentationResult => {
    const [isShaking, setIsShaking] = useState(false);
    const [isFrozen, setIsFrozen] = useState(false);
    const [cameraKickOffsetPx, setCameraKickOffsetPx] = useState<PointerPoint>({ x: 0, y: 0 });
    const [juiceDebugOverlayEnabled, setJuiceDebugOverlayEnabled] = useState(false);
    const [juiceDebugEntries, setJuiceDebugEntries] = useState<JuiceDebugEntry[]>([]);
    const [entityPoseEffects, setEntityPoseEffects] = useState<EntityPoseEffect[]>([]);
    const [entityPoseNowMs, setEntityPoseNowMs] = useState(0);

    const processedCameraCueVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuiceDebugVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuicePoseVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const poseAnimFrameRef = useRef<number | null>(null);
    const juiceDebugTraceEnabledRef = useRef(false);

    useEffect(() => {
        if (!import.meta.env.DEV || typeof window === 'undefined') return;
        const w = window as any;
        const params = new URLSearchParams(window.location.search);
        const syncFlags = () => {
            const overlayEnabled = !!(w.__HOP_JUICE_DEBUG__ || params.get('juiceDebug') === '1');
            const traceEnabled = !!(w.__HOP_JUICE_TRACE__ || overlayEnabled);
            setJuiceDebugOverlayEnabled(overlayEnabled);
            juiceDebugTraceEnabledRef.current = traceEnabled;
        };
        w.__HOP_SET_JUICE_DEBUG__ = (enabled: boolean) => {
            w.__HOP_JUICE_DEBUG__ = !!enabled;
            syncFlags();
        };
        syncFlags();
    }, []);

    // Visual-only actor pose channel (JUICE-owned presentation layer).
    // First slice: BASIC_ATTACK strike phases drive source lunge + target flinch on real entities.
    useEffect(() => {
        const events = gameState.visualEvents || [];
        if (processedJuicePoseVisualBatchRef.current === events) return;
        processedJuicePoseVisualBatchRef.current = events;
        const newEvents = events;
        if (newEvents.length === 0) return;

        const now = Date.now();
        const additions: EntityPoseEffect[] = [];
        const actors = [
            gameState.player,
            ...gameState.enemies,
            ...(gameState.companions || []),
            ...(gameState.dyingEntities || [])
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

        for (let i = 0; i < newEvents.length; i++) {
            const ev = newEvents[i];
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
            const startTime = now + delayMs;
            const seq = String(payload.meta?.sequenceId || `strike-${now}-${i}`);
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

        for (let i = 0; i < newEvents.length; i++) {
            const ev = newEvents[i];
            if (ev.type !== 'juice_signature') continue;
            const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
            if (!payload || payload.protocol !== 'juice-signature/v1') continue;

            const sig = String(payload.signature || '');
            const phase = String(payload.phase || 'impact');
            if (phase !== 'impact') continue;

            const delayMs = Math.max(0, Number(payload.timing?.delayMs || 0));
            const durationMs = Math.max(45, Number(payload.timing?.durationMs || payload.timing?.ttlMs || 110));
            const startTime = now + delayMs;
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

        if (additions.length > 0) {
            setEntityPoseNowMs(now);
            setEntityPoseEffects(prev => [...prev, ...additions]);
        }
    }, [gameState.visualEvents, gameState.player, gameState.enemies, gameState.companions, gameState.dyingEntities]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (entityPoseEffects.length === 0) return;

        let cancelled = false;
        const tick = () => {
            if (cancelled) return;
            const now = Date.now();
            setEntityPoseNowMs(now);
            setEntityPoseEffects(prev => {
                const next = prev.filter(e => now < e.endTime + 16);
                return next.length === prev.length ? prev : next;
            });
            poseAnimFrameRef.current = window.requestAnimationFrame(tick);
        };
        poseAnimFrameRef.current = window.requestAnimationFrame(tick);

        return () => {
            cancelled = true;
            if (poseAnimFrameRef.current !== null) {
                window.cancelAnimationFrame(poseAnimFrameRef.current);
                poseAnimFrameRef.current = null;
            }
        };
    }, [entityPoseEffects.length]);

    // Handle camera cues (signature-first, legacy fallback during migration)
    useEffect(() => {
        const events = gameState.visualEvents || [];
        if (processedCameraCueVisualBatchRef.current === events) return;
        processedCameraCueVisualBatchRef.current = events;
        const newEvents = events;
        if (newEvents.length === 0) return;

        let shakeDurationMs = 0;
        let freezeDurationMs = 0;
        let kickDurationMs = 0;
        let kickOffset: PointerPoint = { x: 0, y: 0 };
        let kickStrength = 0;

        const shakeByIntensity: Record<string, number> = {
            low: 110,
            medium: 160,
            high: 210,
            extreme: 260
        };
        const kickDistanceByIntensity: Record<string, number> = {
            light: 6,
            medium: 10,
            heavy: 14
        };
        const kickDurationByIntensity: Record<string, number> = {
            light: 65,
            medium: 85,
            heavy: 110
        };
        const deferredCueTimers: number[] = [];
        const triggerShakeNow = (durationMs: number) => {
            if (durationMs <= 0) return;
            setIsShaking(true);
            deferredCueTimers.push(window.setTimeout(() => setIsShaking(false), durationMs));
        };
        const triggerFreezeNow = (durationMs: number) => {
            if (durationMs <= 0) return;
            setIsFrozen(true);
            deferredCueTimers.push(window.setTimeout(() => setIsFrozen(false), durationMs));
        };
        const triggerKickNow = (offset: PointerPoint, durationMs: number) => {
            if (durationMs <= 0 || (!offset.x && !offset.y)) return;
            setCameraKickOffsetPx(offset);
            deferredCueTimers.push(window.setTimeout(() => setCameraKickOffsetPx({ x: 0, y: 0 }), durationMs));
        };

        for (const ev of newEvents) {
            if (ev.type === 'juice_signature') {
                const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
                if (payload?.protocol === 'juice-signature/v1') {
                    const delayMs = Math.max(0, Number(payload.timing?.delayMs || 0));
                    const shake = payload.camera?.shake;
                    const freezeMs = Number(payload.camera?.freezeMs || 0);
                    const kick = String(payload.camera?.kick || 'none');
                    const delayedUnit = kick !== 'none' ? normalizeBoardDirectionToScreen(payload.direction) : null;
                    const delayedKickPx = kickDistanceByIntensity[kick] || 0;
                    const delayedKickDuration = kickDurationByIntensity[kick] || 80;
                    if (delayMs > 0 && (shake || freezeMs > 0 || (delayedUnit && delayedKickPx > 0))) {
                        deferredCueTimers.push(window.setTimeout(() => {
                            if (shake) triggerShakeNow(shakeByIntensity[String(shake)] || 160);
                            if (freezeMs > 0) triggerFreezeNow(Math.min(220, freezeMs));
                            if (delayedUnit && delayedKickPx > 0) {
                                triggerKickNow({ x: delayedUnit.x * delayedKickPx, y: delayedUnit.y * delayedKickPx }, delayedKickDuration);
                            }
                        }, delayMs));
                        continue;
                    }
                    if (shake) {
                        shakeDurationMs = Math.max(shakeDurationMs, shakeByIntensity[String(shake)] || 160);
                    }
                    if (freezeMs > 0) {
                        freezeDurationMs = Math.max(freezeDurationMs, Math.min(220, freezeMs));
                    }
                    if (kick !== 'none') {
                        const unit = normalizeBoardDirectionToScreen(payload.direction);
                        const kickPx = kickDistanceByIntensity[kick] || 0;
                        if (unit && kickPx > 0 && kickPx >= kickStrength) {
                            kickStrength = kickPx;
                            kickOffset = { x: unit.x * kickPx, y: unit.y * kickPx };
                            kickDurationMs = Math.max(kickDurationMs, kickDurationByIntensity[kick] || 80);
                        }
                    }
                    continue;
                }
            }
            if (ev.type === 'shake') {
                const intensity = String((ev.payload as any)?.intensity || 'medium');
                shakeDurationMs = Math.max(shakeDurationMs, shakeByIntensity[intensity] || 160);
            } else if (ev.type === 'freeze') {
                freezeDurationMs = Math.max(
                    freezeDurationMs,
                    Math.min(220, Math.max(50, Number((ev.payload as any)?.durationMs || 80)))
                );
            }
        }

        let shakeTimer: number | undefined;
        let freezeTimer: number | undefined;
        let kickTimer: number | undefined;

        if (shakeDurationMs > 0) {
            setIsShaking(true);
            shakeTimer = window.setTimeout(() => setIsShaking(false), shakeDurationMs);
        }
        if (freezeDurationMs > 0) {
            setIsFrozen(true);
            freezeTimer = window.setTimeout(() => setIsFrozen(false), freezeDurationMs);
        }
        if (kickDurationMs > 0 && (kickOffset.x !== 0 || kickOffset.y !== 0)) {
            setCameraKickOffsetPx(kickOffset);
            kickTimer = window.setTimeout(() => setCameraKickOffsetPx({ x: 0, y: 0 }), kickDurationMs);
        }

        return () => {
            if (shakeTimer) window.clearTimeout(shakeTimer);
            if (freezeTimer) window.clearTimeout(freezeTimer);
            if (kickTimer) window.clearTimeout(kickTimer);
            for (const t of deferredCueTimers) window.clearTimeout(t);
        };
    }, [gameState.visualEvents]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const events = gameState.visualEvents || [];
        if (processedJuiceDebugVisualBatchRef.current === events) return;
        processedJuiceDebugVisualBatchRef.current = events;
        const newEvents = events;
        if (newEvents.length === 0) return;

        const shouldTrace = juiceDebugTraceEnabledRef.current;
        if (!shouldTrace && !juiceDebugOverlayEnabled) return;

        const now = Date.now();
        const additions: JuiceDebugEntry[] = [];

        for (let i = 0; i < newEvents.length; i++) {
            const ev = newEvents[i];
            if (ev.type !== 'juice_signature') continue;
            const payload = ev.payload as JuiceSignaturePayloadV1 | undefined;
            if (!payload || payload.protocol !== 'juice-signature/v1') continue;
            const sequenceId = payload.meta?.sequenceId || `seq-missing-${now}-${i}`;
            const entry: JuiceDebugEntry = {
                id: `${sequenceId}-${i}`,
                sequenceId,
                signature: payload.signature,
                phase: payload.phase,
                primitive: payload.primitive,
                timestamp: now
            };
            additions.push(entry);
            if (shouldTrace) {
                console.debug('[HOP_JUICE_SIG]', {
                    sequenceId,
                    signature: payload.signature,
                    phase: payload.phase,
                    primitive: payload.primitive,
                    family: payload.family,
                    element: payload.element,
                    source: payload.source,
                    target: payload.target,
                    contact: payload.contact
                });
            }
        }

        if (juiceDebugOverlayEnabled && additions.length > 0) {
            setJuiceDebugEntries(prev => [...additions.slice(-8), ...prev].slice(0, 12));
        }
    }, [gameState.visualEvents, juiceDebugOverlayEnabled]);

    const resetBoardJuicePresentation = useCallback(() => {
        setJuiceDebugEntries([]);
        setIsShaking(false);
        setIsFrozen(false);
        setCameraKickOffsetPx({ x: 0, y: 0 });
        setEntityPoseEffects([]);
        setEntityPoseNowMs(0);
        processedCameraCueVisualBatchRef.current = null;
        processedJuiceDebugVisualBatchRef.current = null;
        processedJuicePoseVisualBatchRef.current = null;
        if (poseAnimFrameRef.current !== null) {
            window.cancelAnimationFrame(poseAnimFrameRef.current);
            poseAnimFrameRef.current = null;
        }
    }, []);

    return {
        isShaking,
        isFrozen,
        cameraKickOffsetPx,
        juiceDebugOverlayEnabled,
        juiceDebugEntries,
        entityPoseEffects,
        entityPoseNowMs,
        setEntityPoseEffects,
        setEntityPoseNowMs,
        resetBoardJuicePresentation,
    };
};
