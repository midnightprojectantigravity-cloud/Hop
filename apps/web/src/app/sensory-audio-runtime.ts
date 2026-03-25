import { emitUiMetric } from './ui-telemetry';
import type { SensoryToken } from './sensory-dispatcher';

type AudioManifestEntry = {
  type: 'oscillator';
  waveform: OscillatorType;
  frequency: number;
  durationMs: number;
  gain: number;
};

type AudioManifest = {
  version: 1;
  tokens: Partial<Record<SensoryToken, AudioManifestEntry>>;
};

let manifestPromise: Promise<AudioManifest | null> | null = null;
let audioContextRef: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!audioContextRef) {
    audioContextRef = new AudioContextCtor();
  }
  return audioContextRef;
};

const loadManifest = async (): Promise<AudioManifest | null> => {
  if (!manifestPromise) {
    manifestPromise = fetch('/audio/manifest.json')
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<AudioManifest>;
      })
      .catch(() => null);
  }
  return manifestPromise;
};

export const resetSensoryAudioRuntimeForTests = (): void => {
  manifestPromise = null;
  audioContextRef = null;
};

export const playSensoryAudio = async (token: SensoryToken, intensity: number): Promise<void> => {
  if (intensity <= 0) return;
  const manifest = await loadManifest();
  const entry = manifest?.tokens[token];
  if (!entry || entry.type !== 'oscillator') return;

  const context = getAudioContext();
  if (!context) return;

  try {
    if (context.state === 'suspended') {
      await context.resume().catch(() => undefined);
    }

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = entry.waveform;
    oscillator.frequency.value = entry.frequency;
    gain.gain.value = Math.max(0.0001, Math.min(0.2, entry.gain * intensity));
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + entry.durationMs / 1000);
  } catch (error) {
    emitUiMetric('sensory_audio_failure_count', 1, {
      token,
      message: error instanceof Error ? error.message : 'unknown'
    });
  }
};
