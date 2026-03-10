import { useCallback, useEffect, useRef, useState } from 'react';
import { TILE_SIZE, pointToKey } from '@hop/engine';
import {
    type CameraRect,
    type CameraVec2,
    type CameraZoomPreset,
    clampCameraCenter,
    computeEffectiveScale,
    computeFitScale,
    computePresetScale,
    resolveSoftFollowCenter,
    computeViewBoxFromCamera,
    computeVisibleWorldSize,
    expandRect,
} from '../../visual/camera';
import type {
    CameraViewState,
    DragPointerState,
    PinchPointerState,
    PointerPoint,
    UseBoardCameraArgs,
    UseBoardCameraResult,
} from './board-camera-types';
import { resolveCameraSyncAction } from './board-camera-sync';

export const useBoardCamera = ({
    baseViewBox,
    playerWorld,
    playerPosition,
    mapShape = 'diamond',
    tacticalZoomPreset,
    actionZoomPreset,
    floor,
    cameraSafeInsetsPx,
}: UseBoardCameraArgs): UseBoardCameraResult => {
    const [zoomPreset, setZoomPreset] = useState<CameraZoomPreset>(tacticalZoomPreset);
    const [viewportSizePx, setViewportSizePx] = useState({ width: 0, height: 0 });
    const [isCameraPanning, setIsCameraPanning] = useState(false);

    const svgRef = useRef<SVGSVGElement | null>(null);
    const boardViewportRef = useRef<HTMLDivElement | null>(null);
    const cameraViewRef = useRef<CameraViewState | null>(null);
    const cameraAnimFrameRef = useRef<number | null>(null);
    const cameraPanOffsetRef = useRef<CameraVec2>({ x: 0, y: 0 });
    const isCameraPanningRef = useRef(false);
    const isPinchingRef = useRef(false);
    const suppressTileClickUntilRef = useRef(0);
    const activePointersRef = useRef<Map<number, PointerPoint>>(new Map());
    const dragStateRef = useRef<DragPointerState>({
        activePointerId: null,
        startClient: null,
        lastWorld: null,
        didPan: false,
    });
    const pinchStateRef = useRef<PinchPointerState | null>(null);

    const lastPlayerKeyRef = useRef<string | null>(null);
    const lastCameraFloorRef = useRef<number | null>(null);
    const didInitCameraRef = useRef(false);
    const lastViewportSignatureRef = useRef('');
    const lastBoundsSignatureRef = useRef('');
    const lastZoomPresetRef = useRef<CameraZoomPreset>(tacticalZoomPreset);
    const isAnimatingCameraRef = useRef(false);

    useEffect(() => {
        setZoomPreset(prev => {
            if (prev === tacticalZoomPreset || prev === actionZoomPreset) return prev;
            const distanceToTactical = Math.abs(prev - tacticalZoomPreset);
            const distanceToAction = Math.abs(prev - actionZoomPreset);
            return distanceToAction <= distanceToTactical ? actionZoomPreset : tacticalZoomPreset;
        });
    }, [actionZoomPreset, tacticalZoomPreset]);

    const cancelCameraAnimation = useCallback(() => {
        if (cameraAnimFrameRef.current !== null) {
            window.cancelAnimationFrame(cameraAnimFrameRef.current);
            cameraAnimFrameRef.current = null;
        }
        isAnimatingCameraRef.current = false;
    }, []);

    const applyViewBoxToSvg = useCallback((viewBox: CameraRect) => {
        const svg = svgRef.current;
        if (!svg) return;
        svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
    }, []);

    const commitCameraView = useCallback((next: CameraViewState) => {
        cameraViewRef.current = next;
        applyViewBoxToSvg(next.viewBox);
    }, [applyViewBoxToSvg]);

    const getCameraTarget = useCallback((options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
        softFollow?: {
            currentCenter: CameraVec2;
            deadZoneRatio?: number;
            followStrength?: number;
            maxStepRatio?: number;
        };
    }): CameraViewState => {
        const viewportWidth = Math.max(1, viewportSizePx.width);
        const viewportHeight = Math.max(1, viewportSizePx.height);
        const preset = options?.zoomPreset ?? zoomPreset;
        const panOffset = options?.panOffset ?? cameraPanOffsetRef.current;

        const safeInsets = cameraSafeInsetsPx || {};
        const viewport = {
            width: viewportWidth,
            height: viewportHeight,
            insets: safeInsets
        };

        const isActionView = Math.abs(preset - actionZoomPreset) <= Math.abs(preset - tacticalZoomPreset);
        const basePaddingTiles = mapShape === 'rectangle' ? 0.34 : 0.58;
        const paddingTiles = Math.max(0.16, basePaddingTiles + (isActionView ? -0.12 : 0));
        const paddingWorld = TILE_SIZE * paddingTiles;
        const paddedBounds = expandRect(baseViewBox, paddingWorld);
        // Clamp against a near-tight bounds box so edge camera behavior minimizes empty space.
        const clampPaddingTiles = mapShape === 'rectangle'
            ? (isActionView ? 0.03 : 0.05)
            : (isActionView ? 0.06 : 0.08);
        const clampBounds = expandRect(baseViewBox, TILE_SIZE * clampPaddingTiles);
        const presetScale = computePresetScale(viewport, preset, TILE_SIZE, TILE_SIZE * 0.2);
        const fitScale = computeFitScale(viewport, paddedBounds);
        const scale = computeEffectiveScale(fitScale, presetScale);
        const visibleWorld = computeVisibleWorldSize(viewport, scale);

        const desiredCenter = {
            x: playerWorld.x + panOffset.x,
            y: playerWorld.y + panOffset.y,
        };
        const center = options?.softFollow
            ? resolveSoftFollowCenter({
                currentCenter: options.softFollow.currentCenter,
                desiredCenter,
                visibleWorldSize: visibleWorld,
                bounds: clampBounds,
                deadZoneRatio: options.softFollow.deadZoneRatio,
                followStrength: options.softFollow.followStrength,
                maxStepRatio: options.softFollow.maxStepRatio,
            })
            : clampCameraCenter(desiredCenter, visibleWorld, clampBounds);
        const viewBox = computeViewBoxFromCamera(center, visibleWorld);

        return { center, scale, viewBox };
    }, [
        viewportSizePx.width,
        viewportSizePx.height,
        zoomPreset,
        cameraSafeInsetsPx,
        baseViewBox,
        playerWorld.x,
        playerWorld.y,
        mapShape,
        actionZoomPreset,
        tacticalZoomPreset
    ]);

    const animateCameraTo = useCallback((target: CameraViewState, durationMs = 220) => {
        const current = cameraViewRef.current;
        if (!current) {
            commitCameraView(target);
            return;
        }

        cancelCameraAnimation();
        const startCenter = current.center;
        const startScale = current.scale;
        const targetCenter = target.center;
        const targetScale = target.scale;
        const startedAt = performance.now();
        isAnimatingCameraRef.current = true;

        const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

        const step = (now: number) => {
            const rawT = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
            const t = easeInOutSine(rawT);
            const scale = startScale + (targetScale - startScale) * t;
            const center = {
                x: startCenter.x + (targetCenter.x - startCenter.x) * t,
                y: startCenter.y + (targetCenter.y - startCenter.y) * t,
            };

            const viewport = {
                width: Math.max(1, viewportSizePx.width),
                height: Math.max(1, viewportSizePx.height),
                insets: cameraSafeInsetsPx || {}
            };
            const visibleWorld = computeVisibleWorldSize(viewport, scale);
            const viewBox = computeViewBoxFromCamera(center, visibleWorld);
            commitCameraView({ center, scale, viewBox });

            if (rawT < 1) {
                cameraAnimFrameRef.current = window.requestAnimationFrame(step);
            } else {
                cameraAnimFrameRef.current = null;
                isAnimatingCameraRef.current = false;
                commitCameraView(target);
            }
        };

        cameraAnimFrameRef.current = window.requestAnimationFrame(step);
    }, [cancelCameraAnimation, commitCameraView, viewportSizePx.width, viewportSizePx.height, cameraSafeInsetsPx]);

    const snapCameraToTarget = useCallback((options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
    }) => {
        cancelCameraAnimation();
        commitCameraView(getCameraTarget(options));
    }, [cancelCameraAnimation, commitCameraView, getCameraTarget]);

    const animateCameraToTarget = useCallback((options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
        durationMs?: number;
        softFollow?: boolean;
    }) => {
        const current = cameraViewRef.current;
        const target = getCameraTarget({
            panOffset: options?.panOffset,
            zoomPreset: options?.zoomPreset
        });

        if (current) {
            const delta = Math.hypot(target.center.x - current.center.x, target.center.y - current.center.y);
            const scaleDelta = Math.abs(target.scale - current.scale);
            if (delta < 0.6 && scaleDelta < 1e-4) return;
            if (options?.softFollow) {
                const dynamicDurationMs = Math.max(260, Math.min(420, Math.round(220 + delta * 0.22)));
                animateCameraTo(target, options?.durationMs ?? dynamicDurationMs);
                return;
            }
        }

        animateCameraTo(target, options?.durationMs ?? 220);
    }, [animateCameraTo, getCameraTarget]);

    useEffect(() => {
        const el = boardViewportRef.current;
        if (!el) return;

        const updateSize = () => {
            const rect = el.getBoundingClientRect();
            setViewportSizePx(prev => {
                const width = Math.round(rect.width);
                const height = Math.round(rect.height);
                if (prev.width === width && prev.height === height) return prev;
                return { width, height };
            });
        };

        updateSize();

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', updateSize);
            return () => window.removeEventListener('resize', updateSize);
        }

        const observer = new ResizeObserver(() => updateSize());
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (viewportSizePx.width <= 0 || viewportSizePx.height <= 0) return;

        const boundsSignature = `${baseViewBox.x}:${baseViewBox.y}:${baseViewBox.width}:${baseViewBox.height}`;
        const viewportSignature = `${viewportSizePx.width}:${viewportSizePx.height}:${cameraSafeInsetsPx?.top ?? 0}:${cameraSafeInsetsPx?.right ?? 0}:${cameraSafeInsetsPx?.bottom ?? 0}:${cameraSafeInsetsPx?.left ?? 0}`;
        const playerKey = pointToKey(playerPosition);
        const syncDecision = resolveCameraSyncAction(
            {
                didInit: didInitCameraRef.current,
                lastPlayerKey: lastPlayerKeyRef.current,
                lastCameraFloor: lastCameraFloorRef.current,
                lastViewportSignature: lastViewportSignatureRef.current,
                lastBoundsSignature: lastBoundsSignatureRef.current,
                lastZoomPreset: lastZoomPresetRef.current,
            },
            {
                floor,
                playerKey,
                boundsSignature,
                viewportSignature,
                zoomPreset,
            }
        );

        didInitCameraRef.current = syncDecision.nextRefs.didInit;
        lastPlayerKeyRef.current = syncDecision.nextRefs.lastPlayerKey;
        lastCameraFloorRef.current = syncDecision.nextRefs.lastCameraFloor;
        lastViewportSignatureRef.current = syncDecision.nextRefs.lastViewportSignature;
        lastBoundsSignatureRef.current = syncDecision.nextRefs.lastBoundsSignature;
        lastZoomPresetRef.current = syncDecision.nextRefs.lastZoomPreset;

        if (syncDecision.action === 'init') {
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if (syncDecision.action === 'reset-floor' || syncDecision.action === 'reset-bounds') {
            const zeroPan = { x: 0, y: 0 };
            cameraPanOffsetRef.current = zeroPan;
            snapCameraToTarget({ panOffset: zeroPan });
            return;
        }

        if (syncDecision.action === 'snap-viewport') {
            snapCameraToTarget();
            return;
        }

        if (syncDecision.action === 'animate-zoom') {
            animateCameraToTarget();
            return;
        }

        if (syncDecision.action === 'animate-player') {
            animateCameraToTarget({ durationMs: 320, softFollow: true });
        }
    }, [
        viewportSizePx.width,
        viewportSizePx.height,
        baseViewBox.x,
        baseViewBox.y,
        baseViewBox.width,
        baseViewBox.height,
        cameraSafeInsetsPx,
        floor,
        playerPosition,
        zoomPreset,
        snapCameraToTarget,
        animateCameraToTarget
    ]);

    useEffect(() => () => cancelCameraAnimation(), [cancelCameraAnimation]);

    const updatePanFromWorldDelta = useCallback((deltaWorld: CameraVec2) => {
        const nextPan = {
            x: cameraPanOffsetRef.current.x + deltaWorld.x,
            y: cameraPanOffsetRef.current.y + deltaWorld.y,
        };
        cameraPanOffsetRef.current = nextPan;
        cancelCameraAnimation();
        commitCameraView(getCameraTarget({ panOffset: nextPan }));
    }, [cancelCameraAnimation, commitCameraView, getCameraTarget]);

    const setZoomPresetAnimated = useCallback((nextPreset: CameraZoomPreset) => {
        const normalized = Math.max(1, Math.round(Number(nextPreset) || 1));
        setZoomPreset(prev => (prev === normalized ? prev : normalized));
    }, []);

    const renderedViewBox = cameraViewRef.current?.viewBox || baseViewBox;

    return {
        svgRef,
        boardViewportRef,
        zoomPreset,
        isCameraPanning,
        setIsCameraPanning,
        cameraPanOffsetRef,
        isCameraPanningRef,
        isPinchingRef,
        suppressTileClickUntilRef,
        activePointersRef,
        dragStateRef,
        pinchStateRef,
        cancelCameraAnimation,
        animateCameraToTarget,
        updatePanFromWorldDelta,
        setZoomPresetAnimated,
        renderedViewBox,
    };
};
