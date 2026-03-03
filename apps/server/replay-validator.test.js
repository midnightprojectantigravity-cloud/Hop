import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintFromState, gameReducer, generateInitialState } from '@hop/engine';
import {
  validateReplaySubmissionPayload,
  verifyReplayEnvelope
} from './replay-validator.js';

const buildValidEnvelope = () => {
  const seed = 'server-replay-v3-seed';
  const actions = [{ type: 'WAIT' }];
  let state = generateInitialState(1, seed, seed);
  for (const action of actions) {
    state = gameReducer(state, action);
  }

  const score = Number(state.completedRun?.score || (state.player.hp || 0) + (state.floor || 0) * 100);
  return {
    version: 3,
    run: {
      seed,
      initialSeed: seed,
      startFloor: 1,
      loadoutId: 'VANGUARD',
      mode: 'normal'
    },
    actions,
    meta: {
      recordedAt: '2026-03-03T00:00:00.000Z',
      final: {
        score,
        floor: state.floor,
        fingerprint: fingerprintFromState(state),
        gameStatus: 'lost'
      }
    }
  };
};

test('accepts valid v3 replay submission payload and verifies fingerprint', () => {
  const replay = buildValidEnvelope();
  const validated = validateReplaySubmissionPayload({ replay, client: { name: 'test' } });
  assert.equal(validated.valid, true);
  assert.ok(validated.replay);

  const verification = verifyReplayEnvelope(validated.replay);
  assert.equal(verification.verified, true);
  assert.equal(verification.computedFingerprint, replay.meta.final.fingerprint);
});

test('rejects replay submission when fingerprint is missing', () => {
  const replay = buildValidEnvelope();
  delete replay.meta.final.fingerprint;
  const validated = validateReplaySubmissionPayload({ replay });
  assert.equal(validated.valid, true);
  assert.ok(validated.replay);

  const verification = verifyReplayEnvelope(validated.replay);
  assert.equal(verification.verified, false);
});

test('rejects replay submission when fingerprint does not match', () => {
  const replay = buildValidEnvelope();
  replay.meta.final.fingerprint = 'bogus-fingerprint';
  const validated = validateReplaySubmissionPayload({ replay });
  assert.equal(validated.valid, true);
  assert.ok(validated.replay);

  const verification = verifyReplayEnvelope(validated.replay);
  assert.equal(verification.verified, false);
});

test('rejects invalid action payloads through replay validator', () => {
  const replay = buildValidEnvelope();
  replay.actions = [{ type: 'START_RUN', payload: { loadoutId: 'VANGUARD' } }];
  const validated = validateReplaySubmissionPayload({ replay });
  assert.equal(validated.valid, false);
  assert.match(String(validated.error), /Invalid replay/);
});
