import { useCallback, type Dispatch, type MutableRefObject, type PointerEvent, type SetStateAction, type WheelEvent } from 'react';
import type { Point } from '@hop/engine';
import type { CameraVec2, CameraZoomPreset } from '../../visual/camera';

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

interface UseBoardInteractionsArgs {
    svgRef: MutableRefObject<SVGSVGElement | null>;
    onMove: (hex: Point) => void;
    zoomPreset: CameraZoomPreset;
    setHoveredTile: Dispatch<SetStateAction<Point | null>>;
    setIsCameraPanning: Dispatch<SetStateAction<boolean>>;
    cameraPanOffsetRef: MutableRefObject<CameraVec2>;
    isCameraPanningRef: MutableRefObject<boolean>;
    isPinchingRef: MutableRefObject<boolean>;
    suppressTileClickUntilRef: MutableRefObject<number>;
    activePointersRef: MutableRefObject<Map<number, PointerPoint>>;
    dragStateRef: MutableRefObject<DragPointerState>;
    pinchStateRef: MutableRefObject<PinchPointerState | null>;
    animateCameraToTarget: (opts: { panOffset: CameraVec2; durationMs: number }) => void;
    updatePanFromWorldDelta: (deltaWorld: CameraVec2) => void;
    setZoomPresetAnimated: (nextPreset: CameraZoomPreset) => void;
}

export const useBoardInteractions = ({
    svgRef,
    onMove,
    zoomPreset,
    setHoveredTile,
    setIsCameraPanning,
    cameraPanOffsetRef,
    isCameraPanningRef,
    isPinchingRef,
    suppressTileClickUntilRef,
    activePointersRef,
    dragStateRef,
    pinchStateRef,
    animateCameraToTarget,
    updatePanFromWorldDelta,
    setZoomPresetAnimated,
}: UseBoardInteractionsArgs) => {
    const clientToWorld = useCallback((clientX: number, clientY: number): CameraVec2 | null => {
        const svg = svgRef.current;
        if (!svg || !svg.getScreenCTM) return null;
        const ctm = svg.getScreenCTM();
        if (!ctm) return null;
        const point = svg.createSVGPoint();
        point.x = clientX;
        point.y = clientY;
        const transformed = point.matrixTransform(ctm.inverse());
        return { x: transformed.x, y: transformed.y };
    }, [svgRef]);

    const handleResetView = useCallback(() => {
        cameraPanOffsetRef.current = { x: 0, y: 0 };
        animateCameraToTarget({ panOffset: { x: 0, y: 0 }, durationMs: 220 });
    }, [animateCameraToTarget, cameraPanOffsetRef]);

    const handleTileClick = useCallback((hex: Point) => {
        if (Date.now() < suppressTileClickUntilRef.current) return;
        onMove(hex);
    }, [onMove, suppressTileClickUntilRef]);

    const handleHoverTile = useCallback((hex: Point) => {
        if (isCameraPanningRef.current || isPinchingRef.current) return;
        setHoveredTile(hex);
    }, [isCameraPanningRef, isPinchingRef, setHoveredTile]);

    const getActivePointerList = useCallback(() => Array.from(activePointersRef.current.entries()), [activePointersRef]);

    const handleBoardPointerDown = useCallback((e: PointerEvent<SVGSVGElement>) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (e.pointerType !== 'mouse') {
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
                // Pointer capture is optional across browsers.
            }
        }

        const pointers = getActivePointerList();
        if (pointers.length >= 2) {
            isPinchingRef.current = true;
            isCameraPanningRef.current = false;
            setIsCameraPanning(false);
            dragStateRef.current.didPan = true;
            suppressTileClickUntilRef.current = Date.now() + 250;

            const [a, b] = pointers;
            const dx = a[1].x - b[1].x;
            const dy = a[1].y - b[1].y;
            pinchStateRef.current = {
                startDistance: Math.hypot(dx, dy),
                startPreset: zoomPreset,
                appliedPreset: zoomPreset
            };
            return;
        }

        dragStateRef.current = {
            activePointerId: e.pointerId,
            startClient: { x: e.clientX, y: e.clientY },
            lastWorld: clientToWorld(e.clientX, e.clientY),
            didPan: false
        };
    }, [
        activePointersRef,
        clientToWorld,
        dragStateRef,
        getActivePointerList,
        isCameraPanningRef,
        isPinchingRef,
        pinchStateRef,
        setIsCameraPanning,
        suppressTileClickUntilRef,
        zoomPreset
    ]);

    const handleBoardPointerMove = useCallback((e: PointerEvent<SVGSVGElement>) => {
        if (!activePointersRef.current.has(e.pointerId)) return;
        activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

        const pointers = getActivePointerList();
        if (isPinchingRef.current || pointers.length >= 2) {
            if (pointers.length >= 2) {
                isPinchingRef.current = true;
                const [a, b] = pointers;
                const dx = a[1].x - b[1].x;
                const dy = a[1].y - b[1].y;
                const distance = Math.max(1, Math.hypot(dx, dy));
                if (!pinchStateRef.current) {
                    pinchStateRef.current = {
                        startDistance: distance,
                        startPreset: zoomPreset,
                        appliedPreset: zoomPreset
                    };
                } else {
                    const ratio = distance / Math.max(1, pinchStateRef.current.startDistance);
                    let nextPreset = pinchStateRef.current.startPreset;
                    if (ratio > 1.08) nextPreset = 7;
                    if (ratio < 0.92) nextPreset = 11;
                    if (nextPreset !== pinchStateRef.current.appliedPreset) {
                        pinchStateRef.current.appliedPreset = nextPreset;
                        setZoomPresetAnimated(nextPreset);
                    }
                }
                suppressTileClickUntilRef.current = Date.now() + 250;
                e.preventDefault();
            }
            return;
        }

        const drag = dragStateRef.current;
        if (!drag.startClient || drag.activePointerId !== e.pointerId) return;

        const dxPx = e.clientX - drag.startClient.x;
        const dyPx = e.clientY - drag.startClient.y;
        const movedPx = Math.hypot(dxPx, dyPx);
        const thresholdPx = 10;

        if (!drag.didPan && movedPx > thresholdPx) {
            drag.didPan = true;
            isCameraPanningRef.current = true;
            setIsCameraPanning(true);
            suppressTileClickUntilRef.current = Date.now() + 250;
            setHoveredTile(null);
        }

        if (!drag.didPan) return;

        const currentWorld = clientToWorld(e.clientX, e.clientY);
        if (!drag.lastWorld || !currentWorld) return;
        const deltaWorld = {
            x: drag.lastWorld.x - currentWorld.x,
            y: drag.lastWorld.y - currentWorld.y
        };
        drag.lastWorld = currentWorld;
        updatePanFromWorldDelta(deltaWorld);
        e.preventDefault();
    }, [
        activePointersRef,
        clientToWorld,
        dragStateRef,
        getActivePointerList,
        isCameraPanningRef,
        isPinchingRef,
        pinchStateRef,
        setHoveredTile,
        setIsCameraPanning,
        setZoomPresetAnimated,
        suppressTileClickUntilRef,
        updatePanFromWorldDelta,
        zoomPreset
    ]);

    const endPointerInteraction = useCallback((pointerId: number) => {
        activePointersRef.current.delete(pointerId);
        const pointers = getActivePointerList();

        if (pointers.length < 2) {
            isPinchingRef.current = false;
            pinchStateRef.current = null;
        }

        const drag = dragStateRef.current;
        if (drag.activePointerId === pointerId) {
            if (drag.didPan) {
                suppressTileClickUntilRef.current = Date.now() + 250;
            }
            dragStateRef.current = {
                activePointerId: pointers[0]?.[0] ?? null,
                startClient: pointers[0] ? { ...pointers[0][1] } : null,
                lastWorld: pointers[0] ? clientToWorld(pointers[0][1].x, pointers[0][1].y) : null,
                didPan: false
            };
        }

        if (activePointersRef.current.size === 0) {
            isCameraPanningRef.current = false;
            setIsCameraPanning(false);
        }
    }, [
        activePointersRef,
        clientToWorld,
        dragStateRef,
        getActivePointerList,
        isCameraPanningRef,
        isPinchingRef,
        pinchStateRef,
        setIsCameraPanning,
        suppressTileClickUntilRef
    ]);

    const handleBoardPointerUp = useCallback((e: PointerEvent<SVGSVGElement>) => {
        endPointerInteraction(e.pointerId);
        try {
            e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
            // no-op
        }
    }, [endPointerInteraction]);

    const handleBoardPointerCancel = useCallback((e: PointerEvent<SVGSVGElement>) => {
        endPointerInteraction(e.pointerId);
    }, [endPointerInteraction]);

    const handleBoardWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
        if (e.ctrlKey || e.deltaY !== 0) {
            e.preventDefault();
        }
        if (Math.abs(e.deltaY) < 0.1) return;
        const nextPreset: CameraZoomPreset = e.deltaY < 0 ? 7 : 11;
        setZoomPresetAnimated(nextPreset);
        suppressTileClickUntilRef.current = Date.now() + 120;
    }, [setZoomPresetAnimated, suppressTileClickUntilRef]);

    return {
        handleResetView,
        handleTileClick,
        handleHoverTile,
        handleBoardPointerDown,
        handleBoardPointerMove,
        handleBoardPointerUp,
        handleBoardPointerCancel,
        handleBoardWheel,
    };
};
