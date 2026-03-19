import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { Point } from '@hop/engine';
import type { CameraVec2, CameraZoomMode } from '../../visual/camera';

type PointerPoint = { x: number; y: number };

type DragPointerState = {
    activePointerId: number | null;
    startClient: PointerPoint | null;
    lastWorld: CameraVec2 | null;
    didPan: boolean;
};

type PinchPointerState = {
    startDistance: number;
    appliedMode: CameraZoomMode;
};

interface UseBoardInteractionsArgs {
    svgRef: React.MutableRefObject<SVGSVGElement | null>;
    onMove: (hex: Point) => void;
    canHandleTileClick?: (hex: Point) => boolean;
    zoomMode: CameraZoomMode;
    setHoveredTile: (tile: Point | null) => void;
    beginManualPan: () => void;
    panByWorldDelta: (deltaWorld: CameraVec2) => void;
    endManualPan: () => void;
    selectZoomMode: (mode: CameraZoomMode) => void;
    recenter: () => void;
}

export const useBoardInteractions = ({
    svgRef,
    onMove,
    canHandleTileClick,
    zoomMode,
    setHoveredTile,
    beginManualPan,
    panByWorldDelta,
    endManualPan,
    selectZoomMode,
    recenter,
}: UseBoardInteractionsArgs) => {
    const [isCameraPanning, setIsCameraPanning] = useState(false);
    const suppressTileClickUntilRef = useRef(0);
    const activePointersRef = useRef<Map<number, PointerPoint>>(new Map());
    const isPinchingRef = useRef(false);
    const dragStateRef = useRef<DragPointerState>({
        activePointerId: null,
        startClient: null,
        lastWorld: null,
        didPan: false
    });
    const pinchStateRef = useRef<PinchPointerState | null>(null);

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

    const handleTileClick = useCallback((hex: Point) => {
        if (Date.now() < suppressTileClickUntilRef.current) return;
        if (canHandleTileClick && !canHandleTileClick(hex)) return;
        onMove(hex);
    }, [canHandleTileClick, onMove]);

    const handleHoverTile = useCallback((hex: Point) => {
        if (isCameraPanning || isPinchingRef.current) return;
        setHoveredTile(hex);
    }, [isCameraPanning, setHoveredTile]);

    const getPointerEntries = useCallback(() => Array.from(activePointersRef.current.entries()), []);

    const handleBoardPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (event.pointerType !== 'mouse') {
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
                // pointer capture is optional
            }
        }

        const pointers = getPointerEntries();
        if (pointers.length >= 2) {
            isPinchingRef.current = true;
            setIsCameraPanning(false);
            dragStateRef.current.didPan = true;
            suppressTileClickUntilRef.current = Date.now() + 250;
            const [a, b] = pointers;
            const dx = a[1].x - b[1].x;
            const dy = a[1].y - b[1].y;
            pinchStateRef.current = {
                startDistance: Math.max(1, Math.hypot(dx, dy)),
                appliedMode: zoomMode
            };
            return;
        }

        dragStateRef.current = {
            activePointerId: event.pointerId,
            startClient: { x: event.clientX, y: event.clientY },
            lastWorld: clientToWorld(event.clientX, event.clientY),
            didPan: false
        };
    }, [clientToWorld, getPointerEntries, zoomMode]);

    const handleBoardPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
        if (!activePointersRef.current.has(event.pointerId)) return;
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const pointers = getPointerEntries();

        if (isPinchingRef.current || pointers.length >= 2) {
            if (pointers.length >= 2) {
                isPinchingRef.current = true;
                const [a, b] = pointers;
                const dx = a[1].x - b[1].x;
                const dy = a[1].y - b[1].y;
                const distance = Math.max(1, Math.hypot(dx, dy));
                const ratio = distance / Math.max(1, pinchStateRef.current?.startDistance || distance);
                let nextMode: CameraZoomMode = pinchStateRef.current?.appliedMode || zoomMode;
                if (ratio > 1.08) nextMode = 'action';
                if (ratio < 0.92) nextMode = 'tactical';
                if (nextMode !== pinchStateRef.current?.appliedMode) {
                    pinchStateRef.current = {
                        startDistance: pinchStateRef.current?.startDistance || distance,
                        appliedMode: nextMode
                    };
                    selectZoomMode(nextMode);
                }
                suppressTileClickUntilRef.current = Date.now() + 250;
                event.preventDefault();
            }
            return;
        }

        const drag = dragStateRef.current;
        if (!drag.startClient || drag.activePointerId !== event.pointerId) return;
        const dxPx = event.clientX - drag.startClient.x;
        const dyPx = event.clientY - drag.startClient.y;
        const movedPx = Math.hypot(dxPx, dyPx);

        if (!drag.didPan && movedPx > 10) {
            drag.didPan = true;
            setIsCameraPanning(true);
            beginManualPan();
            suppressTileClickUntilRef.current = Date.now() + 250;
            setHoveredTile(null);
        }

        if (!drag.didPan) return;
        const currentWorld = clientToWorld(event.clientX, event.clientY);
        if (!drag.lastWorld || !currentWorld) return;
        panByWorldDelta({
            x: drag.lastWorld.x - currentWorld.x,
            y: drag.lastWorld.y - currentWorld.y
        });
        drag.lastWorld = currentWorld;
        event.preventDefault();
    }, [beginManualPan, clientToWorld, getPointerEntries, panByWorldDelta, selectZoomMode, setHoveredTile, zoomMode]);

    const finishPointer = useCallback((pointerId: number) => {
        activePointersRef.current.delete(pointerId);
        const pointers = getPointerEntries();
        if (pointers.length < 2) {
            isPinchingRef.current = false;
            pinchStateRef.current = null;
        }
        const drag = dragStateRef.current;
        if (drag.activePointerId === pointerId) {
            if (drag.didPan) {
                suppressTileClickUntilRef.current = Date.now() + 250;
                endManualPan();
            }
            dragStateRef.current = {
                activePointerId: pointers[0]?.[0] ?? null,
                startClient: pointers[0] ? { ...pointers[0][1] } : null,
                lastWorld: pointers[0] ? clientToWorld(pointers[0][1].x, pointers[0][1].y) : null,
                didPan: false
            };
        }
        if (activePointersRef.current.size === 0) {
            setIsCameraPanning(false);
        }
    }, [clientToWorld, endManualPan, getPointerEntries]);

    const handleBoardPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
        finishPointer(event.pointerId);
        try {
            event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
            // no-op
        }
    }, [finishPointer]);

    const handleBoardPointerCancel = useCallback((event: PointerEvent<SVGSVGElement>) => {
        finishPointer(event.pointerId);
    }, [finishPointer]);

    const handleBoardWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
        if ((event.ctrlKey || event.deltaY !== 0) && event.cancelable) {
            event.preventDefault();
        }
        if (Math.abs(event.deltaY) < 0.1) return;
        selectZoomMode(event.deltaY < 0 ? 'action' : 'tactical');
        suppressTileClickUntilRef.current = Date.now() + 120;
    }, [selectZoomMode]);

    return {
        isCameraPanning,
        handleResetView: recenter,
        handleTileClick,
        handleHoverTile,
        handleBoardPointerDown,
        handleBoardPointerMove,
        handleBoardPointerUp,
        handleBoardPointerCancel,
        handleBoardWheel,
    };
};
