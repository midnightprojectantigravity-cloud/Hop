import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchSensoryEvent } from '../app/sensory-dispatcher';
import { emitUiMetric } from '../app/ui-telemetry';

vi.mock('../app/ui-telemetry', () => ({
  emitUiMetric: vi.fn()
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
            motion: 'snappy'
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
    expect((navigator as any).vibrate).not.toHaveBeenCalled();
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
});
