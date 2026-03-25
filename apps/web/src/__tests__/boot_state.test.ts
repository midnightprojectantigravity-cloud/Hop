import { describe, expect, it } from 'vitest';
import { deriveBootState } from '../app/boot-state';

describe('boot state', () => {
  it('reports phased readiness before the visual manifest is ready', () => {
    const state = deriveBootState({
      shellReady: true,
      assetManifestReady: false
    });

    expect(state.phase).toBe('assets');
    expect(state.statusLine).toBe('Loading visual manifest...');
    expect(state.milestones.find((entry) => entry.id === 'shell')?.ready).toBe(true);
    expect(state.milestones.find((entry) => entry.id === 'assets')?.ready).toBe(false);
  });

  it('stays in shell phase until the shell is mounted', () => {
    const state = deriveBootState({
      shellReady: false,
      assetManifestReady: false
    });

    expect(state.phase).toBe('shell');
    expect(state.statusLine).toBe('Mounting shell...');
    expect(state.ready).toBe(false);
  });

  it('marks the boot sequence ready once shell and assets are available', () => {
    const state = deriveBootState({
      shellReady: true,
      assetManifestReady: true
    });

    expect(state.phase).toBe('ready');
    expect(state.statusLine).toBe('Hub ready');
    expect(state.milestones.every((entry) => entry.ready)).toBe(true);
  });
});
