import type { MovementPresentationKind, MovementTrace } from '@hop/engine';
import type { CameraVec2 } from '../../visual/camera';

export interface ActorPresentationState {
    groundWorld: CameraVec2;
    localOffsetPx: CameraVec2;
    scale: CameraVec2;
    opacity: number;
    shadowScale: number;
    shadowOpacity: number;
    teleportPhase: 'none' | 'out' | 'hidden' | 'in';
}

export interface SampledTraceState {
    actorId: string;
    presentationKind: MovementPresentationKind;
    groundWorld: CameraVec2;
    localOffsetPx: CameraVec2;
    scale: CameraVec2;
    opacity: number;
    shadowScale: number;
    shadowOpacity: number;
    teleportPhase: ActorPresentationState['teleportPhase'];
    isComplete: boolean;
}

export interface MotionBatch {
    traces: MovementTrace[];
    signature: string;
    startedAtMs: number;
    endAtMs: number;
}
