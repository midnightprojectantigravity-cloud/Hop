import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
    JuiceDebugEntry,
    PointerPoint,
    UseBoardJuicePresentationArgs,
    UseBoardJuicePresentationResult,
} from './board-juice-presentation-types';
import { buildPoseEffectsFromVisualEvents } from './board-juice-pose-builder';
import { createBoardEntityPoseStore } from './board-entity-pose-store';

export const useBoardJuicePresentation = ({
    gameState,
    boardEventDigest,
}: UseBoardJuicePresentationArgs): UseBoardJuicePresentationResult => {
    const [isShaking, setIsShaking] = useState(false);
    const [isFrozen, setIsFrozen] = useState(false);
    const [cameraKickOffsetPx, setCameraKickOffsetPx] = useState<PointerPoint>({ x: 0, y: 0 });
    const [juiceDebugOverlayEnabled, setJuiceDebugOverlayEnabled] = useState(false);
    const [juiceDebugEntries, setJuiceDebugEntries] = useState<JuiceDebugEntry[]>([]);
    const poseStore = useMemo(() => createBoardEntityPoseStore(), []);

    const processedCameraCueVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuiceDebugVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuicePoseVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
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
        const sourceEvents = boardEventDigest.visualEventsRef;
        if (processedJuicePoseVisualBatchRef.current === sourceEvents) return;
        processedJuicePoseVisualBatchRef.current = sourceEvents;
        const newEvents = boardEventDigest.signatureVisualEvents;
        if (newEvents.length === 0) return;

        const now = Date.now();
        const additions = buildPoseEffectsFromVisualEvents({
            gameState,
            visualEvents: newEvents,
            nowMs: now,
        });

        if (additions.length > 0) {
            poseStore.enqueueEffects(additions);
        }
    }, [
        boardEventDigest.signatureVisualEvents,
        boardEventDigest.visualEventsRef,
        gameState,
        gameState.player,
        gameState.enemies,
        gameState.companions,
        gameState.dyingEntities,
        poseStore,
    ]);

    // Handle camera cues (signature-first, legacy fallback during migration)
    useEffect(() => {
        const sourceEvents = boardEventDigest.visualEventsRef;
        if (processedCameraCueVisualBatchRef.current === sourceEvents) return;
        processedCameraCueVisualBatchRef.current = sourceEvents;
        if (sourceEvents.length === 0) return;

        const cuePlan = boardEventDigest.cameraCuePlan;
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
    }, [boardEventDigest.cameraCuePlan, boardEventDigest.visualEventsRef]);

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const sourceEvents = boardEventDigest.visualEventsRef;
        if (processedJuiceDebugVisualBatchRef.current === sourceEvents) return;
        processedJuiceDebugVisualBatchRef.current = sourceEvents;
        const newEvents = boardEventDigest.juiceDebugPayloads;
        if (newEvents.length === 0) return;

        const shouldTrace = juiceDebugTraceEnabledRef.current;
        if (!shouldTrace && !juiceDebugOverlayEnabled) return;

        const now = Date.now();
        const additions: JuiceDebugEntry[] = [];

        for (let i = 0; i < newEvents.length; i++) {
            const payload = newEvents[i]!;
            const sequenceId = payload.sequenceId || `seq-missing-${now}-${i}`;
            const entry: JuiceDebugEntry = {
                id: `${sequenceId}-${payload.index}`,
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
                });
            }
        }

        if (juiceDebugOverlayEnabled && additions.length > 0) {
            setJuiceDebugEntries(prev => [...additions.slice(-8), ...prev].slice(0, 12));
        }
    }, [boardEventDigest.juiceDebugPayloads, boardEventDigest.visualEventsRef, juiceDebugOverlayEnabled]);

    const resetBoardJuicePresentation = useCallback(() => {
        setJuiceDebugEntries([]);
        setIsShaking(false);
        setIsFrozen(false);
        setCameraKickOffsetPx({ x: 0, y: 0 });
        poseStore.reset();
        processedCameraCueVisualBatchRef.current = null;
        processedJuiceDebugVisualBatchRef.current = null;
        processedJuicePoseVisualBatchRef.current = null;
    }, [poseStore]);

    return {
        isShaking,
        isFrozen,
        cameraKickOffsetPx,
        juiceDebugOverlayEnabled,
        juiceDebugEntries,
        poseStore,
        enqueueEntityPoseEffects: poseStore.enqueueEffects,
        resetBoardJuicePresentation,
    };
};
