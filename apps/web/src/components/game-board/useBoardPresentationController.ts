import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { hexToPixel, TILE_SIZE, type GameState, type Point } from '@hop/engine';
import {
    type CameraInsetsPx,
    type CameraRect,
    type CameraVec2,
    type CameraZoomMode,
    clampCameraCenter,
    computeActionZoomBounds,
    computeCameraViewFromBounds,
    computeDesiredCenterForAnchor,
    computeTacticalZoomBounds,
    computeViewBoxFromCamera,
    resolveCameraAnchorRatio
} from '../../visual/camera';
import { collectRenderableMovementBatch, createMotionBatch, sampleMovementTrace } from './board-motion-sampler';
import { createDefaultPresentationState } from './board-local-motion';
import type { ActorPresentationState, MotionBatch } from './board-motion-types';

interface UseBoardPresentationControllerArgs {
    gameState: GameState;
    baseViewBox: CameraRect;
    visibleTileBounds?: CameraRect | null;
    actorPositionById: Map<string, Point>;
    playerWorld: CameraVec2;
    movementRange: number;
    lineOfSightRange?: number;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
}

const isReducedMotionEnabled = (): boolean => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.dataset.motion === 'reduced';
};

export const useBoardPresentationController = ({
    gameState,
    baseViewBox,
    visibleTileBounds,
    actorPositionById,
    playerWorld,
    movementRange,
    lineOfSightRange,
    cameraSafeInsetsPx,
}: UseBoardPresentationControllerArgs) => {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const boardViewportRef = useRef<HTMLDivElement | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const batchRef = useRef<MotionBatch | null>(null);
    const lastBatchSignatureRef = useRef('');
    const lastActionLogLengthRef = useRef<number | null>(null);
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

    const computeCameraView = useCallback((trackedPlayerWorld: CameraVec2): CameraRect => {
        const viewport = {
            width: Math.max(1, viewportSizePx.width),
            height: Math.max(1, viewportSizePx.height),
            insets: cameraSafeInsetsPx || {}
        };
        const zoomBounds = zoomMode === 'action'
            ? computeActionZoomBounds({
                playerWorld: trackedPlayerWorld,
                movementRange,
                tileSize: TILE_SIZE,
                extraPaddingWorld: TILE_SIZE * 0.15
            })
            : computeTacticalZoomBounds({
                playerWorld: trackedPlayerWorld,
                mapBounds: baseViewBox,
                visibleTileBounds,
                losRange: lineOfSightRange,
                tileSize: TILE_SIZE,
                extraPaddingWorld: TILE_SIZE * 0.15
            });
        const { visibleWorldSize } = computeCameraViewFromBounds(viewport, zoomBounds);
        const center = detachedCenterRef.current
            ? clampCameraCenter(detachedCenterRef.current, visibleWorldSize, baseViewBox)
            : clampCameraCenter(
                computeDesiredCenterForAnchor(
                    trackedPlayerWorld,
                    visibleWorldSize,
                    resolveCameraAnchorRatio(viewport)
                ),
                visibleWorldSize,
                baseViewBox
            );
        if (detachedCenterRef.current) {
            detachedCenterRef.current = center;
        }
        return computeViewBoxFromCamera(center, visibleWorldSize);
    }, [
        viewportSizePx.width,
        viewportSizePx.height,
        cameraSafeInsetsPx,
        zoomMode,
        movementRange,
        baseViewBox,
        visibleTileBounds,
        lineOfSightRange
    ]);

    const commitCameraNow = useCallback((trackedPlayerWorld: CameraVec2) => {
        const nextViewBox = computeCameraView(trackedPlayerWorld);
        applyViewBox(nextViewBox);
    }, [applyViewBox, computeCameraView]);

    const resetPresentation = useCallback(() => {
        cancelPresentationFrame();
        batchRef.current = null;
        setPresentationBusy(false);
        syncStaticActorNodes();
        commitCameraNow(playerWorldRef.current);
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
        commitCameraNow(playerWorldRef.current);
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
        commitCameraNow(playerWorldRef.current);
    }, [beginManualPan, commitCameraNow]);

    const endManualPan = useCallback(() => {
        // no-op, drag state is managed by the interactions hook
    }, []);

    const selectZoomMode = useCallback((mode: CameraZoomMode) => {
        setZoomMode(prev => (prev === mode ? prev : mode));
    }, []);

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
        if (lastActionLogLengthRef.current === null) {
            lastActionLogLengthRef.current = gameState.actionLog?.length ?? 0;
            return;
        }
        const actionLogLength = gameState.actionLog?.length ?? 0;
        if (actionLogLength > lastActionLogLengthRef.current && detachedCenterRef.current) {
            recenter();
        }
        lastActionLogLengthRef.current = actionLogLength;
    }, [gameState.actionLog, recenter]);

    useLayoutEffect(() => {
        detachedCenterRef.current = null;
        setIsDetached(false);
        resetPresentationRef.current();
    }, [
        gameState.floor,
        baseViewBox.x,
        baseViewBox.y,
        baseViewBox.width,
        baseViewBox.height
    ]);

    useEffect(() => {
        if (presentationBusy) return;
        commitCameraNow(playerWorldRef.current);
    }, [zoomMode, visibleTileBounds, baseViewBox, lineOfSightRange, movementRange, presentationBusy, commitCameraNow]);

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
