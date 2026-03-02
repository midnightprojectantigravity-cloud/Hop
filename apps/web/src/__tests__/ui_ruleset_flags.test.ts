import { describe, expect, it } from 'vitest';
import { generateInitialState } from '@hop/engine';
import { getUiRulesetFlags } from '../components/ui/ui-status-panel-sections';

describe('ui ruleset flags', () => {
  it('maps missing ruleset fields to false values', () => {
    const state = generateInitialState(1, 'ui-ruleset-flags-default');
    state.ruleset = undefined;

    expect(getUiRulesetFlags(state, 'force_reveal')).toEqual({
      acaeEnabled: false,
      sharedVectorCarryEnabled: false,
      capabilityPassivesEnabled: false,
      intelStrict: false
    });
  });

  it('maps explicit ruleset toggles to true values', () => {
    const state = generateInitialState(1, 'ui-ruleset-flags-enabled');
    state.ruleset = {
      ailments: {
        acaeEnabled: true,
        version: 'acae-v1'
      },
      attachments: {
        sharedVectorCarry: true,
        version: 'attachment-v1'
      },
      capabilities: {
        loadoutPassivesEnabled: true,
        version: 'capabilities-v1'
      }
    };

    expect(getUiRulesetFlags(state, 'strict')).toEqual({
      acaeEnabled: true,
      sharedVectorCarryEnabled: true,
      capabilityPassivesEnabled: true,
      intelStrict: true
    });
  });
});
