import { describe, expect, it } from 'vitest';
import { hasMatchingMovementTrace, resolvePlaybackPath } from '../components/entity/entity-animation';

describe('entity animation helpers', () => {
  it('detects matching movement traces for actor and destination', () => {
    const destination = { q: 2, r: 3, s: -5 };
    const trace = {
      actorId: 'enemy_1',
      destination,
      path: [{ q: 1, r: 3, s: -4 }, destination]
    } as any;

    expect(hasMatchingMovementTrace(trace, 'enemy_1', destination)).toBe(true);
    expect(hasMatchingMovementTrace(trace, 'enemy_2', destination)).toBe(false);
  });

  it('reverses trace playback path when origin is at tail', () => {
    const origin = { q: 1, r: 1, s: -2 };
    const destination = { q: 2, r: 1, s: -3 };
    const reversed = resolvePlaybackPath({
      rawPath: [destination, origin],
      movementTraceOrigin: origin,
      hasMatchingTrace: true
    });

    expect(reversed[0]).toEqual(origin);
    expect(reversed[1]).toEqual(destination);
  });
});

