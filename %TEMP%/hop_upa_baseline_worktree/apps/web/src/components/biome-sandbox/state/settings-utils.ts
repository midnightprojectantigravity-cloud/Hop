import type {
  BlendMode,
  MountainBlendMode
} from '../types';

export const UNDERCURRENT_SCALE_MIN = 64;
export const UNDERCURRENT_SCALE_MAX = 192;
export const DETAIL_SCALE_MIN = 64;
export const DETAIL_SCALE_MAX = 512;

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export const toNumber = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeHexColor = (value: string, fallback = '#8b6f4a'): string => {
  const raw = String(value || '').trim();
  const fullHex = /^#([0-9a-f]{6})$/i;
  if (fullHex.test(raw)) return raw.toLowerCase();
  const shortHex = /^#([0-9a-f]{3})$/i;
  if (shortHex.test(raw)) {
    const [r, g, b] = raw.slice(1).split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return fallback;
};

export const readBlendMode = (blend: unknown): BlendMode => {
  if (
    blend === 'normal'
    || blend === 'multiply'
    || blend === 'overlay'
    || blend === 'soft-light'
    || blend === 'screen'
    || blend === 'color-dodge'
  ) {
    return blend;
  }
  return 'multiply';
};

export const readMountainBlendMode = (blend: unknown): MountainBlendMode => {
  if (blend === 'off') return 'off';
  return readBlendMode(blend);
};

