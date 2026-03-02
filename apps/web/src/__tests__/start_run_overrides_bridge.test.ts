import { describe, expect, it } from 'vitest';
import { gameReducer, generateInitialState } from '@hop/engine';
import {
  buildCapabilityPassivesRulesetOverrides,
  buildStartRunPayload
} from '../app/start-run-overrides';

describe('hub capability-passives start-run bridge', () => {
  it('builds deterministic capability overrides and start-run payloads', () => {
    expect(buildCapabilityPassivesRulesetOverrides(true)).toEqual({
      capabilities: { loadoutPassivesEnabled: true }
    });
    expect(buildCapabilityPassivesRulesetOverrides(false)).toEqual({
      capabilities: { loadoutPassivesEnabled: false }
    });
    expect(buildStartRunPayload({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      capabilityPassivesEnabled: true
    })).toEqual({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      rulesetOverrides: {
        capabilities: { loadoutPassivesEnabled: true }
      }
    });
  });

  it('applies enabled override into resolved run ruleset', () => {
    const hub = gameReducer(generateInitialState(1, 'hub-cap-pass-on'), { type: 'EXIT_TO_HUB' });
    const run = gameReducer(hub, {
      type: 'START_RUN',
      payload: {
        loadoutId: 'VANGUARD',
        mode: 'normal',
        rulesetOverrides: buildCapabilityPassivesRulesetOverrides(true)
      }
    });

    expect(run.ruleset?.capabilities?.loadoutPassivesEnabled).toBe(true);
    expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
  });

  it('applies disabled override into resolved run ruleset', () => {
    const hubBase = gameReducer(generateInitialState(1, 'hub-cap-pass-off'), { type: 'EXIT_TO_HUB' });
    const hub = {
      ...hubBase,
      ruleset: {
        ...(hubBase.ruleset || {}),
        capabilities: {
          loadoutPassivesEnabled: true,
          version: 'capabilities-v1' as const
        }
      }
    };
    const run = gameReducer(hub, {
      type: 'START_RUN',
      payload: {
        loadoutId: 'VANGUARD',
        mode: 'daily',
        rulesetOverrides: buildCapabilityPassivesRulesetOverrides(false)
      }
    });

    expect(run.ruleset?.capabilities?.loadoutPassivesEnabled).toBe(false);
    expect(run.ruleset?.capabilities?.version).toBe('capabilities-v1');
  });
});
