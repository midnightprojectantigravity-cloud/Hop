import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { TILE_SIZE, pointToKey, type Point } from '@hop/engine';
import {
    type CameraInsetsPx,
    type CameraRect,
    type CameraVec2,
    type CameraZoomPreset,
    clampCameraCenter,
    computeEffectiveScale,
    computeFitScale,
    computePresetScale,
    computeViewBoxFromCamera,
    computeVisibleWorldSize,
    expandRect,
} from '../../visual/camera';

type CameraViewState = {
    center: CameraVec2;
    scale: number;
    viewBox: CameraRect;
};

type PointerPoint = { x: number; y: number };

type DragPointerState = {
    activePointerId: number | null;
    startClient: PointerPoint | null;
    lastWorld: CameraVec2 | null;
    didPan: boolean;
};

type PinchPointerState = {
    startDistance: number;
    startPreset: CameraZoomPreset;
    appliedPreset: CameraZoomPreset;
};

interface UseBoardCameraArgs {
    baseViewBox: CameraRect;
    playerWorld: { x: number; y: number };
    playerPosition: Point;
    floor: number | undefined;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
}

interface UseBoardCameraResult {
    svgRef: MutableRefObject<SVGSVGElement | null>;
    boardViewportRef: MutableRefObject<HTMLDivElement | null>;
    zoomPreset: CameraZoomPreset;
    isCameraPanning: boolean;
    setIsCameraPanning: React.Dispatch<React.SetStateAction<boolean>>;
    cameraPanOffsetRef: MutableRefObject<CameraVec2>;
    isCameraPanningRef: MutableRefObject<boolean>;
    isPinchingRef: MutableRefObject<boolean>;
    suppressTileClickUntilRef: MutableRefObject<number>;
    activePointersRef: MutableRefObject<Map<number, PointerPoint>>;
    dragStateRef: MutableRefObject<DragPointerState>;
    pinchStateRef: MutableRefObject<PinchPointerState | null>;
    cancelCameraAnimation: () => void;
    animateCameraToTarget: (options?: {
        panOffset?: CameraVec2;
        zoomPreset?: CameraZoomPreset;
        durationMs?: number;
    }) => void;
    updatePanFromWorldDelta: (deltaWorld: CameraVec2) => void;
    setZoomPresetAnimated: (nextPreset: CameraZoomPreset) => void;
    renderedViewBox: CameraRect;
}

export const useBoardCamera = ({
    baseViewBox,
    playerWorld,
    playerPosition,
    floor,
    cameraSafeInsetsPx,
}: UseBoardCameraArgs): UseBoardCameraResult => {
    const [zoomPreset, setZoomPreset] = useState<CameraZoomPreset>(11);
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
    const lastZoomPresetRef = useRef<CameraZoomPreset>(11);
    const isAnimatingCameraRef = useRef(false);

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

        const paddingWorld = TILE_SIZE * 0.75;
        const paddedBounds = expandRect(baseViewBox, paddingWorld);
        const presetScale = computePresetScale(viewport, preset, TILE_SIZE, TILE_SIZE * 0.2);
        const fitScale = computeFitScale(viewport, paddedBounds);
        const scale = computeEffectiveScale(fitScale, presetScale);
        const visibleWorld = computeVisibleWorldSize(viewport, scale);

        const desiredCenter = {
            x: playerWorld.x + panOffset.x,
            y: playerWorld.y + panOffset.y,
        };

        const center = clampCameraCenter(desiredCenter, visibleWorld, paddedBounds);
        const viewBox = computeViewBoxFromCamera(center, visibleWorld);

        return { center, scale, viewBox };
    }, [viewportSizePx.width, viewportSizePx.height, zoomPreset, cameraSafeInsetsPx, baseViewBox, playerWorld.x, playerWorld.y]);

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

        const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

        const step = (now: number) => {
            const rawT = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
            const t = easeOutCubic(rawT);
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
    }) => {
        const target = getCameraTarget(options);
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

        if (!didInitCameraRef.current) {
            didInitCameraRef.current = true;
            lastPlayerKeyRef.current = playerKey;
            lastCameraFloorRef.current = floor ?? null;
            lastViewportSignatureRef.current = viewportSignature;
            lastBoundsSignatureRef.current = boundsSignature;
            lastZoomPresetRef.current = zoomPreset;
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if ((floor ?? null) !== lastCameraFloorRef.current) {
            lastCameraFloorRef.current = floor ?? null;
            lastBoundsSignatureRef.current = boundsSignature;
            lastViewportSignatureRef.current = viewportSignature;
            lastPlayerKeyRef.current = playerKey;
            lastZoomPresetRef.current = zoomPreset;
            cameraPanOffsetRef.current = { x: 0, y: 0 };
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if (floor !== undefined && boundsSignature !== lastBoundsSignatureRef.current) {
            lastBoundsSignatureRef.current = boundsSignature;
            lastViewportSignatureRef.current = viewportSignature;
            lastPlayerKeyRef.current = playerKey;
            lastZoomPresetRef.current = zoomPreset;
            cameraPanOffsetRef.current = { x: 0, y: 0 };
            snapCameraToTarget({ panOffset: { x: 0, y: 0 } });
            return;
        }

        if (viewportSignature !== lastViewportSignatureRef.current) {
            lastViewportSignatureRef.current = viewportSignature;
            lastBoundsSignatureRef.current = boundsSignature;
            snapCameraToTarget();
            return;
        }

        if (zoomPreset !== lastZoomPresetRef.current) {
            lastZoomPresetRef.current = zoomPreset;
            animateCameraToTarget();
            return;
        }

        if (playerKey !== lastPlayerKeyRef.current) {
            lastPlayerKeyRef.current = playerKey;
            const zeroPan = { x: 0, y: 0 };
            cameraPanOffsetRef.current = zeroPan;
            animateCameraToTarget({ panOffset: zeroPan, durationMs: 210 });
            return;
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
        setZoomPreset(prev => (prev === nextPreset ? prev : nextPreset));
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
