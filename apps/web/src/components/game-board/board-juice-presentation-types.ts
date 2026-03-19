import type { GameState } from '@hop/engine';
import type { BoardEventDigest } from './board-event-digest';
import type { BoardEntityPoseStore } from './board-entity-pose-store';

export type PointerPoint = { x: number; y: number };

export type JuiceDebugEntry = {
    id: string;
    sequenceId: string;
    signature: string;
    phase: string;
    primitive: string;
    timestamp: number;
};

export type WorldPoint = { x: number; y: number };

export type PoseTransformFrame = {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
};

export type EntityPoseEffect = {
    id: string;
    actorId: string;
    startTime: number;
    endTime: number;
    easing: 'out' | 'inOut';
    from: PoseTransformFrame;
    to: PoseTransformFrame;
};

export interface UseBoardJuicePresentationArgs {
    gameState: GameState;
    boardEventDigest: BoardEventDigest;
}

export interface UseBoardJuicePresentationResult {
    isShaking: boolean;
    isFrozen: boolean;
    cameraKickOffsetPx: PointerPoint;
    juiceDebugOverlayEnabled: boolean;
    juiceDebugEntries: JuiceDebugEntry[];
    poseStore: BoardEntityPoseStore;
    enqueueEntityPoseEffects: (effects: ReadonlyArray<EntityPoseEffect>) => void;
    resetBoardJuicePresentation: () => void;
}
