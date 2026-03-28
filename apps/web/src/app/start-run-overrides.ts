import type { Action, GridSize, MapShape } from '@hop/engine';

export const DEFAULT_START_RUN_MAP_SIZE: GridSize = {
  width: 9,
  height: 11
};

export const DEFAULT_START_RUN_MAP_SHAPE: MapShape = 'diamond';

export type MapSizeInputMode = 'usable' | 'grid';

const normalizePositiveInt = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const getRectangleHeightOffset = (width: number): number => Math.floor((width - 1) / 2);

/**
 * Hub map-size controls represent playable dimensions.
 * Rectangle runs require extra hidden row capacity to realize those playable rows
 * in positive-only axial coordinates.
 */
export const resolveEngineGridSizeFromInput = (
  inputSize: GridSize,
  mapShape: MapShape,
  inputMode: MapSizeInputMode
): GridSize => {
  const width = normalizePositiveInt(inputSize?.width) ?? DEFAULT_START_RUN_MAP_SIZE.width;
  const height = normalizePositiveInt(inputSize?.height) ?? DEFAULT_START_RUN_MAP_SIZE.height;

  if (inputMode === 'grid') {
    return { width, height };
  }

  if (mapShape !== 'rectangle') {
    return { width, height };
  }

  return {
    width,
    height: height + getRectangleHeightOffset(width)
  };
};

type StartRunPayload = Extract<Action, { type: 'START_RUN' }>['payload'];

export interface BuildStartRunPayloadOptions {
  loadoutId: string;
  mode?: 'normal' | 'daily';
  seed?: string;
  date?: string;
  mapSize?: GridSize;
  mapShape?: MapShape;
  mapSizeInputMode?: MapSizeInputMode;
}

export const buildStartRunPayload = ({
  loadoutId,
  mode,
  seed,
  date,
  mapSize,
  mapShape,
  mapSizeInputMode = 'usable'
}: BuildStartRunPayloadOptions): StartRunPayload => {
  const resolvedMapShape: MapShape = mapShape === 'rectangle' ? 'rectangle' : 'diamond';
  const resolvedMapSize = mapSize
    ? resolveEngineGridSizeFromInput(mapSize, resolvedMapShape, mapSizeInputMode)
    : undefined;

  return {
    loadoutId,
    ...(mode ? { mode } : {}),
    ...(seed ? { seed } : {}),
    ...(date ? { date } : {}),
    ...(resolvedMapSize ? { mapSize: resolvedMapSize } : {}),
    ...(mapShape ? { mapShape } : {})
  };
};
