import { useState } from 'react';
import type { GridSize, MapShape } from '@hop/engine';
import { DEFAULT_START_RUN_MAP_SIZE, DEFAULT_START_RUN_MAP_SHAPE } from './start-run-overrides';

export const useHubSession = () => {
  const [hubMapShape, setHubMapShape] = useState<MapShape>(DEFAULT_START_RUN_MAP_SHAPE);
  const [hubMapSize, setHubMapSize] = useState<GridSize>(() => ({ ...DEFAULT_START_RUN_MAP_SIZE }));

  return {
    hubMapShape,
    setHubMapShape,
    hubMapSize,
    setHubMapSize
  };
};
