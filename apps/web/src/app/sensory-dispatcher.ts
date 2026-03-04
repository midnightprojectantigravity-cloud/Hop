import { emitUiMetric } from './ui-telemetry';

export type SensoryToken =
  | 'haptic-nav-light'
  | 'haptic-action-medium'
  | 'haptic-threat-heavy'
  | 'haptic-outcome-impact'
  | 'ui-parchment-slide'
  | 'ui-brass-clink'
  | 'ui-danger-drum'
  | 'ui-synapse-chime';

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

let activeLowTimer: number | null = null;

const clearActiveLow = () => {
  if (activeLowTimer !== null && typeof window !== 'undefined') {
    window.clearTimeout(activeLowTimer);
  }
  activeLowTimer = null;
};

const reducedMotionEnabled = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.dataset.motion === 'reduced';
};

const vibrateDevice = (payload: SensoryPayload): void => {
  if (payload.id.startsWith('ui-')) return;
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

  let preempted = false;
  if (normalized.priority === 'high') {
    if (activeLowTimer !== null) {
      preempted = true;
      clearActiveLow();
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
    activeLowTimer = window.setTimeout(() => {
      clearActiveLow();
    }, LOW_PRIORITY_TTL_MS);
  }

  vibrateDevice(normalized);

  return {
    dispatched: true,
    preempted,
    payload: normalized
  };
};

