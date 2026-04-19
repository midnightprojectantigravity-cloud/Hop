import {
  DEFAULT_START_RUN_MAP_SHAPE as ENGINE_DEFAULT_START_RUN_MAP_SHAPE,
  DEFAULT_START_RUN_MAP_SIZE as ENGINE_DEFAULT_START_RUN_MAP_SIZE,
} from '@hop/engine';
import type { Action, FloorTheme, GridSize, MapShape } from '@hop/engine';

export const DEFAULT_START_RUN_MAP_SIZE: GridSize = {
  ...ENGINE_DEFAULT_START_RUN_MAP_SIZE
};

export const DEFAULT_START_RUN_MAP_SHAPE: MapShape = ENGINE_DEFAULT_START_RUN_MAP_SHAPE;

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
  themeId?: FloorTheme;
  contentThemeId?: FloorTheme;
  mapSizeInputMode?: MapSizeInputMode;
}

export const buildStartRunPayload = ({
  loadoutId,
  mode,
  seed,
  date,
  mapSize,
  mapShape,
  themeId,
  contentThemeId,
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
    ...(mapShape ? { mapShape } : {}),
    ...(themeId ? { themeId } : {}),
    ...((contentThemeId || themeId) ? { contentThemeId: contentThemeId || themeId } : {})
  };
};
