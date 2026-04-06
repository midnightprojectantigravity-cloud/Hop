import { describe, expect, it } from 'vitest';
import {
  createDefaultDungeonLabArenaConfigV2,
  fingerprintFromState,
  inspectDungeonLabArenaPreview,
  materializeDungeonLabArenaArtifactState,
  runDungeonLabArenaMatch,
} from '@hop/engine';
import { toDungeonLabWorkerTransportSafe } from '../app/dungeon-lab-worker-transport';

describe('dungeon lab arena worker transport', () => {
  it('sanitizes preview inspections so they become structured-clone safe', () => {
    const config = createDefaultDungeonLabArenaConfigV2();
    const preview = inspectDungeonLabArenaPreview(config);

    const transported = toDungeonLabWorkerTransportSafe(preview);
    expect(() => structuredClone(preview)).not.toThrow();
    expect(() => structuredClone(transported)).not.toThrow();
    expect(transported.state.player.position).toEqual(preview.state.player.position);
    expect(transported.issues).toEqual(preview.issues);
    expect(transported.markers).toEqual(preview.markers);
  });

  it('keeps retained artifacts replay-safe after worker transport sanitization', () => {
    const config = createDefaultDungeonLabArenaConfigV2();
    const artifact = runDungeonLabArenaMatch(config, 'dungeon-lab-arena-worker-transport');
    const transported = toDungeonLabWorkerTransportSafe(artifact);
    const replayedFinal = materializeDungeonLabArenaArtifactState(transported, transported.actionLog.length);

    expect(() => structuredClone(transported)).not.toThrow();
    expect(fingerprintFromState(replayedFinal)).toBe(transported.finalFingerprint);
    expect(transported.actorOutcomes.length).toBeGreaterThan(0);
    expect(transported.decisionTrace.length).toBeGreaterThan(0);
  });
});
