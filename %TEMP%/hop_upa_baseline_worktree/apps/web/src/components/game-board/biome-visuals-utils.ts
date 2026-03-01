import type { CSSProperties } from 'react';
import type { LayerMode, LayerScroll } from './biome-visuals-types';
import type { VisualBiomeTextureLayer, VisualBiomeTintProfile, VisualBlendMode } from '../../visual/asset-manifest';

export const hashString = (input: string): number => {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

export const resolveBiomeLayerPath = (layer: VisualBiomeTextureLayer | undefined, theme: string): string | undefined => {
    if (!layer) return undefined;
    if (theme && layer.themes?.[theme]) return layer.themes[theme];
    return layer.default;
};

export const readLayerMode = (layer?: VisualBiomeTextureLayer): LayerMode => {
    if (!layer) return 'off';
    if (layer.mode === 'cover' || layer.mode === 'repeat' || layer.mode === 'off') return layer.mode;
    return 'cover';
};

export const readLayerOpacity = (layer?: VisualBiomeTextureLayer): number =>
    Math.min(1, Math.max(0, Number(layer?.opacity ?? 1)));

export const readLayerScalePx = (
    layer: VisualBiomeTextureLayer | undefined,
    fallbackPx: number,
    floorPx = 64,
    ceilPx = Number.POSITIVE_INFINITY
): number => {
    const raw = Number(layer?.scalePx || fallbackPx);
    return Math.min(ceilPx, Math.max(floorPx, raw));
};

export const readLayerScroll = (layer?: VisualBiomeTextureLayer): LayerScroll => ({
    x: Number(layer?.scroll?.x ?? 0),
    y: Number(layer?.scroll?.y ?? 0),
    durationMs: Math.max(1000, Number(layer?.scroll?.durationMs ?? 18000))
});

export const resolveTintColor = (tint: VisualBiomeTintProfile | undefined, theme: string): string | undefined => {
    if (!tint) return undefined;
    if (theme && tint.themes?.[theme]) return tint.themes[theme];
    return tint.default;
};

export const readTintOpacity = (tint?: VisualBiomeTintProfile): number =>
    Math.min(1, Math.max(0, Number(tint?.opacity ?? 0)));

export const readBlendMode = (blend?: VisualBlendMode): CSSProperties['mixBlendMode'] => {
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

export const hexToRgb01 = (hex: string): { r: number; g: number; b: number } => {
    const normalized = normalizeHexColor(hex);
    const value = normalized.slice(1);
    return {
        r: parseInt(value.slice(0, 2), 16) / 255,
        g: parseInt(value.slice(2, 4), 16) / 255,
        b: parseInt(value.slice(4, 6), 16) / 255
    };
};

export const resolveMountainBlendMode = (
    value: 'off' | VisualBlendMode | undefined,
    fallback: CSSProperties['mixBlendMode'] | 'off'
): CSSProperties['mixBlendMode'] | 'off' => {
    if (value === 'off') return 'off';
    if (value) return readBlendMode(value);
    return fallback;
};

export const getHexPoints = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

