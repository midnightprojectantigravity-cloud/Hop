export interface UiCapabilityRollout {
  capabilityPassivesEnabled: boolean;
  movementRuntimeEnabled: boolean;
}

const QUERY_KEY_CAPABILITY_PASSIVES = 'cap_passives';
const QUERY_KEY_MOVEMENT_RUNTIME = 'movement_runtime';

const normalizeToggle = (value: string | null | undefined): boolean | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === '1'
    || normalized === 'true'
    || normalized === 'on'
    || normalized === 'enabled'
  ) {
    return true;
  }
  if (
    normalized === '0'
    || normalized === 'false'
    || normalized === 'off'
    || normalized === 'disabled'
  ) {
    return false;
  }
  return null;
};

const resolveRolloutFromQuery = (search: string): Partial<UiCapabilityRollout> => {
  const params = new URLSearchParams(search);
  const capabilityPassivesEnabled = normalizeToggle(params.get(QUERY_KEY_CAPABILITY_PASSIVES));
  const movementRuntimeEnabled = normalizeToggle(params.get(QUERY_KEY_MOVEMENT_RUNTIME));
  return {
    ...(capabilityPassivesEnabled !== null ? { capabilityPassivesEnabled } : {}),
    ...(movementRuntimeEnabled !== null ? { movementRuntimeEnabled } : {})
  };
};

const resolveRolloutFromEnv = (
  capabilityPassivesEnv?: string | null,
  movementRuntimeEnv?: string | null
): Partial<UiCapabilityRollout> => {
  const capabilityPassivesEnabled = normalizeToggle(
    capabilityPassivesEnv ?? import.meta.env.VITE_CAPABILITY_PASSIVES_DEFAULT
  );
  const movementRuntimeEnabled = normalizeToggle(
    movementRuntimeEnv ?? import.meta.env.VITE_MOVEMENT_RUNTIME_DEFAULT
  );
  return {
    ...(capabilityPassivesEnabled !== null ? { capabilityPassivesEnabled } : {}),
    ...(movementRuntimeEnabled !== null ? { movementRuntimeEnabled } : {})
  };
};

export const resolveUiCapabilityRollout = (options: {
  search?: string;
  envCapabilityPassives?: string | null;
  envMovementRuntime?: string | null;
} = {}): UiCapabilityRollout => {
  const search = options.search ?? (typeof window === 'undefined' ? '' : window.location.search);
  const fromQuery = resolveRolloutFromQuery(search);
  const fromEnv = resolveRolloutFromEnv(options.envCapabilityPassives, options.envMovementRuntime);
  return {
    capabilityPassivesEnabled: fromQuery.capabilityPassivesEnabled ?? fromEnv.capabilityPassivesEnabled ?? false,
    movementRuntimeEnabled: fromQuery.movementRuntimeEnabled ?? fromEnv.movementRuntimeEnabled ?? false
  };
};

export const getUiCapabilityRollout = (): UiCapabilityRollout =>
  resolveUiCapabilityRollout();

export const setUiCapabilityRollout = (rollout: Partial<UiCapabilityRollout>): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (rollout.capabilityPassivesEnabled !== undefined) {
    url.searchParams.set(QUERY_KEY_CAPABILITY_PASSIVES, rollout.capabilityPassivesEnabled ? 'on' : 'off');
  }
  if (rollout.movementRuntimeEnabled !== undefined) {
    url.searchParams.set(QUERY_KEY_MOVEMENT_RUNTIME, rollout.movementRuntimeEnabled ? 'on' : 'off');
  }
  window.history.replaceState({}, '', url.toString());
};
