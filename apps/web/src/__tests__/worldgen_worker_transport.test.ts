import { describe, expect, it } from 'vitest';
import { gameReducer, generateInitialState } from '@hop/engine';
import {
  assertStructuredCloneSafeWorldgenPayload,
  buildStartRunCompileContext,
  buildTransitionCompileContext,
} from '../app/worldgen-transport';
import {
  buildStartRunPayload,
  DEFAULT_START_RUN_MAP_SHAPE,
  DEFAULT_START_RUN_MAP_SIZE,
} from '../app/start-run-overrides';

describe('worldgen worker transport', () => {
  it('builds a structured-clone-safe start-run payload', () => {
    const payload = buildStartRunPayload({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      mapSize: DEFAULT_START_RUN_MAP_SIZE,
      mapShape: DEFAULT_START_RUN_MAP_SHAPE
    });

    const context = buildStartRunCompileContext({
      loadoutId: payload.loadoutId,
      mode: payload.mode,
      seed: payload.seed,
      date: payload.date,
      mapSize: payload.mapSize,
      mapShape: payload.mapShape,
      generationSpec: payload.generationSpec,
      includeDebug: true
    });

    expect(() => assertStructuredCloneSafeWorldgenPayload(context)).not.toThrow();
  });

  it('sanitizes floor-transition payloads so active skills are structured-clone safe', () => {
    const base = generateInitialState(1, 'worldgen-transport-seed', 'worldgen-transport-seed');
    const hub = gameReducer(base, { type: 'EXIT_TO_HUB' });
    const run = gameReducer(hub, {
      type: 'START_RUN',
      payload: {
        loadoutId: 'SKIRMISHER',
        mode: 'normal'
      }
    });

    const context = buildTransitionCompileContext(run, false);

    expect(() => assertStructuredCloneSafeWorldgenPayload(context)).not.toThrow();
    expect(context.playerCarryover.activeSkills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(String),
          currentCooldown: expect.any(Number),
          activeUpgrades: expect.any(Array),
          upgrades: expect.any(Array)
        })
      ])
    );
  });
});
