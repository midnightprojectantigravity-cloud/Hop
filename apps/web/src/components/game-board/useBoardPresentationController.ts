import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { hexToPixel, TILE_SIZE, type GameState, type Point } from '@hop/engine';
import {
    type CameraInsetsPx,
    type CameraRect,
    type CameraVec2,
    type CameraViewportPx,
    type CameraZoomMode,
    type ResponsiveZoomProfile,
    computeActionZoomBounds,
    computeCameraViewFromBounds,
    computeTacticalZoomBounds,
    computeViewBoxFromCamera,
    normalizeInsetsPx,
    resolveResponsiveZoomProfile
} from '../../visual/camera';
import {
    clampCameraCenterToEnvelope,
    estimateCameraDeadSpaceRatio,
    type CameraEnvelope
} from '../../visual/camera-envelope';
import { collectRenderableMovementBatch, createMotionBatch, sampleMovementTrace } from './board-motion-sampler';
import { createDefaultPresentationState } from './board-local-motion';
import type { ActorPresentationState, MotionBatch } from './board-motion-types';

interface UseBoardPresentationControllerArgs {
    gameState: GameState;
    baseViewBox: CameraRect;
    cameraEnvelope: CameraEnvelope;
    actorPositionById: Map<string, Point>;
    playerWorld: CameraVec2;
    movementRange: number;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
}

export interface ResolvedCameraWindow {
    center: CameraVec2;
    scale: number;
    visibleWorldSize: { width: number; height: number };
    viewBox: CameraRect;
    zoomProfile: ResponsiveZoomProfile;
    deadSpaceRatio: number;
}

export const MATERIAL_CAMERA_INSET_DELTA_PX = 8;
export const MATERIAL_CAMERA_VIEWPORT_CHANGE_RATIO = 0.1;

export const hasMaterialCameraViewportChange = (
    prevViewport: { width: number; height: number },
    nextViewport: { width: number; height: number }
): boolean => {
    const prevWidth = Math.max(1, prevViewport.width);
    const prevHeight = Math.max(1, prevViewport.height);
    return Math.abs(nextViewport.width - prevWidth) / prevWidth >= MATERIAL_CAMERA_VIEWPORT_CHANGE_RATIO
        || Math.abs(nextViewport.height - prevHeight) / prevHeight >= MATERIAL_CAMERA_VIEWPORT_CHANGE_RATIO;
};

export const hasMaterialCameraInsetChange = (
    prevInsets: Partial<CameraInsetsPx> | undefined,
    nextInsets: Partial<CameraInsetsPx> | undefined
): boolean => {
    const prev = normalizeInsetsPx(prevInsets);
    const next = normalizeInsetsPx(nextInsets);
    return Math.abs(next.top - prev.top) >= MATERIAL_CAMERA_INSET_DELTA_PX
        || Math.abs(next.right - prev.right) >= MATERIAL_CAMERA_INSET_DELTA_PX
        || Math.abs(next.bottom - prev.bottom) >= MATERIAL_CAMERA_INSET_DELTA_PX
        || Math.abs(next.left - prev.left) >= MATERIAL_CAMERA_INSET_DELTA_PX;
};

export const shouldResetDetachedCamera = ({
    wasDetached,
    prevActionLogLength,
    nextActionLogLength,
    prevFloor,
    nextFloor,
    prevGameStatus,
    nextGameStatus,
    prevZoomMode,
    nextZoomMode,
    prevViewport,
    nextViewport,
    prevInsets,
    nextInsets
}: {
    wasDetached: boolean;
    prevActionLogLength?: number | null;
    nextActionLogLength?: number;
    prevFloor?: number;
    nextFloor?: number;
    prevGameStatus?: string | null;
    nextGameStatus?: string | null;
    prevZoomMode?: CameraZoomMode;
    nextZoomMode?: CameraZoomMode;
    prevViewport?: { width: number; height: number };
    nextViewport?: { width: number; height: number };
    prevInsets?: Partial<CameraInsetsPx>;
    nextInsets?: Partial<CameraInsetsPx>;
}): boolean => {
    if (!wasDetached) return false;
    if (
        typeof prevActionLogLength === 'number'
        && typeof nextActionLogLength === 'number'
        && nextActionLogLength > prevActionLogLength
    ) {
        return true;
    }
    if (
        typeof prevFloor === 'number'
        && typeof nextFloor === 'number'
        && prevFloor !== nextFloor
    ) {
        return true;
    }
    if (
        typeof prevGameStatus === 'string'
        && typeof nextGameStatus === 'string'
        && prevGameStatus !== nextGameStatus
    ) {
        return true;
    }
    if (
        prevZoomMode
        && nextZoomMode
        && prevZoomMode !== nextZoomMode
    ) {
        return true;
    }
    if (
        prevViewport
        && nextViewport
        && hasMaterialCameraViewportChange(prevViewport, nextViewport)
    ) {
        return true;
    }
    if (
        prevInsets
        && nextInsets
        && hasMaterialCameraInsetChange(prevInsets, nextInsets)
    ) {
        return true;
    }
    return false;
};

export const resolveBoardCameraWindow = ({
    viewport,
    zoomMode,
    playerWorld,
    movementRange,
    tileSize,
    mapBounds,
    cameraEnvelope,
    detachedCenter,
    extraPaddingWorld = TILE_SIZE * 0.15
}: {
    viewport: CameraViewportPx;
    zoomMode: CameraZoomMode;
    playerWorld: CameraVec2;
    movementRange: number;
    tileSize: number;
    mapBounds: CameraRect;
    cameraEnvelope: CameraEnvelope;
    detachedCenter?: CameraVec2 | null;
    extraPaddingWorld?: number;
}): ResolvedCameraWindow => {
    const zoomProfile = resolveResponsiveZoomProfile({
        mode: zoomMode,
        viewport,
        tileSize,
        movementRange,
        extraPaddingWorld
    });
    const zoomBounds = zoomMode === 'action'
        ? computeActionZoomBounds({
            playerWorld,
            movementRange,
            tileSize,
            viewport,
            mapBounds,
            extraPaddingWorld
        })
        : computeTacticalZoomBounds({
            playerWorld,
            movementRange,
            mapBounds,
            tileSize,
            viewport,
            extraPaddingWorld
        });
    const { scale, visibleWorldSize } = computeCameraViewFromBounds(viewport, zoomBounds);
    const desiredCenter = detachedCenter || playerWorld;
    const center = clampCameraCenterToEnvelope(desiredCenter, visibleWorldSize, cameraEnvelope, mapBounds);
    const viewBox = computeViewBoxFromCamera(center, visibleWorldSize);

    return {
        center,
        scale,
        visibleWorldSize,
        viewBox,
        zoomProfile,
        deadSpaceRatio: estimateCameraDeadSpaceRatio(viewBox, cameraEnvelope)
    };
};

const isReducedMotionEnabled = (): boolean => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.motion === 'reduced';
};

export const useBoardPresentationController = ({
    gameState,
    baseViewBox,
    cameraEnvelope,
    actorPositionById,
    playerWorld,
    movementRange,
    cameraSafeInsetsPx,
}: UseBoardPresentationControllerArgs) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const boardViewportRef = useRef<HTMLDivElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const batchRef = useRef<MotionBatch | null>(null);
    const lastBatchSignatureRef = useRef('');
    const lastActionLogLengthRef = useRef<number | null>(null);
    const previousGameStatusRef = useRef<string | null>(null);
    const previousViewportRef = useRef<{ width: number; height: number } | null>(null);
    const previousInsetsRef = useRef<CameraInsetsPx | null>(null);
    const cameraViewRef = useRef<CameraRect>(baseViewBox);
    const detachedCenterRef = useRef<CameraVec2 | null>(null);
    const [viewportSizePx, setViewportSizePx] = useState({ width: 0, height: 0 });
    const [zoomMode, setZoomMode] = useState<CameraZoomMode>('tactical');
    const [isDetached, setIsDetached] = useState(false);
    const [presentationBusy, setPresentationBusy] = useState(false);
    const actorPositionByIdRef = useRef(actorPositionById);
    const playerWorldRef = useRef(playerWorld);
    const resetPresentationRef = useRef<() => void>(() => undefined);

    useEffect(() => {
        actorPositionByIdRef.current = actorPositionById;
    }, [actorPositionById]);

    useEffect(() => {
        playerWorldRef.current = playerWorld;
    }, [playerWorld]);

    const { traces, signature } = useMemo(() => collectRenderableMovementBatch({
        visualEvents: gameState.visualEvents,
        turnNumber: gameState.turnNumber,
        actorPositionById
    }), [gameState.turnNumber, gameState.visualEvents, actorPositionById]);

    const cancelPresentationFrame = useCallback(() => {
        if (animationFrameRef.current !== null) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }
    }, []);

    const applyViewBox = useCallback((viewBox: CameraRect) => {
        cameraViewRef.current = viewBox;
        const svg = svgRef.current;
        if (svg) {
            svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
        }
    }, []);

    const applyCameraDebugAttributes = useCallback((windowState: ResolvedCameraWindow, nextDetached: boolean) => {
        if (!import.meta.env.DEV) return;
        const viewport = boardViewportRef.current;
        if (!viewport) return;
        viewport.dataset.cameraMode = windowState.zoomProfile.mode;
        viewport.dataset.cameraPreset = String(windowState.zoomProfile.preset);
        viewport.dataset.cameraDeadSpaceRatio = windowState.deadSpaceRatio.toFixed(3);
        viewport.dataset.cameraDetached = nextDetached ? 'true' : 'false';
    }, []);

    const applyActorPresentation = useCallback((actorId: string, state: ActorPresentationState) => {
        const svg = svgRef.current;
        if (!svg) return;
        const actorNode = svg.querySelector<SVGGElement>(`[data-actor-node="${actorId}"]`);
        const motionNode = svg.querySelector<SVGGElement>(`[data-actor-motion-node="${actorId}"]`);
        const padNode = svg.querySelector<SVGGElement>(`[data-actor-pad-node="${actorId}"]`);
        if (actorNode) {
            actorNode.style.transform = `translate(${state.groundWorld.x}px, ${state.groundWorld.y}px)`;
        }
        if (motionNode) {
            motionNode.style.transform = `translate(${state.localOffsetPx.x}px, ${state.localOffsetPx.y}px) scale(${state.scale.x}, ${state.scale.y})`;
            motionNode.style.opacity = `${state.opacity}`;
            motionNode.dataset.teleportPhase = state.teleportPhase;
        }
        if (padNode) {
            padNode.style.transform = `scale(${state.shadowScale})`;
            padNode.style.opacity = `${state.shadowOpacity}`;
        }
    }, []);

    const syncStaticActorNodes = useCallback(() => {
        actorPositionByIdRef.current.forEach((position, actorId) => {
            applyActorPresentation(actorId, createDefaultPresentationState(hexToPixel(position, TILE_SIZE)));
        });
    }, [applyActorPresentation]);

    const computeCameraWindow = useCallback((
        trackedPlayerWorld: CameraVec2,
        overrides?: { zoomMode?: CameraZoomMode; detachedCenter?: CameraVec2 | null }
    ): ResolvedCameraWindow => {
        const hasDetachedOverride = Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, 'detachedCenter'));
        return resolveBoardCameraWindow({
            viewport: {
                width: Math.max(1, viewportSizePx.width),
                height: Math.max(1, viewportSizePx.height),
                insets: cameraSafeInsetsPx || {}
            },
            zoomMode: overrides?.zoomMode ?? zoomMode,
            playerWorld: trackedPlayerWorld,
            movementRange,
            tileSize: TILE_SIZE,
            mapBounds: baseViewBox,
            cameraEnvelope,
            detachedCenter: hasDetachedOverride ? overrides?.detachedCenter ?? null : detachedCenterRef.current
        });
    }, [
        viewportSizePx.width,
        viewportSizePx.height,
        cameraSafeInsetsPx,
        zoomMode,
        movementRange,
        baseViewBox,
        cameraEnvelope
    ]);

    const commitCameraNow = useCallback((
        trackedPlayerWorld: CameraVec2,
        overrides?: { zoomMode?: CameraZoomMode; detachedCenter?: CameraVec2 | null }
    ) => {
        const nextWindow = computeCameraWindow(trackedPlayerWorld, overrides);
        const hasDetachedOverride = Boolean(overrides && Object.prototype.hasOwnProperty.call(overrides, 'detachedCenter'));
        const resolvedDetachedCenter = hasDetachedOverride
            ? overrides?.detachedCenter ?? null
            : detachedCenterRef.current;
        const nextDetached = Boolean(resolvedDetachedCenter);
        if (nextDetached) {
            detachedCenterRef.current = nextWindow.center;
        } else {
            detachedCenterRef.current = null;
        }
        applyViewBox(nextWindow.viewBox);
        applyCameraDebugAttributes(nextWindow, nextDetached);
    }, [applyCameraDebugAttributes, applyViewBox, computeCameraWindow]);

    const resetPresentation = useCallback(() => {
        cancelPresentationFrame();
        batchRef.current = null;
        setPresentationBusy(false);
        syncStaticActorNodes();
        commitCameraNow(playerWorldRef.current, { detachedCenter: detachedCenterRef.current });
    }, [cancelPresentationFrame, syncStaticActorNodes, commitCameraNow]);

    useEffect(() => {
        resetPresentationRef.current = resetPresentation;
    }, [resetPresentation]);

    const renderBatchFrame = useCallback((nowMs: number) => {
        const batch = batchRef.current;
        if (!batch) return;

        const reducedMotion = isReducedMotionEnabled();
        const sampledStates = new Map<string, ActorPresentationState>();
        for (const trace of batch.traces) {
            const sampled = sampleMovementTrace(trace, batch.startedAtMs, nowMs, reducedMotion);
            sampledStates.set(trace.actorId, {
                groundWorld: sampled.groundWorld,
                localOffsetPx: sampled.localOffsetPx,
                scale: sampled.scale,
                opacity: sampled.opacity,
                shadowScale: sampled.shadowScale,
                shadowOpacity: sampled.shadowOpacity,
                teleportPhase: sampled.teleportPhase
            });
        }

        actorPositionByIdRef.current.forEach((position, actorId) => {
            const state = sampledStates.get(actorId) || createDefaultPresentationState(hexToPixel(position, TILE_SIZE));
            applyActorPresentation(actorId, state);
        });

        const playerState = sampledStates.get(gameState.player.id);
        commitCameraNow(playerState?.groundWorld || playerWorldRef.current);

        if (nowMs < batch.endAtMs) {
            animationFrameRef.current = window.requestAnimationFrame(renderBatchFrame);
            return;
        }

        batchRef.current = null;
        animationFrameRef.current = null;
        setPresentationBusy(false);
        syncStaticActorNodes();
        commitCameraNow(playerWorldRef.current);
    }, [
        applyActorPresentation,
        commitCameraNow,
        gameState.player.id,
        syncStaticActorNodes
    ]);

    const startBatch = useCallback((nextSignature: string) => {
        cancelPresentationFrame();
        batchRef.current = createMotionBatch(traces, nextSignature, performance.now());
        lastBatchSignatureRef.current = nextSignature;
        setPresentationBusy(true);
        animationFrameRef.current = window.requestAnimationFrame(renderBatchFrame);
    }, [cancelPresentationFrame, renderBatchFrame, traces]);

    const recenter = useCallback(() => {
        detachedCenterRef.current = null;
        setIsDetached(false);
        commitCameraNow(playerWorldRef.current, { detachedCenter: null });
    }, [commitCameraNow]);

    const beginManualPan = useCallback(() => {
        if (!detachedCenterRef.current) {
            const currentView = cameraViewRef.current;
            detachedCenterRef.current = {
                x: currentView.x + (currentView.width / 2),
                y: currentView.y + (currentView.height / 2)
            };
        }
        setIsDetached(true);
    }, []);

    const panByWorldDelta = useCallback((deltaWorld: CameraVec2) => {
        beginManualPan();
        detachedCenterRef.current = {
            x: (detachedCenterRef.current?.x || playerWorldRef.current.x) + deltaWorld.x,
            y: (detachedCenterRef.current?.y || playerWorldRef.current.y) + deltaWorld.y
        };
        commitCameraNow(playerWorldRef.current, { detachedCenter: detachedCenterRef.current });
    }, [beginManualPan, commitCameraNow]);

    const endManualPan = useCallback(() => {
        // no-op, drag state is managed by the interactions hook
    }, []);

    const selectZoomMode = useCallback((mode: CameraZoomMode) => {
        if (zoomMode === mode) return;
        if (shouldResetDetachedCamera({
            wasDetached: Boolean(detachedCenterRef.current),
            prevZoomMode: zoomMode,
            nextZoomMode: mode
        })) {
            detachedCenterRef.current = null;
            setIsDetached(false);
        }
        setZoomMode(mode);
        commitCameraNow(playerWorldRef.current, {
            zoomMode: mode,
            detachedCenter: detachedCenterRef.current
        });
    }, [commitCameraNow, zoomMode]);

    useEffect(() => {
        const element = boardViewportRef.current;
        if (!element) return undefined;

        const updateViewport = () => {
            const rect = element.getBoundingClientRect();
            setViewportSizePx({
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            });
        };

        updateViewport();
        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateViewport);
            return () => window.removeEventListener('resize', updateViewport);
        }

        const observer = new ResizeObserver(updateViewport);
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    useLayoutEffect(() => {
        if (viewportSizePx.width <= 0 || viewportSizePx.height <= 0) return;
        syncStaticActorNodes();
        commitCameraNow(playerWorldRef.current);
    }, [viewportSizePx.width, viewportSizePx.height, syncStaticActorNodes, commitCameraNow]);

    useEffect(() => {
        if (!signature) {
            lastBatchSignatureRef.current = '';
            if (!batchRef.current) {
                setPresentationBusy(false);
            }
            return;
        }
        if (signature === lastBatchSignatureRef.current) return;
        startBatch(signature);
    }, [signature, startBatch]);

    useEffect(() => {
        const actionLogLength = gameState.actionLog?.length ?? 0;
        if (lastActionLogLengthRef.current === null) {
            lastActionLogLengthRef.current = actionLogLength;
            return;
        }
        if (shouldResetDetachedCamera({
            wasDetached: Boolean(detachedCenterRef.current),
            prevActionLogLength: lastActionLogLengthRef.current,
            nextActionLogLength: actionLogLength
        })) {
            recenter();
        }
        lastActionLogLengthRef.current = actionLogLength;
    }, [gameState.actionLog, recenter]);

    useEffect(() => {
        if (previousGameStatusRef.current === null) {
            previousGameStatusRef.current = gameState.gameStatus;
            return;
        }
        if (shouldResetDetachedCamera({
            wasDetached: Boolean(detachedCenterRef.current),
            prevGameStatus: previousGameStatusRef.current,
            nextGameStatus: gameState.gameStatus
        })) {
            recenter();
        }
        previousGameStatusRef.current = gameState.gameStatus;
    }, [gameState.gameStatus, recenter]);

    useEffect(() => {
        const nextViewport = {
            width: viewportSizePx.width,
            height: viewportSizePx.height
        };
        const nextInsets = normalizeInsetsPx(cameraSafeInsetsPx);
        if (
            previousViewportRef.current
            && previousInsetsRef.current
            && shouldResetDetachedCamera({
                wasDetached: Boolean(detachedCenterRef.current),
                prevViewport: previousViewportRef.current,
                nextViewport,
                prevInsets: previousInsetsRef.current,
                nextInsets
            })
        ) {
            recenter();
        }
        previousViewportRef.current = nextViewport;
        previousInsetsRef.current = nextInsets;
    }, [
        viewportSizePx.width,
        viewportSizePx.height,
        cameraSafeInsetsPx?.top,
        cameraSafeInsetsPx?.right,
        cameraSafeInsetsPx?.bottom,
        cameraSafeInsetsPx?.left,
        recenter
    ]);

    useLayoutEffect(() => {
        detachedCenterRef.current = null;
        setIsDetached(false);
        resetPresentationRef.current();
    }, [
        gameState.floor,
        gameState.gameStatus,
        baseViewBox.x,
        baseViewBox.y,
        baseViewBox.width,
        baseViewBox.height
    ]);

    useEffect(() => {
        if (presentationBusy) return;
        commitCameraNow(playerWorldRef.current);
    }, [
        zoomMode,
        baseViewBox,
        cameraEnvelope,
        movementRange,
        presentationBusy,
        cameraSafeInsetsPx?.top,
        cameraSafeInsetsPx?.right,
        cameraSafeInsetsPx?.bottom,
        cameraSafeInsetsPx?.left,
        commitCameraNow
    ]);

    useEffect(() => () => cancelPresentationFrame(), [cancelPresentationFrame]);

    return {
        svgRef,
        boardViewportRef,
        presentationBusy,
        cameraState: {
            zoomMode,
            isDetached
        },
        beginManualPan,
        panByWorldDelta,
        endManualPan,
        selectZoomMode,
        recenter,
        resetPresentation
    };
};
