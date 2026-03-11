import type { CameraVec2 } from '../../visual/camera';
import type { ActorPresentationState } from './board-motion-types';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const getJumpLiftPx = (progress: number, reducedMotion: boolean): number => {
    const amplitude = reducedMotion ? 8 : 18;
    return Math.sin(Math.PI * clamp01(progress)) * amplitude;
};

export const getWalkBobPx = (progress: number): number => {
    return Math.sin(Math.PI * clamp01(progress) * 2) * 2.2;
};

export const getDashStretch = (progress: number): CameraVec2 => {
    const pulse = Math.sin(Math.PI * clamp01(progress));
    return {
        x: 1 + (pulse * 0.08),
        y: 1 - (pulse * 0.05)
    };
};

export const getJumpScale = (progress: number): CameraVec2 => {
    const pulse = Math.sin(Math.PI * clamp01(progress));
    return {
        x: 1 - (pulse * 0.02),
        y: 1 + (pulse * 0.04)
    };
};

export const createDefaultPresentationState = (groundWorld: CameraVec2): ActorPresentationState => ({
    groundWorld,
    localOffsetPx: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    opacity: 1,
    shadowScale: 1,
    shadowOpacity: 1,
    teleportPhase: 'none'
});
