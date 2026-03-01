import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Point } from '@hop/engine';
import type { CameraInsetsPx, CameraRect, CameraVec2, CameraZoomPreset } from '../../visual/camera';

export type CameraViewState = {
    center: CameraVec2;
    scale: number;
    viewBox: CameraRect;
};

export type PointerPoint = { x: number; y: number };

export type DragPointerState = {
    activePointerId: number | null;
    startClient: PointerPoint | null;
    lastWorld: CameraVec2 | null;
    didPan: boolean;
};

export type PinchPointerState = {
    startDistance: number;
    startPreset: CameraZoomPreset;
    appliedPreset: CameraZoomPreset;
};

export interface UseBoardCameraArgs {
    baseViewBox: CameraRect;
    playerWorld: { x: number; y: number };
    playerPosition: Point;
    floor: number | undefined;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
}

export interface UseBoardCameraResult {
    svgRef: MutableRefObject<SVGSVGElement | null>;
    boardViewportRef: MutableRefObject<HTMLDivElement | null>;
    zoomPreset: CameraZoomPreset;
    isCameraPanning: boolean;
    setIsCameraPanning: Dispatch<SetStateAction<boolean>>;
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
