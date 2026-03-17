import { describe, expect, it } from 'vitest';
import { classifyDamageCueType, CRITICAL_PLAYER_DAMAGE_MIN_HOLD_MS, CRITICAL_PLAYER_DEATH_MIN_HOLD_MS, resolveCriticalPlayerCueHoldUntil } from '../components/juice/juice-manager-utils';
import { buildSimulationDamageCueEffects } from '../components/juice/event-effect-builders';

const hex = (q: number, r: number, s: number) => ({ q, r, s });

describe('player critical juice cues', () => {
  it('marks player damage cues as critical and adds readable damage text', () => {
    const effects = buildSimulationDamageCueEffects({
      incoming: [{
        id: 'sim-1',
        turn: 3,
        type: 'DamageTaken',
        targetId: 'player',
        position: hex(1, 1, -2),
        payload: {
          amount: 4,
          reason: 'arrow_shot',
          sourceId: 'archer-1'
        }
      }],
      now: 1000,
      startIndex: 0,
      actorById: new Map([
        ['archer-1', { id: 'archer-1', position: hex(0, 1, -1), subtype: 'archer' }]
      ]),
      playerActorId: 'player',
      recentSignatureImpactByTile: new Map(),
      classifyDamageCueType,
    });

    expect(effects.some((effect) => effect.type === 'combat_text' && effect.payload?.text === '-4')).toBe(true);
    expect(effects.some((effect) => effect.payload?.criticalPlayerCue === true)).toBe(true);
  });

  it('keeps lethal player cues alive for at least the death budget', () => {
    const holdUntil = resolveCriticalPlayerCueHoldUntil({
      additions: [{
        id: 'critical-impact',
        type: 'impact',
        position: hex(0, 0, 0),
        startTime: 2500,
        payload: { criticalPlayerCue: true }
      }],
      now: 2500,
      playerDefeated: true
    });

    expect(holdUntil).toBeGreaterThanOrEqual(2500 + CRITICAL_PLAYER_DEATH_MIN_HOLD_MS);
  });

  it('still reserves a minimum read window for non-lethal player damage', () => {
    const holdUntil = resolveCriticalPlayerCueHoldUntil({
      additions: [{
        id: 'critical-text',
        type: 'combat_text',
        position: hex(0, 0, 0),
        startTime: 1800,
        payload: { text: '-2', criticalPlayerCue: true },
        ttlMs: 120
      }],
      now: 1800,
      playerDefeated: false
    });

    expect(holdUntil).toBeGreaterThanOrEqual(1800 + CRITICAL_PLAYER_DAMAGE_MIN_HOLD_MS);
  });
});
