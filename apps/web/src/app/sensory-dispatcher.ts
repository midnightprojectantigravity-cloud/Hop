import { emitUiMetric } from './ui-telemetry';
import { playSensoryAudio } from './sensory-audio-runtime';

export type SensoryToken =
  | 'haptic-nav-light'
  | 'haptic-action-medium'
  | 'haptic-threat-heavy'
  | 'haptic-outcome-impact'
  | 'ui-parchment-slide'
  | 'ui-brass-clink'
  | 'ui-danger-drum'
  | 'ui-synapse-chime'
  | 'ui-tap'
  | 'ui-confirm'
  | 'ui-cancel'
  | 'combat-hit-light'
  | 'combat-hit-heavy'
  | 'combat-receive'
  | 'combat-kill'
  | 'run-floor-transition'
  | 'run-victory'
  | 'run-defeat';

export type SensoryPayload = {
  id: SensoryToken;
  intensity: 0.0 | 1.0;
  priority: 'low' | 'high';
  context: 'run' | 'hub';
};

export type SensoryDispatchResult = {
  dispatched: boolean;
  preempted: boolean;
  payload: SensoryPayload;
};

const LOW_PRIORITY_TTL_MS = 120;

let activeLowAudioTimer: number | null = null;
let activeLowHapticTimer: number | null = null;

const clearTimer = (timer: number | null): number | null => {
  if (timer !== null && typeof window !== 'undefined') {
    window.clearTimeout(timer);
  }
  return null;
};

const clearAllActiveLow = () => {
  activeLowAudioTimer = clearTimer(activeLowAudioTimer);
  activeLowHapticTimer = clearTimer(activeLowHapticTimer);
};

const reducedMotionEnabled = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.motion === 'reduced';
};

const hapticsEnabled = (): boolean => {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.hapticsEnabled !== 'false';
};

const audioEnabled = (): boolean => {
  if (typeof document === 'undefined') return true;
  return document.documentElement.dataset.audioEnabled !== 'false';
};

const isAudioToken = (id: SensoryToken): boolean =>
  id.startsWith('ui-') || id.startsWith('combat-') || id.startsWith('run-');

const vibrateDevice = (payload: SensoryPayload): void => {
  if (!hapticsEnabled()) return;
  if (isAudioToken(payload.id)) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (payload.intensity <= 0) return;

  const pattern = payload.priority === 'high' ? [35, 15, 35] : [22];
  navigator.vibrate(pattern);
};

export const dispatchSensoryEvent = (input: SensoryPayload): SensoryDispatchResult => {
  const normalized: SensoryPayload = {
    ...input,
    intensity: reducedMotionEnabled() ? 0.0 : input.intensity
  };
  const audioToken = isAudioToken(normalized.id);
  const activeLowTimer = audioToken ? activeLowAudioTimer : activeLowHapticTimer;

  let preempted = false;
  if (normalized.priority === 'high') {
    if (activeLowAudioTimer !== null || activeLowHapticTimer !== null) {
      preempted = true;
      clearAllActiveLow();
      emitUiMetric('sensory_preemption_count', 1, {
        id: normalized.id,
        context: normalized.context
      });
    }
  } else if (activeLowTimer !== null) {
    emitUiMetric('sensory_low_priority_dropped_count', 1, {
      id: normalized.id,
      context: normalized.context
    });
    return {
      dispatched: false,
      preempted: false,
      payload: normalized
    };
  }

  if (typeof window !== 'undefined' && normalized.priority === 'low') {
    const timer = window.setTimeout(() => {
      if (audioToken) {
        activeLowAudioTimer = clearTimer(activeLowAudioTimer);
      } else {
        activeLowHapticTimer = clearTimer(activeLowHapticTimer);
      }
    }, LOW_PRIORITY_TTL_MS);
    if (audioToken) {
      activeLowAudioTimer = timer;
    } else {
      activeLowHapticTimer = timer;
    }
  }

  vibrateDevice(normalized);
  if (audioEnabled() && isAudioToken(normalized.id)) {
    playSensoryAudio(normalized.id, normalized.intensity);
  }

  return {
    dispatched: true,
    preempted,
    payload: normalized
  };
};
