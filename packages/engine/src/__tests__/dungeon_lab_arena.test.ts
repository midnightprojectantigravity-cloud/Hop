import { describe, expect, it } from 'vitest';
import { fingerprintFromState } from '../logic';
import {
  createDefaultDungeonLabArenaConfigV2,
  inspectDungeonLabArenaPreview,
  materializeDungeonLabArenaArtifactState,
  runDungeonLabArenaMatch,
  type DungeonLabArenaConfigV2
} from '../systems/evaluation/dungeon-lab-arena';

const createMirrorButcherConfig = (alphaQ: number, betaQ: number): DungeonLabArenaConfigV2 => ({
  version: 'dungeon-lab-arena-v2',
  seed: 'mirror-butcher',
  arenaPreset: 'empty',
  turnLimit: 40,
  actors: [
    {
      id: 'alpha-butcher',
      name: 'Alpha Butcher',
      side: 'alpha',
      position: { q: alphaQ, r: 5, s: -alphaQ - 5 },
      trinity: { body: 20, instinct: 29, mind: 0 },
      skillIds: ['BASIC_MOVE', 'BASIC_ATTACK'],
      goal: 'engage'
    },
    {
      id: 'beta-butcher',
      name: 'Beta Butcher',
      side: 'beta',
      position: { q: betaQ, r: 5, s: -betaQ - 5 },
      trinity: { body: 20, instinct: 29, mind: 0 },
      skillIds: ['BASIC_MOVE', 'BASIC_ATTACK'],
      goal: 'engage'
    }
  ]
});

describe('Dungeon Lab arena', () => {
  it('compiles deterministically for the same seed and preset', () => {
    const config = createDefaultDungeonLabArenaConfigV2();

    const first = inspectDungeonLabArenaPreview(config);
    const second = inspectDungeonLabArenaPreview(config);

    expect(fingerprintFromState(first.state)).toBe(fingerprintFromState(second.state));
    expect(first.actorReferences).toEqual(second.actorReferences);
    expect(first.issues).toEqual(second.issues);
  });

  it('keeps mirror butcher duels stable when positions are swapped across sides', () => {
    const leftStart = createMirrorButcherConfig(2, 6);
    const rightStart = createMirrorButcherConfig(6, 2);

    const leftArtifact = runDungeonLabArenaMatch(leftStart, 'mirror-left');
    const rightArtifact = runDungeonLabArenaMatch(rightStart, 'mirror-right');

    expect(leftArtifact.result).toBe(rightArtifact.result);
    expect(leftArtifact.actorOutcomes.map((actor) => ({
      id: actor.sourceActorId,
      side: actor.side,
      finalHp: actor.finalHp,
      endedAlive: actor.endedAlive
    }))).toEqual(rightArtifact.actorOutcomes.map((actor) => ({
      id: actor.sourceActorId,
      side: actor.side,
      finalHp: actor.finalHp,
      endedAlive: actor.endedAlive
    })));
  });

  it('replays retained arena artifacts without drifting from the final fingerprint', () => {
    const config = createDefaultDungeonLabArenaConfigV2();
    const artifact = runDungeonLabArenaMatch(config, 'arena-replay-parity');
    const replayedFinal = materializeDungeonLabArenaArtifactState(artifact, artifact.actionLog.length);

    expect(fingerprintFromState(replayedFinal)).toBe(artifact.finalFingerprint);
  });

  it('captures semantic AI trace data for the retained arena run', () => {
    const config = createDefaultDungeonLabArenaConfigV2();
    const artifact = runDungeonLabArenaMatch(config, 'arena-trace');
    const firstDecision = artifact.decisionTrace[0];

    expect(firstDecision).toBeDefined();
    expect(firstDecision?.topCandidates.length).toBeGreaterThan(0);
    expect(firstDecision?.topCandidates[0]?.actionSummary).toBe(firstDecision?.actionSummary);
    expect(firstDecision?.topCandidates[0]?.semanticScores).toBeDefined();
    expect(typeof firstDecision?.reasoningCode).toBe('string');
  });

  it('does not pollute live arena trace with telegraph preview decisions from other actors', () => {
    const config = createMirrorButcherConfig(2, 6);
    const artifact = runDungeonLabArenaMatch(config, 'arena-trace-live-only');

    const actorIdsByActionIndex = new Map<number, Set<string>>();
    for (const entry of artifact.decisionTrace) {
      const current = actorIdsByActionIndex.get(entry.actionIndex) || new Set<string>();
      current.add(entry.actorId);
      actorIdsByActionIndex.set(entry.actionIndex, current);
    }

    expect([...actorIdsByActionIndex.values()].every((actorIds) => actorIds.size === 1)).toBe(true);
  });

  it('respects the configured turn limit in symmetric arena mode', () => {
    const config = {
      ...createMirrorButcherConfig(2, 6),
      turnLimit: 1,
    };

    const artifact = runDungeonLabArenaMatch(config, 'arena-turn-limit');

    expect(artifact.result).toBe('timeout');
    expect(artifact.actionLog).toHaveLength(1);
    expect(artifact.finalState.turnsSpent).toBe(1);
  });
});
