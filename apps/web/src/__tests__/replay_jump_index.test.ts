import { describe, expect, it } from 'vitest';
import { generateInitialState } from '@hop/engine';
import type { Action } from '@hop/engine';
import { replayActionsToIndex } from '../app/use-replay-controller';

describe('replay jump helper', () => {
  it('resets to init state and replays exact index slice', () => {
    const initState = generateInitialState(1, 'jump-seed', 'jump-seed');
    const actions: Action[] = [
      { type: 'WAIT' } as Action,
      { type: 'WAIT' } as Action,
      { type: 'WAIT' } as Action
    ];
    const dispatched: Array<{ type: string; source: string }> = [];

    const replayedIndex = replayActionsToIndex({
      initState,
      actions,
      targetIndex: 2,
      dispatchWithTrace: (action, source) => {
        dispatched.push({ type: (action as any).type, source });
      }
    });

    expect(replayedIndex).toBe(2);
    expect(dispatched).toHaveLength(3);
    expect(dispatched[0]).toEqual({ type: 'LOAD_STATE', source: 'replay_jump_reset' });
    expect(dispatched[1]).toEqual({ type: 'WAIT', source: 'replay_jump' });
    expect(dispatched[2]).toEqual({ type: 'WAIT', source: 'replay_jump' });
  });
});

