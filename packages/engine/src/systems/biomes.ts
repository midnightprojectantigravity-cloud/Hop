import type { FloorTheme } from '../types';

export type BiomeHazardFlavor = 'burn' | 'poison';

export const resolveBiomeHazardTileId = (theme?: FloorTheme): 'LAVA' | 'TOXIC' =>
    theme === 'void' ? 'TOXIC' : 'LAVA';

export const resolveBiomeHazardFlavor = (theme?: FloorTheme): BiomeHazardFlavor =>
    theme === 'void' ? 'poison' : 'burn';
