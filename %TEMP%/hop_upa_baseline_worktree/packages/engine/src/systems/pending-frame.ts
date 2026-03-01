import type { GameState, PendingFrame, PendingFrameType } from '../types';

export const createPendingFrame = (
    state: GameState,
    type: PendingFrameType,
    status: PendingFrame['status'],
    payload?: Record<string, unknown>
): PendingFrame => {
    const idx = (state.pendingFrames?.length ?? 0) + 1;
    return {
        id: `${state.turnNumber}:${status}:${type}:${idx}`,
        type,
        status,
        createdTurn: state.turnNumber,
        blocking: true,
        payload
    };
};

export const withPendingFrame = (
    state: GameState,
    pendingStatus: NonNullable<GameState['pendingStatus']>,
    frameType: PendingFrameType,
    framePayload?: Record<string, unknown>
): GameState => {
    const frame = createPendingFrame(state, frameType, pendingStatus.status as PendingFrame['status'], framePayload);
    return {
        ...state,
        pendingStatus,
        pendingFrames: [...(state.pendingFrames || []), frame]
    };
};
