import { beforeEach, describe, expect, it, vi } from 'vitest';
import { playSensoryAudio, resetSensoryAudioRuntimeForTests } from '../app/sensory-audio-runtime';

const oscillator = {
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  frequency: { value: 0 },
  type: 'sine' as OscillatorType
};

const gain = {
  connect: vi.fn(),
  gain: { value: 0 }
};

describe('sensory audio runtime', () => {
  beforeEach(() => {
    resetSensoryAudioRuntimeForTests();
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          version: 1,
          tokens: {
            'ui-confirm': {
              type: 'oscillator',
              waveform: 'triangle',
              frequency: 600,
              durationMs: 65,
              gain: 0.05
            }
          }
        })
      })
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        AudioContext: vi.fn(() => ({
          state: 'running',
          currentTime: 0,
          destination: {},
          resume: vi.fn().mockResolvedValue(undefined),
          createOscillator: vi.fn(() => oscillator),
          createGain: vi.fn(() => gain)
        }))
      }
    });
  });

  it('loads the manifest and plays a mapped oscillator token', async () => {
    await playSensoryAudio('ui-confirm', 1.0);

    expect(fetch).toHaveBeenCalledWith('/audio/manifest.json');
    expect(oscillator.start).toHaveBeenCalled();
    expect(oscillator.stop).toHaveBeenCalled();
    expect(gain.gain.value).toBeGreaterThan(0);
  });
});
