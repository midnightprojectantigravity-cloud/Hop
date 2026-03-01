import { describe, expect, it } from 'vitest';
import type { SimulationEvent } from '@hop/engine';
import { deriveMobileToastsFromSimulationEvents } from '../app/use-simulation-feedback';

describe('simulation feedback ailment toasts', () => {
  it('emits hardened toast for player resilience gains', () => {
    const playerId = 'player';
    const events: SimulationEvent[] = [
      {
        id: 'sim:1',
        turn: 3,
        type: 'AilmentResilienceGained',
        targetId: playerId,
        payload: {
          ailment: 'burn',
          previousPct: 1.5,
          nextPct: 2.2
        }
      }
    ];

    const toasts = deriveMobileToastsFromSimulationEvents(events, playerId);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].text).toContain('Hardened: burn');
    expect(toasts[0].tone).toBe('status');
  });
});

