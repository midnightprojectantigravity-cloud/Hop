import { describe, expect, it } from 'vitest';
import type { SimulationEvent } from '@hop/engine';
import { extractAilmentDeltaLines } from '../components/game-board/useBoardTargetingPreview';

describe('preview ailment delta overlay helpers', () => {
  it('aggregates ailment deltas from simulation events', () => {
    const events: SimulationEvent[] = [
      {
        id: 'sim:1',
        turn: 1,
        type: 'AilmentChanged',
        targetId: 'enemy-1',
        payload: { ailment: 'burn', delta: -5 }
      },
      {
        id: 'sim:2',
        turn: 1,
        type: 'AilmentChanged',
        targetId: 'enemy-1',
        payload: { ailment: 'wet', delta: 2 }
      },
      {
        id: 'sim:3',
        turn: 1,
        type: 'AilmentChanged',
        targetId: 'enemy-1',
        payload: { ailment: 'burn', delta: -1 }
      }
    ];

    const lines = extractAilmentDeltaLines(events);
    expect(lines).toContain('-6 Burn');
    expect(lines).toContain('+2 Wet');
  });
});

