import { describe, expect, it } from 'vitest';
import type { UnifiedPowerScoreEntry } from '@hop/engine';
import {
  DELTA_VISUAL_THRESHOLD,
  buildSynapseDeltaMap,
  buildSynapseScoreSnapshot,
  resolveSynapseDeltaDirection
} from '../app/synapse';

const makeEntry = (actorId: string, ups: number, stateScore: number): UnifiedPowerScoreEntry => ({
  actorId,
  factionId: actorId === 'player' ? 'player' : 'enemy',
  isHostileToPlayer: actorId !== 'player',
  ups,
  statScore: 0,
  skillScore: 0,
  stateScore,
  zScore: 0,
  sigmaTier: actorId === 'player' ? 'elevated' : 'high'
});

describe('synapse helpers', () => {
  it('creates a snapshot and zero deltas on first frame', () => {
    const current = buildSynapseScoreSnapshot([
      makeEntry('player', 50, 20),
      makeEntry('enemy-1', 61, 30)
    ]);
    const deltas = buildSynapseDeltaMap(null, current);
    expect(deltas.player?.upsDelta).toBe(0);
    expect(deltas['enemy-1']?.stateDelta).toBe(0);
  });

  it('computes UPS and State deltas by actor id', () => {
    const previous = buildSynapseScoreSnapshot([
      makeEntry('player', 5000, 20),
      makeEntry('enemy-1', 6100, 30)
    ]);
    const current = buildSynapseScoreSnapshot([
      makeEntry('player', 5010, 19),
      makeEntry('enemy-1', 6050, 28.5)
    ]);
    const deltas = buildSynapseDeltaMap(previous, current);
    expect(deltas.player).toEqual({ upsDelta: 10, stateDelta: -1 });
    expect(deltas['enemy-1']).toEqual({ upsDelta: -50, stateDelta: -1.5 });
  });

  it('applies delta marker threshold directions', () => {
    expect(resolveSynapseDeltaDirection(DELTA_VISUAL_THRESHOLD)).toBe('up');
    expect(resolveSynapseDeltaDirection(-DELTA_VISUAL_THRESHOLD)).toBe('down');
    expect(resolveSynapseDeltaDirection(DELTA_VISUAL_THRESHOLD - 0.001)).toBe('none');
  });
});
