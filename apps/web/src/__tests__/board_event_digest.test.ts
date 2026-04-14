import { describe, expect, it } from 'vitest';
import { buildBoardEventDigest } from '../components/game-board/board-event-digest';

describe('board event digest', () => {
  it('collects board-facing event slices in one pass', () => {
    const point = { q: 1, r: 0, s: -1 };
    const digest = buildBoardEventDigest({
      visualEvents: [
        {
          type: 'kinetic_trace',
          payload: {
            actorId: 'player',
            origin: { q: 0, r: 0, s: 0 },
            destination: point,
            durationMs: 120,
          },
        },
        {
          type: 'vfx',
          payload: {
            type: 'vaporize',
            position: point,
          },
        },
        {
          type: 'juice_signature',
          payload: {
            protocol: 'juice-signature/v1',
            signature: 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK',
            phase: 'impact',
            primitive: 'strike',
            camera: { shake: 'high' },
            timing: { delayMs: 0 },
          },
        },
      ] as any,
      timelineEvents: [
        {
          id: 'death-1',
          phase: 'DEATH_RESOLVE',
          payload: { position: point },
        },
      ] as any,
      simulationEvents: [
        {
          type: 'DamageTaken',
          position: point,
          targetId: 'player',
          payload: { amount: 2, sourceId: 'enemy-1' },
        },
        {
          type: 'RestTriggered',
          actorId: 'player',
          payload: {},
        },
      ] as any,
    });

    expect(digest.signatureVisualEvents).toHaveLength(1);
    expect(digest.legacyVfxVisualEvents).toHaveLength(1);
    expect(digest.movementTraceEvents).toHaveLength(1);
    expect(digest.timelineDeathEvents).toEqual([{ id: 'death-1', position: point }]);
    expect(digest.deathDecalVisualEvents).toEqual([{ id: 'vaporize-1', position: point }]);
    expect(digest.damageSimulationEvents).toHaveLength(1);
    expect(digest.simulationPoseEvents).toHaveLength(2);
    expect(digest.juiceDebugPayloads[0]).toMatchObject({
      signature: 'ATK.STRIKE.PHYSICAL.BASIC_ATTACK',
      phase: 'impact',
      primitive: 'strike',
    });
    expect(digest.cameraCuePlan.shakeDurationMs).toBeGreaterThan(0);
  });

  it('keeps stable signatures for equivalent cloned batches', () => {
    const batch = [
      { type: 'juice_signature', payload: { protocol: 'juice-signature/v1', signature: 'A', phase: 'impact', primitive: 'p' } },
      { type: 'vfx', payload: { type: 'flash', position: { q: 1, r: 0, s: -1 } } },
    ] as any;
    const digestA = buildBoardEventDigest({
      visualEvents: batch,
      timelineEvents: [{ id: 't1', phase: 'DEATH_RESOLVE', payload: { position: { q: 1, r: 0, s: -1 } } }] as any,
      simulationEvents: [{ type: 'DamageTaken', position: { q: 1, r: 0, s: -1 }, targetId: 'p', payload: { amount: 1 } }] as any,
    });
    const digestB = buildBoardEventDigest({
      visualEvents: batch.map((entry: any) => ({ ...entry, payload: { ...entry.payload } })) as any,
      timelineEvents: [{ id: 't1', phase: 'DEATH_RESOLVE', payload: { position: { q: 1, r: 0, s: -1 } } }] as any,
      simulationEvents: [{ type: 'DamageTaken', position: { q: 1, r: 0, s: -1 }, targetId: 'p', payload: { amount: 1 } }] as any,
    });

    expect(digestA.visualEventsSignature).toBe(digestB.visualEventsSignature);
    expect(digestA.timelineEventsSignature).toBe(digestB.timelineEventsSignature);
    expect(digestA.simulationEventsSignature).toBe(digestB.simulationEventsSignature);
  });
});
