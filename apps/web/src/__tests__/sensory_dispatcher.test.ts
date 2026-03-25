import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchSensoryEvent } from '../app/sensory-dispatcher';
import { emitUiMetric } from '../app/ui-telemetry';
import { playSensoryAudio } from '../app/sensory-audio-runtime';

vi.mock('../app/ui-telemetry', () => ({
  emitUiMetric: vi.fn()
}));

vi.mock('../app/sensory-audio-runtime', () => ({
  playSensoryAudio: vi.fn()
}));

describe('sensory dispatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        documentElement: {
          dataset: {
            motion: 'snappy',
            audioEnabled: 'true',
            hapticsEnabled: 'true'
          }
        }
      }
    });
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        vibrate: vi.fn()
      }
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('clamps intensity to 0.0 in reduced motion mode', () => {
    (document.documentElement.dataset as Record<string, string>).motion = 'reduced';
    const result = dispatchSensoryEvent({
      id: 'haptic-action-medium',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    expect(result.payload.intensity).toBe(0.0);
    expect((navigator as unknown as { vibrate: ReturnType<typeof vi.fn> }).vibrate).not.toHaveBeenCalled();
  });

  it('preempts active low-priority output with high-priority event', () => {
    dispatchSensoryEvent({
      id: 'haptic-nav-light',
      intensity: 1.0,
      priority: 'low',
      context: 'hub'
    });
    const result = dispatchSensoryEvent({
      id: 'haptic-outcome-impact',
      intensity: 1.0,
      priority: 'high',
      context: 'run'
    });
    expect(result.preempted).toBe(true);
    expect(emitUiMetric).toHaveBeenCalledWith(
      'sensory_preemption_count',
      1,
      expect.objectContaining({ context: 'run' })
    );
  });

  it('drops overlapping low-priority events', () => {
    dispatchSensoryEvent({
      id: 'haptic-nav-light',
      intensity: 1.0,
      priority: 'low',
      context: 'hub'
    });
    const dropped = dispatchSensoryEvent({
      id: 'haptic-action-medium',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    expect(dropped.dispatched).toBe(false);
    expect(emitUiMetric).toHaveBeenCalledWith(
      'sensory_low_priority_dropped_count',
      1,
      expect.objectContaining({ context: 'run' })
    );
  });

  it('dispatches audio-backed tokens through the audio runtime', () => {
    dispatchSensoryEvent({
      id: 'ui-confirm',
      intensity: 1.0,
      priority: 'low',
      context: 'run'
    });
    expect(playSensoryAudio).toHaveBeenCalledWith('ui-confirm', 1.0);
    expect((navigator as unknown as { vibrate: ReturnType<typeof vi.fn> }).vibrate).not.toHaveBeenCalled();
  });

  it('respects disabled audio and haptics preferences', () => {
    (document.documentElement.dataset as Record<string, string>).audioEnabled = 'false';
    (document.documentElement.dataset as Record<string, string>).hapticsEnabled = 'false';
    dispatchSensoryEvent({
      id: 'ui-confirm',
      intensity: 1.0,
      priority: 'high',
      context: 'run'
    });
    dispatchSensoryEvent({
      id: 'haptic-action-medium',
      intensity: 1.0,
      priority: 'high',
      context: 'run'
    });
    expect(playSensoryAudio).not.toHaveBeenCalled();
    expect((navigator as unknown as { vibrate: ReturnType<typeof vi.fn> }).vibrate).not.toHaveBeenCalled();
  });
});
