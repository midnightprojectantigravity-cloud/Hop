import {
  DEFAULT_LOADOUTS,
  fingerprintFromState,
  gameReducer,
  generateInitialState,
  validateReplayEnvelopeV3
} from '@hop/engine';

export const MAX_REQUEST_BYTES = 1_000_000;
export const MAX_REPLAY_ACTIONS = 10_000;

const isObject = (value) => typeof value === 'object' && value !== null;

export const validateReplaySubmissionPayload = (payload, options = {}) => {
  if (!isObject(payload)) {
    return { valid: false, error: 'Invalid payload.' };
  }

  const replayValidation = validateReplayEnvelopeV3(payload.replay, {
    maxActions: options.maxActions || MAX_REPLAY_ACTIONS
  });
  if (!replayValidation.valid || !replayValidation.envelope) {
    return {
      valid: false,
      error: `Invalid replay: ${replayValidation.errors.slice(0, 3).join(' | ')}`,
      errors: replayValidation.errors
    };
  }

  return {
    valid: true,
    replay: replayValidation.envelope,
    client: isObject(payload.client) ? payload.client : null
  };
};

export const verifyReplayEnvelope = (replay) => {
  try {
    const run = replay.run || {};
    const startFloor = Number.isInteger(run.startFloor) && run.startFloor > 0 ? run.startFloor : 1;
    const seed = run.seed;
    const initialSeed = run.initialSeed || seed;
    const loadout = run.loadoutId ? DEFAULT_LOADOUTS[run.loadoutId] : undefined;
    const mapSize = isObject(run.mapSize)
      ? { width: Number(run.mapSize.width), height: Number(run.mapSize.height) }
      : undefined;
    const mapShape = run.mapShape === 'rectangle' ? 'rectangle' : 'diamond';

    let state = generateInitialState(startFloor, seed, initialSeed, undefined, loadout, mapSize, mapShape);
    for (const action of replay.actions) {
      state = gameReducer(state, action);
    }

    const expectedFingerprint = replay.meta?.final?.fingerprint;
    const computedFingerprint = fingerprintFromState(state);
    const verified = typeof expectedFingerprint === 'string'
      && expectedFingerprint.length > 0
      && expectedFingerprint === computedFingerprint;

    const score = Number(state.completedRun?.score || (state.player.hp || 0) + (state.floor || 0) * 100);
    const floor = Number(state.floor || startFloor);

    return {
      verified,
      expectedFingerprint,
      computedFingerprint,
      score,
      floor,
      finalState: state
    };
  } catch (error) {
    return {
      verified: false,
      error
    };
  }
};
