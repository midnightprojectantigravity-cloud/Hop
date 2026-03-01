import type { CameraZoomPreset } from '../../visual/camera';

export interface CameraSyncRefsSnapshot {
    didInit: boolean;
    lastPlayerKey: string | null;
    lastCameraFloor: number | null;
    lastViewportSignature: string;
    lastBoundsSignature: string;
    lastZoomPreset: CameraZoomPreset;
}

export interface CameraSyncInputs {
    floor: number | undefined;
    playerKey: string;
    boundsSignature: string;
    viewportSignature: string;
    zoomPreset: CameraZoomPreset;
}

export type CameraSyncAction =
    | 'init'
    | 'reset-floor'
    | 'reset-bounds'
    | 'snap-viewport'
    | 'animate-zoom'
    | 'animate-player'
    | 'none';

export const resolveCameraSyncAction = (
    refs: CameraSyncRefsSnapshot,
    input: CameraSyncInputs
): {
    action: CameraSyncAction;
    nextRefs: CameraSyncRefsSnapshot;
} => {
    if (!refs.didInit) {
        return {
            action: 'init',
            nextRefs: {
                didInit: true,
                lastPlayerKey: input.playerKey,
                lastCameraFloor: input.floor ?? null,
                lastViewportSignature: input.viewportSignature,
                lastBoundsSignature: input.boundsSignature,
                lastZoomPreset: input.zoomPreset,
            },
        };
    }

    if ((input.floor ?? null) !== refs.lastCameraFloor) {
        return {
            action: 'reset-floor',
            nextRefs: {
                ...refs,
                lastCameraFloor: input.floor ?? null,
                lastBoundsSignature: input.boundsSignature,
                lastViewportSignature: input.viewportSignature,
                lastPlayerKey: input.playerKey,
                lastZoomPreset: input.zoomPreset,
            },
        };
    }

    if (input.floor !== undefined && input.boundsSignature !== refs.lastBoundsSignature) {
        return {
            action: 'reset-bounds',
            nextRefs: {
                ...refs,
                lastBoundsSignature: input.boundsSignature,
                lastViewportSignature: input.viewportSignature,
                lastPlayerKey: input.playerKey,
                lastZoomPreset: input.zoomPreset,
            },
        };
    }

    if (input.viewportSignature !== refs.lastViewportSignature) {
        return {
            action: 'snap-viewport',
            nextRefs: {
                ...refs,
                lastViewportSignature: input.viewportSignature,
                lastBoundsSignature: input.boundsSignature,
            },
        };
    }

    if (input.zoomPreset !== refs.lastZoomPreset) {
        return {
            action: 'animate-zoom',
            nextRefs: {
                ...refs,
                lastZoomPreset: input.zoomPreset,
            },
        };
    }

    if (input.playerKey !== refs.lastPlayerKey) {
        return {
            action: 'animate-player',
            nextRefs: {
                ...refs,
                lastPlayerKey: input.playerKey,
            },
        };
    }

    return {
        action: 'none',
        nextRefs: refs,
    };
};

