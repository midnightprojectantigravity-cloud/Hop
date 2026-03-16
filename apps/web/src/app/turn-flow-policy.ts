import type { Action } from '@hop/engine';

export type PlayerTurnFlowMode = 'protected_single' | 'manual_chain';
export type OverdriveTurnState = 'idle' | 'armed';
export type MeaningfulActionType = 'MOVE' | 'USE_SKILL' | 'ATTACK';

export interface PendingAutoEndState {
  armedOnTurn: number;
  expectedActionLogLength: number;
  sourceActionType: MeaningfulActionType;
}

export const isMeaningfulPlayerAction = (action: Action): action is Extract<Action, { type: MeaningfulActionType }> =>
  action.type === 'MOVE' || action.type === 'USE_SKILL' || action.type === 'ATTACK';

export const resolveMeaningfulActionType = (action: Action): MeaningfulActionType | null => {
  if (!isMeaningfulPlayerAction(action)) return null;
  return action.type;
};

export const shouldArmAutoEndForAction = ({
  turnFlowMode,
  overdriveState,
  action
}: {
  turnFlowMode: PlayerTurnFlowMode;
  overdriveState: OverdriveTurnState;
  action: Action;
}): boolean =>
  turnFlowMode === 'protected_single'
  && overdriveState !== 'armed'
  && isMeaningfulPlayerAction(action);
