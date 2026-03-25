import { useState } from 'react';
import type { GridSize, MapShape } from '@hop/engine';
import { getUiCapabilityRollout } from './capability-rollout';
import { DEFAULT_START_RUN_MAP_SIZE, DEFAULT_START_RUN_MAP_SHAPE } from './start-run-overrides';

export const useHubSession = () => {
  const [hubCapabilityPassivesEnabled, setHubCapabilityPassivesEnabled] = useState(
    () => getUiCapabilityRollout().capabilityPassivesEnabled
  );
  const [hubMovementRuntimeEnabled, setHubMovementRuntimeEnabled] = useState(
    () => getUiCapabilityRollout().movementRuntimeEnabled
  );
  const [hubMapShape, setHubMapShape] = useState<MapShape>(DEFAULT_START_RUN_MAP_SHAPE);
  const [hubMapSize, setHubMapSize] = useState<GridSize>(() => ({ ...DEFAULT_START_RUN_MAP_SIZE }));

  return {
    hubCapabilityPassivesEnabled,
    setHubCapabilityPassivesEnabled,
    hubMovementRuntimeEnabled,
    setHubMovementRuntimeEnabled,
    hubMapShape,
    setHubMapShape,
    hubMapSize,
    setHubMapSize
  };
};
