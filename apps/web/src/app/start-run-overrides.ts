import type { Action, RunRulesetOverrides } from '@hop/engine';

export const buildCapabilityPassivesRulesetOverrides = (
  loadoutPassivesEnabled: boolean
): RunRulesetOverrides => ({
  capabilities: {
    loadoutPassivesEnabled
  }
});

type StartRunPayload = Extract<Action, { type: 'START_RUN' }>['payload'];

export interface BuildStartRunPayloadOptions {
  loadoutId: string;
  mode?: 'normal' | 'daily';
  seed?: string;
  date?: string;
  capabilityPassivesEnabled: boolean;
}

export const buildStartRunPayload = ({
  loadoutId,
  mode,
  seed,
  date,
  capabilityPassivesEnabled
}: BuildStartRunPayloadOptions): StartRunPayload => ({
  loadoutId,
  ...(mode ? { mode } : {}),
  ...(seed ? { seed } : {}),
  ...(date ? { date } : {}),
  rulesetOverrides: buildCapabilityPassivesRulesetOverrides(capabilityPassivesEnabled)
});
