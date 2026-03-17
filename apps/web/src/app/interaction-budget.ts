import type { GameState } from '@hop/engine';

export const computeInteractionBlockingBudget = ({
  timelineEvents,
  visualEvents,
}: {
  timelineEvents: GameState['timelineEvents'];
  visualEvents: GameState['visualEvents'];
}): {
  hasBlockingTimeline: boolean;
  blockingDurationMs: number;
  movementTraceBudgetMs: number;
  interactionBudgetMs: number;
} => {
  const blockingDurationMs = (timelineEvents || [])
    .filter(ev => ev.blocking)
    .reduce((sum, ev) => sum + (ev.suggestedDurationMs || 0), 0);
  const movementTraceBudgetMs = (visualEvents || []).reduce((maxMs, ev) => {
    if (ev.type !== 'kinetic_trace') return maxMs;
    const trace = ev.payload as { startDelayMs?: number; durationMs?: number } | undefined;
    if (!trace) return maxMs;
    const startDelayMs = Math.max(0, Number(trace.startDelayMs || 0));
    const durationMs = Math.max(0, Number(trace.durationMs || 0));
    return Math.max(maxMs, startDelayMs + durationMs);
  }, 0);

  return {
    hasBlockingTimeline: (timelineEvents || []).some(ev => ev.blocking),
    blockingDurationMs,
    movementTraceBudgetMs,
    interactionBudgetMs: Math.max(blockingDurationMs, movementTraceBudgetMs),
  };
};
