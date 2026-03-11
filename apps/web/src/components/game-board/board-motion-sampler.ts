import { hexToPixel, pointToKey, TILE_SIZE, type MovementTrace, type Point } from '@hop/engine';
import type { CameraVec2 } from '../../visual/camera';
import { BOARD_MOTION_TIME_SCALE, MOTION_PROFILES } from './board-motion-profiles';
import { createDefaultPresentationState, getDashStretch, getJumpLiftPx, getJumpScale, getWalkBobPx } from './board-local-motion';
import type { MotionBatch, SampledTraceState } from './board-motion-types';

const lerp = (a: number, b: number, t: number): number => a + ((b - a) * t);
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const toWorld = (point: Point): CameraVec2 => hexToPixel(point, TILE_SIZE);

const normalizePath = (trace: MovementTrace): Point[] => {
    const path = Array.isArray(trace.path) && trace.path.length > 1
        ? trace.path
        : [trace.origin, trace.destination];
    const last = path[path.length - 1];
    if (!last || pointToKey(last) !== pointToKey(trace.destination)) {
        return [...path, trace.destination];
    }
    return path;
};

const samplePathGround = (
    path: Point[],
    progress: number,
    easing: 'linear' | 'easeOut'
): CameraVec2 => {
    const segmentCount = Math.max(1, path.length - 1);
    const scaledProgress = clamp01(progress) * segmentCount;
    const segmentIndex = Math.min(segmentCount - 1, Math.floor(scaledProgress));
    const segmentT = clamp01(scaledProgress - segmentIndex);
    const easedT = easing === 'easeOut' ? easeOutCubic(segmentT) : segmentT;
    const from = toWorld(path[segmentIndex]);
    const to = toWorld(path[Math.min(path.length - 1, segmentIndex + 1)]);
    return {
        x: lerp(from.x, to.x, easedT),
        y: lerp(from.y, to.y, easedT)
    };
};

export const collectRenderableMovementBatch = ({
    visualEvents,
    turnNumber,
    actorPositionById
}: {
    visualEvents: ReadonlyArray<any> | undefined;
    turnNumber: number | undefined;
    actorPositionById: Map<string, Point>;
}): { traces: MovementTrace[]; signature: string } => {
    const traces = (visualEvents || [])
        .filter(event => event.type === 'kinetic_trace')
        .map(event => event.payload as MovementTrace)
        .filter(trace => {
            if (!trace?.actorId || !trace.origin || !trace.destination) return false;
            const actorPosition = actorPositionById.get(trace.actorId);
            return Boolean(actorPosition) && pointToKey(actorPosition as Point) === pointToKey(trace.destination);
        });

    const signature = traces.length === 0
        ? ''
        : `${turnNumber ?? 0}::${traces.map(trace => {
            const path = normalizePath(trace)
                .map(point => pointToKey(point))
                .join('>');
            return [
                trace.actorId,
                pointToKey(trace.origin),
                pointToKey(trace.destination),
                trace.movementType || 'slide',
                trace.presentationKind || 'walk',
                trace.pathStyle || 'hex_step',
                trace.startDelayMs || 0,
                trace.durationMs || 0,
                trace.sequenceId || '',
                path
            ].join('|');
        }).join('||')}`;

    return { traces, signature };
};

export const createMotionBatch = (traces: MovementTrace[], signature: string, startedAtMs: number): MotionBatch => {
    const endAtMs = traces.reduce((maxMs, trace) => {
        const scaledDelayMs = Math.max(0, Math.round((trace.startDelayMs || 0) * BOARD_MOTION_TIME_SCALE));
        const path = normalizePath(trace);
        const baseDurationMs = trace.durationMs || Math.max(110, (path.length - 1) * 110);
        const scaledDurationMs = Math.max(90, Math.round(baseDurationMs * BOARD_MOTION_TIME_SCALE));
        return Math.max(maxMs, startedAtMs + scaledDelayMs + scaledDurationMs);
    }, startedAtMs);

    return {
        traces,
        signature,
        startedAtMs,
        endAtMs
    };
};

export const sampleMovementTrace = (
    trace: MovementTrace,
    startedAtMs: number,
    nowMs: number,
    reducedMotion: boolean
): SampledTraceState => {
    const startDelayMs = Math.max(0, Math.round((trace.startDelayMs || 0) * BOARD_MOTION_TIME_SCALE));
    const path = normalizePath(trace);
    const baseDurationMs = trace.durationMs || Math.max(110, (path.length - 1) * 110);
    const scaledDurationMs = Math.max(90, Math.round(baseDurationMs * BOARD_MOTION_TIME_SCALE));
    const traceStartedAtMs = startedAtMs + startDelayMs;
    const elapsedMs = nowMs - traceStartedAtMs;
    const progress = clamp01(elapsedMs / Math.max(1, scaledDurationMs));
    const presentationKind = trace.presentationKind || (trace.movementType === 'teleport' ? 'teleport' : 'walk');

    if (elapsedMs <= 0) {
        return {
            actorId: trace.actorId,
            presentationKind,
            ...createDefaultPresentationState(toWorld(trace.origin)),
            isComplete: false
        };
    }

    if ((trace.pathStyle || (trace.movementType === 'teleport' ? 'blink' : 'hex_step')) === 'blink') {
        const phase1 = 0.45;
        const phase2 = 0.65;
        const originWorld = toWorld(trace.origin);
        const destinationWorld = toWorld(trace.destination);
        if (progress < phase1) {
            const fadeProgress = progress / phase1;
            return {
                actorId: trace.actorId,
                presentationKind,
                groundWorld: originWorld,
                localOffsetPx: { x: 0, y: 0 },
                scale: { x: 1 - (fadeProgress * 0.08), y: 1 + (fadeProgress * 0.08) },
                opacity: 1 - fadeProgress,
                shadowScale: 1,
                shadowOpacity: 1 - (fadeProgress * 0.35),
                teleportPhase: 'out',
                isComplete: false
            };
        }
        if (progress < phase2) {
            return {
                actorId: trace.actorId,
                presentationKind,
                groundWorld: destinationWorld,
                localOffsetPx: { x: 0, y: 0 },
                scale: { x: 0.96, y: 1.04 },
                opacity: 0,
                shadowScale: 0.94,
                shadowOpacity: 0.45,
                teleportPhase: 'hidden',
                isComplete: false
            };
        }
        const revealProgress = (progress - phase2) / Math.max(1e-6, 1 - phase2);
        return {
            actorId: trace.actorId,
            presentationKind,
            groundWorld: destinationWorld,
            localOffsetPx: { x: 0, y: 0 },
            scale: { x: 0.92 + (revealProgress * 0.08), y: 1.08 - (revealProgress * 0.08) },
            opacity: revealProgress,
            shadowScale: 0.94 + (revealProgress * 0.06),
            shadowOpacity: 0.65 + (revealProgress * 0.35),
            teleportPhase: progress >= 1 ? 'none' : 'in',
            isComplete: progress >= 1
        };
    }

    const easing = MOTION_PROFILES[presentationKind].easing;
    const groundWorld = samplePathGround(path, progress, easing);
    const state = createDefaultPresentationState(groundWorld);

    if (presentationKind === 'walk') {
        state.localOffsetPx = { x: 0, y: -getWalkBobPx(progress) };
    } else if (presentationKind === 'dash') {
        state.scale = getDashStretch(progress);
        state.localOffsetPx = { x: 0, y: -1.5 };
    } else if (presentationKind === 'jump') {
        const liftPx = getJumpLiftPx(progress, reducedMotion);
        state.localOffsetPx = { x: 0, y: -liftPx };
        state.scale = getJumpScale(progress);
        state.shadowScale = 1 - (Math.sin(Math.PI * progress) * 0.08);
        state.shadowOpacity = 0.75 - (Math.sin(Math.PI * progress) * 0.25);
    } else if (presentationKind === 'forced_slide') {
        state.scale = { x: 1.04, y: 0.96 };
    }

    return {
        actorId: trace.actorId,
        presentationKind,
        groundWorld: state.groundWorld,
        localOffsetPx: state.localOffsetPx,
        scale: state.scale,
        opacity: state.opacity,
        shadowScale: state.shadowScale,
        shadowOpacity: state.shadowOpacity,
        teleportPhase: state.teleportPhase,
        isComplete: progress >= 1
    };
};
