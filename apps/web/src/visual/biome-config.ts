export type BiomeColor = 'white' | 'blue' | 'black' | 'red' | 'green';

export const BIOME_COLORS: readonly BiomeColor[] = ['white', 'blue', 'black', 'red', 'green'] as const;

type BiomeVisualSpec = {
  floorAssetId: string;
  hazardAssetId: string;
  label: string;
};

export const BIOME_VISUALS: Record<BiomeColor, BiomeVisualSpec> = {
  white: {
    label: 'Plains / Mesa',
    floorAssetId: 'tile.catacombs.floor.01',
    hazardAssetId: 'tile.catacombs.lava.01'
  },
  blue: {
    label: 'Islands / Coast',
    floorAssetId: 'tile.frozen.floor.01',
    hazardAssetId: 'tile.catacombs.lava.01'
  },
  black: {
    label: 'Swamp / Wastes',
    floorAssetId: 'tile.void.floor.01',
    hazardAssetId: 'tile.catacombs.lava.01'
  },
  red: {
    label: 'Mountains / Volcanic',
    floorAssetId: 'tile.inferno.floor.01',
    hazardAssetId: 'tile.inferno.lava.01'
  },
  green: {
    label: 'Forest / Jungle',
    floorAssetId: 'tile.throne.floor.01',
    hazardAssetId: 'tile.catacombs.lava.01'
  }
};

export const THEME_TO_BIOME: Record<string, BiomeColor> = {
  catacombs: 'white',
  frozen: 'blue',
  void: 'black',
  inferno: 'red',
  throne: 'green'
};

const asBiomeColor = (value: unknown): BiomeColor | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase() as BiomeColor;
  return BIOME_COLORS.includes(normalized) ? normalized : undefined;
};

export const getForcedBiomeColor = (): BiomeColor | undefined => {
  if (typeof window === 'undefined') return undefined;
  return asBiomeColor((window as any).__HOP_FORCE_BIOME);
};

export const resolveBiomeColor = (theme?: string): BiomeColor => {
  const forced = getForcedBiomeColor();
  if (forced) return forced;
  const normalized = String(theme || '').toLowerCase();
  return THEME_TO_BIOME[normalized] || 'white';
};

