import type { Action, RunRulesetOverrides } from '@hop/engine';

export interface BuildCapabilityRulesetOverridesOptions {
  loadoutPassivesEnabled: boolean;
  movementRuntimeEnabled?: boolean;
}

export const buildCapabilityRulesetOverrides = ({
  loadoutPassivesEnabled,
  movementRuntimeEnabled = false
}: BuildCapabilityRulesetOverridesOptions): RunRulesetOverrides => ({
  capabilities: {
    loadoutPassivesEnabled,
    movementRuntimeEnabled
  }
});

export const buildCapabilityPassivesRulesetOverrides = (
  loadoutPassivesEnabled: boolean
): RunRulesetOverrides =>
  buildCapabilityRulesetOverrides({
    loadoutPassivesEnabled,
    movementRuntimeEnabled: false
  });

type StartRunPayload = Extract<Action, { type: 'START_RUN' }>['payload'];

export interface BuildStartRunPayloadOptions {
  loadoutId: string;
  mode?: 'normal' | 'daily';
  seed?: string;
  date?: string;
  capabilityPassivesEnabled: boolean;
  movementRuntimeEnabled?: boolean;
}

export const buildStartRunPayload = ({
  loadoutId,
  mode,
  seed,
  date,
  capabilityPassivesEnabled,
  movementRuntimeEnabled = false
}: BuildStartRunPayloadOptions): StartRunPayload => ({
  loadoutId,
  ...(mode ? { mode } : {}),
  ...(seed ? { seed } : {}),
  ...(date ? { date } : {}),
  rulesetOverrides: buildCapabilityRulesetOverrides({
    loadoutPassivesEnabled: capabilityPassivesEnabled,
    movementRuntimeEnabled
  })
});
