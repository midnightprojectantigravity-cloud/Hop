import { describe, expect, it } from 'vitest';
import type { TimelineEvent } from '@hop/engine';
import {
  resolveTimelinePhaseDuration,
  resolveTimelineWaitDuration,
} from '../components/juice/juice-timeline-utils';

const createTimelineEvent = (phase: TimelineEvent['phase']): TimelineEvent => ({
  id: `test-${phase}`,
  turn: 1,
  phase,
  type: 'Displacement',
  payload: {},
  blocking: true,
  suggestedDurationMs: 260,
});

describe('juice timeline move settle timing', () => {
  it('keeps MOVE_END as a short settle instead of a long post-move hold', () => {
    const moveEnd = createTimelineEvent('MOVE_END');

    expect(resolveTimelinePhaseDuration(moveEnd, 187)).toBe(56);
    expect(resolveTimelineWaitDuration(moveEnd, 187, 56, false)).toBe(56);
  });

  it('preserves non-move blocking phases', () => {
    const damageApply = createTimelineEvent('DAMAGE_APPLY');

    expect(resolveTimelinePhaseDuration(damageApply, 72)).toBe(72);
    expect(resolveTimelineWaitDuration(damageApply, 72, 72, false)).toBe(72);
  });
});
