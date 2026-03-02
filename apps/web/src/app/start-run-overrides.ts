import type { RunRulesetOverrides } from '@hop/engine';

export const buildCapabilityPassivesRulesetOverrides = (
  loadoutPassivesEnabled: boolean
): RunRulesetOverrides => ({
  capabilities: {
    loadoutPassivesEnabled
  }
});

