import { useCallback, useEffect, useRef, useState } from 'react';
import type { JuiceSignaturePayloadV1 } from '@hop/engine';
import type {
    EntityPoseEffect,
    JuiceDebugEntry,
    PointerPoint,
    UseBoardJuicePresentationArgs,
    UseBoardJuicePresentationResult,
} from './board-juice-presentation-types';
import { buildPoseEffectsFromVisualEvents } from './board-juice-pose-builder';
import { collectCameraCuePlan } from './board-juice-camera-cues';

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
        const additions = buildPoseEffectsFromVisualEvents({
            gameState,
            visualEvents: newEvents,
            nowMs: now,
        });

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

        const cuePlan = collectCameraCuePlan(newEvents);
        const cueTimers: number[] = [];
        const triggerShakeNow = (durationMs: number) => {
            if (durationMs <= 0) return;
            setIsShaking(true);
            cueTimers.push(window.setTimeout(() => setIsShaking(false), durationMs));
        };
        const triggerFreezeNow = (durationMs: number) => {
            if (durationMs <= 0) return;
            setIsFrozen(true);
            cueTimers.push(window.setTimeout(() => setIsFrozen(false), durationMs));
        };
        const triggerKickNow = (offset: PointerPoint, durationMs: number) => {
            if (durationMs <= 0 || (!offset.x && !offset.y)) return;
            setCameraKickOffsetPx(offset);
            cueTimers.push(window.setTimeout(() => setCameraKickOffsetPx({ x: 0, y: 0 }), durationMs));
        };

        for (const deferredCue of cuePlan.deferredCues) {
            cueTimers.push(window.setTimeout(() => {
                if (deferredCue.shakeDurationMs > 0) triggerShakeNow(deferredCue.shakeDurationMs);
                if (deferredCue.freezeDurationMs > 0) triggerFreezeNow(deferredCue.freezeDurationMs);
                if (deferredCue.kickDurationMs > 0) triggerKickNow(deferredCue.kickOffset, deferredCue.kickDurationMs);
            }, deferredCue.delayMs));
        }

        if (cuePlan.shakeDurationMs > 0) {
            triggerShakeNow(cuePlan.shakeDurationMs);
        }
        if (cuePlan.freezeDurationMs > 0) {
            triggerFreezeNow(cuePlan.freezeDurationMs);
        }
        if (cuePlan.kickDurationMs > 0 && (cuePlan.kickOffset.x !== 0 || cuePlan.kickOffset.y !== 0)) {
            triggerKickNow(cuePlan.kickOffset, cuePlan.kickDurationMs);
        }

        return () => {
            for (const timerId of cueTimers) window.clearTimeout(timerId);
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
