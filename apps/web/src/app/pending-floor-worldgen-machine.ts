export type PendingFloorWorldgenPhase =
  | 'idle'
  | 'waiting_for_animation'
  | 'compiling_floor'
  | 'compile_failed'
  | 'applied';

export interface PendingFloorWorldgenState {
  phase: PendingFloorWorldgenPhase;
  key?: string;
  error?: string;
}

export type PendingFloorWorldgenAction =
  | { type: 'SYNC_PENDING'; active: false }
  | { type: 'SYNC_PENDING'; active: true; key: string }
  | { type: 'COMPILE_STARTED'; key: string }
  | { type: 'COMPILE_SUCCEEDED'; key: string }
  | { type: 'COMPILE_FAILED'; key: string; error: string }
  | { type: 'RETRY_REQUESTED'; key: string };

export const INITIAL_PENDING_FLOOR_WORLDGEN_STATE: PendingFloorWorldgenState = {
  phase: 'idle'
};

export const reducePendingFloorWorldgenState = (
  state: PendingFloorWorldgenState,
  action: PendingFloorWorldgenAction
): PendingFloorWorldgenState => {
  switch (action.type) {
    case 'SYNC_PENDING':
      if (!action.active) {
        return INITIAL_PENDING_FLOOR_WORLDGEN_STATE;
      }
      if (state.key !== action.key) {
        return {
          phase: 'waiting_for_animation',
          key: action.key
        };
      }
      return state;
    case 'COMPILE_STARTED':
      return {
        phase: 'compiling_floor',
        key: action.key
      };
    case 'COMPILE_SUCCEEDED':
      if (state.key && state.key !== action.key) return state;
      return {
        phase: 'applied',
        key: action.key
      };
    case 'COMPILE_FAILED':
      if (state.key && state.key !== action.key) return state;
      return {
        phase: 'compile_failed',
        key: action.key,
        error: action.error
      };
    case 'RETRY_REQUESTED':
      if (state.key && state.key !== action.key) return state;
      return {
        phase: 'waiting_for_animation',
        key: action.key
      };
    default:
      return state;
  }
};
