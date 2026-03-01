import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, type MovementTrace, type Point } from '@hop/engine';

interface UseMovementTracePlaybackArgs {
    visualEvents: ReadonlyArray<any> | undefined;
    turnNumber: number | undefined;
    actorPositionById: Map<string, Point>;
    svgRef: MutableRefObject<SVGSVGElement | null>;
    cancelCameraAnimation: () => void;
}

export const useMovementTracePlayback = ({
    visualEvents,
    turnNumber,
    actorPositionById,
    svgRef,
    cancelCameraAnimation,
}: UseMovementTracePlaybackArgs) => {
    const [movementBusy, setMovementBusy] = useState(false);
    const movementQueueRef = useRef<MovementTrace[]>([]);
    const runningMovementRef = useRef(false);
    const activeAnimationsRef = useRef<Animation[]>([]);
    const runTokenRef = useRef(0);
    const lastMovementBatchSignatureRef = useRef('');

    const kineticTraces = useMemo(() => {
        return (visualEvents || [])
            .filter(ev => ev.type === 'kinetic_trace')
            .map(ev => ev.payload as MovementTrace)
            .filter(trace => {
                if (!trace?.actorId || !trace.origin || !trace.destination) return false;
                const actorPos = actorPositionById.get(trace.actorId);
                // Reject stale traces that do not match current actor snapshot.
                return !!actorPos && pointToKey(actorPos) === pointToKey(trace.destination);
            });
    }, [visualEvents, actorPositionById]);

    const movementBatchSignature = useMemo(() => {
        if (!kineticTraces.length) return '';
        const turn = turnNumber ?? 0;
        const traceSig = kineticTraces.map(trace => {
            const pathSig = (trace.path || [])
                .map(p => `${p.q},${p.r},${p.s}`)
                .join('>');
            return [
                trace.actorId,
                `${trace.origin.q},${trace.origin.r},${trace.origin.s}`,
                `${trace.destination.q},${trace.destination.r},${trace.destination.s}`,
                trace.movementType || 'slide',
                trace.startDelayMs || 0,
                trace.durationMs || 0,
                pathSig
            ].join('|');
        }).join('||');
        return `${turn}::${traceSig}`;
    }, [kineticTraces, turnNumber]);

    const runKeyframedAnimation = useCallback(async (
        node: Element,
        keyframes: Keyframe[],
        options: KeyframeAnimationOptions,
        token: number
    ) => {
        if (token !== runTokenRef.current) return;
        const animation = node.animate(keyframes, {
            ...options,
            fill: options.fill ?? 'forwards'
        });
        activeAnimationsRef.current.push(animation);
        try {
            await animation.finished;
        } catch {
            // Ignore canceled animation rejections.
        } finally {
            activeAnimationsRef.current = activeAnimationsRef.current.filter(a => a !== animation);
        }
    }, []);

    const runMovementTrace = useCallback(async (trace: MovementTrace, token: number, batchStartMs: number) => {
        if (token !== runTokenRef.current) return;
        const playbackScale = 0.76;
        const node = svgRef.current?.querySelector(`[data-actor-node="${trace.actorId}"]`) as SVGElement | null;
        const toAbsoluteTransform = (p: Point) => {
            const px = hexToPixel(p, TILE_SIZE);
            return `translate(${px.x}px, ${px.y}px)`;
        };
        const startDelayMs = Math.max(0, trace.startDelayMs || 0);
        const elapsedSinceBatchStart = Math.max(0, performance.now() - batchStartMs);
        const scaledStartDelayMs = Math.round(startDelayMs * playbackScale);
        const effectiveDelayMs = Math.max(0, scaledStartDelayMs - elapsedSinceBatchStart);

        const path = (trace.path && trace.path.length > 1)
            ? trace.path
            : [trace.origin, trace.destination];
        const segmentCount = Math.max(1, path.length - 1);
        const slideDurationMs = Math.max(90, Math.round((trace.durationMs || segmentCount * 110) * playbackScale));

        if (!node) {
            const fallback = Math.max(0, effectiveDelayMs + slideDurationMs);
            if (fallback > 0) {
                await new Promise<void>(resolve => window.setTimeout(resolve, fallback));
            }
            return;
        }

        if (effectiveDelayMs > 0) {
            await new Promise<void>(resolve => window.setTimeout(resolve, effectiveDelayMs));
            if (token !== runTokenRef.current) return;
        }

        if ((trace.movementType || 'slide') === 'teleport') {
            const duration = Math.max(100, Math.round((trace.durationMs || 180) * playbackScale));
            await runKeyframedAnimation(node, [
                { transform: toAbsoluteTransform(trace.origin), opacity: 1, offset: 0 },
                { transform: toAbsoluteTransform(trace.origin), opacity: 0, offset: 0.45 },
                { transform: toAbsoluteTransform(trace.destination), opacity: 0, offset: 0.55 },
                { transform: toAbsoluteTransform(trace.destination), opacity: 1, offset: 1 }
            ], { duration, easing: 'linear' }, token);
            if (token === runTokenRef.current) {
                node.style.transform = toAbsoluteTransform(trace.destination);
                node.style.opacity = '1';
            }
            return;
        }

        const normalizedPath = [...path];
        const last = normalizedPath[normalizedPath.length - 1];
        if (!last || last.q !== trace.destination.q || last.r !== trace.destination.r || last.s !== trace.destination.s) {
            normalizedPath.push(trace.destination);
        }

        const keyframes: Keyframe[] = normalizedPath.map((p, idx) => ({
            transform: toAbsoluteTransform(p),
            offset: normalizedPath.length === 1 ? 1 : idx / (normalizedPath.length - 1)
        }));
        keyframes[keyframes.length - 1] = {
            ...keyframes[keyframes.length - 1],
            transform: toAbsoluteTransform(trace.destination),
            offset: 1
        };

        await runKeyframedAnimation(node, keyframes, {
            duration: slideDurationMs,
            easing: 'linear'
        }, token);
        if (token === runTokenRef.current) {
            node.style.transform = toAbsoluteTransform(trace.destination);
            node.style.opacity = '1';
        }
    }, [runKeyframedAnimation, svgRef]);

    const runMovementQueue = useCallback(async () => {
        if (runningMovementRef.current) return;
        runningMovementRef.current = true;
        setMovementBusy(true);
        const token = ++runTokenRef.current;
        const batchStartMs = performance.now();
        try {
            while (movementQueueRef.current.length > 0 && token === runTokenRef.current) {
                const trace = movementQueueRef.current.shift();
                if (!trace) continue;
                await runMovementTrace(trace, token, batchStartMs);
            }
        } finally {
            if (token === runTokenRef.current) {
                runningMovementRef.current = false;
                setMovementBusy(false);
            }
        }
    }, [runMovementTrace]);

    useEffect(() => {
        if (!movementBatchSignature) {
            lastMovementBatchSignatureRef.current = '';
            return;
        }
        if (movementBatchSignature === lastMovementBatchSignatureRef.current) return;
        lastMovementBatchSignatureRef.current = movementBatchSignature;
        movementQueueRef.current.push(...kineticTraces);
        void runMovementQueue();
    }, [movementBatchSignature, kineticTraces, runMovementQueue]);

    const resetMovementPlayback = useCallback((resetSignature = true) => {
        runTokenRef.current++;
        movementQueueRef.current = [];
        runningMovementRef.current = false;
        activeAnimationsRef.current.forEach(anim => {
            try { anim.cancel(); } catch { /* no-op */ }
        });
        activeAnimationsRef.current = [];
        setMovementBusy(false);
        if (resetSignature) {
            lastMovementBatchSignatureRef.current = '';
        }
    }, []);

    useEffect(() => {
        return () => {
            cancelCameraAnimation();
            resetMovementPlayback(false);
        };
    }, [cancelCameraAnimation, resetMovementPlayback]);

    return {
        movementBusy,
        resetMovementPlayback,
    };
};
