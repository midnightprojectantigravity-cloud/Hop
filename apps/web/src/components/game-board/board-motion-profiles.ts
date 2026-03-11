import type { MovementPresentationKind } from '@hop/engine';

export const BOARD_MOTION_TIME_SCALE = 0.76;

export interface MotionProfile {
    easing: 'linear' | 'easeOut';
}

export const MOTION_PROFILES: Record<MovementPresentationKind, MotionProfile> = {
    walk: { easing: 'easeOut' },
    dash: { easing: 'linear' },
    jump: { easing: 'linear' },
    teleport: { easing: 'linear' },
    forced_slide: { easing: 'linear' }
};
