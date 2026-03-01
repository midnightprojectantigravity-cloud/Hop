import type { Dispatch, SetStateAction } from 'react';
import type { FloorTheme } from '@hop/engine';
import type {
  BiomeSandboxPathSets,
  BiomeSandboxSettings,
  BlendMode,
  LayerMode,
  MountainBlendMode,
  WallMode
} from '../types';

export type BiomeSandboxSettingsSetter = Dispatch<SetStateAction<BiomeSandboxSettings | null>>;

export interface BiomeSandboxSectionProps {
  settings: BiomeSandboxSettings;
  setSettings: BiomeSandboxSettingsSetter;
}

export interface BiomeSandboxPathSectionProps extends BiomeSandboxSectionProps {
  pathSets: BiomeSandboxPathSets;
}

export const FLOOR_THEMES: FloorTheme[] = ['catacombs', 'inferno', 'throne', 'frozen', 'void'];
export const MODE_OPTIONS: LayerMode[] = ['off', 'repeat', 'cover'];
export const BLEND_OPTIONS: BlendMode[] = ['normal', 'multiply', 'overlay', 'soft-light', 'screen', 'color-dodge'];
export const MOUNTAIN_BLEND_OPTIONS: MountainBlendMode[] = ['off', 'multiply', 'overlay', 'soft-light', 'screen', 'color-dodge', 'normal'];
export const TINT_SWATCHES: string[] = ['#8b6f4a', '#8f4a2e', '#5b6d41', '#536e8e', '#5f5977', '#b79a73', '#d15a3a', '#3e4f3a'];
export const WALL_MODE_OPTIONS: WallMode[] = ['native', 'additive', 'custom'];
