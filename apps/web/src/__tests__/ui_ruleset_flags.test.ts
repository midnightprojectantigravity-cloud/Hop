import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState } from '@hop/engine';
import { UiRulesetSection, getUiRulesetFlags } from '../components/ui/ui-status-panel-sections';

describe('ui ruleset flags', () => {
  it('maps missing ruleset fields to false values', () => {
    const state = generateInitialState(1, 'ui-ruleset-flags-default');
    state.ruleset = undefined;

    expect(getUiRulesetFlags(state, 'force_reveal')).toEqual({
      acaeEnabled: false,
      sharedVectorCarryEnabled: false,
      capabilityPassivesEnabled: false,
      movementRuntimeEnabled: false,
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
        movementRuntimeEnabled: true,
        version: 'capabilities-v1'
      }
    };

    expect(getUiRulesetFlags(state, 'strict')).toEqual({
      acaeEnabled: true,
      sharedVectorCarryEnabled: true,
      capabilityPassivesEnabled: true,
      movementRuntimeEnabled: true,
      intelStrict: true
    });
  });

  it('hides intel controls when showIntelControls is false', () => {
    const state = generateInitialState(1, 'ui-ruleset-hide-intel');
    const html = renderToStaticMarkup(
      React.createElement(UiRulesetSection, {
        gameState: state,
        compact: false,
        intelMode: 'force_reveal',
        showIntelControls: false,
        onIntelModeChange: vi.fn()
      })
    );

    expect(html).not.toContain('Intel Strict');
    expect(html).not.toContain('Intel Mode');
  });

  it('shows intel controls when showIntelControls is true', () => {
    const state = generateInitialState(1, 'ui-ruleset-show-intel');
    const html = renderToStaticMarkup(
      React.createElement(UiRulesetSection, {
        gameState: state,
        compact: false,
        intelMode: 'strict',
        showIntelControls: true,
        onIntelModeChange: vi.fn()
      })
    );

    expect(html).toContain('Intel Strict');
    expect(html).toContain('Intel Mode');
    expect(html).toContain('Force');
    expect(html).toContain('Strict');
  });
});
