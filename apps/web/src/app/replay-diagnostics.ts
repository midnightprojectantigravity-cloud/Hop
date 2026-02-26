import type { Action } from '@hop/engine';

export const buildReplayDiagnostics = (actions: Action[], floor: number) => {
  const types = new Set(actions.map(a => a.type));
  const hasTurnAdvance = types.has('ADVANCE_TURN');
  const hasPendingResolve = types.has('RESOLVE_PENDING');
  const actionCount = actions.length;
  const suspiciouslyShort = floor >= 5 && actionCount < Math.max(25, floor * 4);
  return { actionCount, hasTurnAdvance, hasPendingResolve, suspiciouslyShort };
};
