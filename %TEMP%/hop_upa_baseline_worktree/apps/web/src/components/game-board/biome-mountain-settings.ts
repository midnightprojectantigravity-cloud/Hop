import type { CSSProperties } from 'react';
import type {
    VisualAssetEntry,
    VisualBiomeThemePreset,
    VisualBiomeWallsProfile,
    VisualBiomeWallsThemeOverride,
    VisualMountainRenderSettings,
} from '../../visual/asset-manifest';
import type { BoardBiomeDebug, ResolvedMountainRenderSettings } from './biome-visuals-types';
import { hexToRgb01, normalizeHexColor, resolveMountainBlendMode } from './biome-visuals-utils';

interface BuildMountainRenderSettingsArgs {
    asset?: VisualAssetEntry;
    biomeThemeKey: string;
    biomeDebug?: BoardBiomeDebug;
    biomeThemePreset?: VisualBiomeThemePreset;
    wallsProfile?: VisualBiomeWallsProfile;
    wallsThemeOverride?: VisualBiomeWallsThemeOverride;
    crustTintBlendMode: CSSProperties['mixBlendMode'];
    crustTintColor?: string;
    defaultMountainCrustBlendOpacity: number;
}

export const buildMountainRenderSettings = ({
    asset,
    biomeThemeKey,
    biomeDebug,
    biomeThemePreset,
    wallsProfile,
    wallsThemeOverride,
    crustTintBlendMode,
    crustTintColor,
    defaultMountainCrustBlendOpacity,
}: BuildMountainRenderSettingsArgs): ResolvedMountainRenderSettings => {
    const assetDefaults = asset?.mountainSettings as VisualMountainRenderSettings | undefined;
    const assetTheme = asset?.mountainSettingsByTheme?.[biomeThemeKey] as VisualMountainRenderSettings | undefined;
    const presetAssetOverride = asset ? biomeThemePreset?.assetOverrides?.[asset.id] : undefined;
    const presetAssetMountain = presetAssetOverride?.mountainSettings as VisualMountainRenderSettings | undefined;
    const scale = Math.min(3, Math.max(0.2, Number(
        biomeDebug?.mountainScale
        ?? presetAssetMountain?.scale
        ?? assetTheme?.scale
        ?? wallsThemeOverride?.scale
        ?? wallsProfile?.scale
        ?? assetDefaults?.scale
        ?? 0.95
    )));
    const offsetX = Number(
        biomeDebug?.mountainOffset?.x
        ?? presetAssetMountain?.offsetX
        ?? assetTheme?.offsetX
        ?? wallsThemeOverride?.offsetX
        ?? wallsProfile?.offsetX
        ?? assetDefaults?.offsetX
        ?? 0
    );
    const offsetY = Number(
        biomeDebug?.mountainOffset?.y
        ?? presetAssetMountain?.offsetY
        ?? assetTheme?.offsetY
        ?? wallsThemeOverride?.offsetY
        ?? wallsProfile?.offsetY
        ?? assetDefaults?.offsetY
        ?? 0
    );
    const anchorX = Math.min(1, Math.max(0, Number(
        biomeDebug?.mountainAnchor?.x
        ?? presetAssetMountain?.anchorX
        ?? assetTheme?.anchorX
        ?? wallsThemeOverride?.anchorX
        ?? wallsProfile?.anchorX
        ?? assetDefaults?.anchorX
        ?? 0.5
    )));
    const anchorY = Math.min(1, Math.max(0, Number(
        biomeDebug?.mountainAnchor?.y
        ?? presetAssetMountain?.anchorY
        ?? assetTheme?.anchorY
        ?? wallsThemeOverride?.anchorY
        ?? wallsProfile?.anchorY
        ?? assetDefaults?.anchorY
        ?? 0.78
    )));
    const crustBlendMode = resolveMountainBlendMode(
        biomeDebug?.mountainCrustBlendMode
        ?? presetAssetMountain?.crustBlendMode
        ?? assetTheme?.crustBlendMode
        ?? wallsThemeOverride?.crustBlendMode
        ?? wallsProfile?.crustBlendMode
        ?? assetDefaults?.crustBlendMode,
        crustTintBlendMode
    );
    const crustBlendOpacity = Math.min(1, Math.max(0, Number(
        biomeDebug?.mountainCrustBlendOpacity
        ?? presetAssetMountain?.crustBlendOpacity
        ?? assetTheme?.crustBlendOpacity
        ?? wallsThemeOverride?.crustBlendOpacity
        ?? wallsProfile?.crustBlendOpacity
        ?? assetDefaults?.crustBlendOpacity
        ?? defaultMountainCrustBlendOpacity
    )));
    const tintColor = normalizeHexColor(String(
        biomeDebug?.mountainTintColor
        ?? presetAssetMountain?.tintColor
        ?? assetTheme?.tintColor
        ?? wallsThemeOverride?.tintColor
        ?? wallsProfile?.tintColor
        ?? assetDefaults?.tintColor
        ?? crustTintColor
        ?? '#8b6f4a'
    ));
    const tintBlendMode = resolveMountainBlendMode(
        biomeDebug?.mountainTintBlendMode
        ?? presetAssetMountain?.tintBlendMode
        ?? assetTheme?.tintBlendMode
        ?? wallsThemeOverride?.tintBlendMode
        ?? wallsProfile?.tintBlendMode
        ?? assetDefaults?.tintBlendMode,
        'soft-light'
    );
    const tintOpacity = Math.min(1, Math.max(0, Number(
        biomeDebug?.mountainTintOpacity
        ?? presetAssetMountain?.tintOpacity
        ?? assetTheme?.tintOpacity
        ?? wallsThemeOverride?.tintOpacity
        ?? wallsProfile?.tintOpacity
        ?? assetDefaults?.tintOpacity
        ?? 0
    )));
    const rgb = hexToRgb01(tintColor);
    return {
        scale,
        offsetX,
        offsetY,
        anchorX,
        anchorY,
        crustBlendMode,
        crustBlendOpacity,
        tintColor,
        tintBlendMode,
        tintOpacity,
        tintMatrixValues: `0 0 0 0 ${rgb.r.toFixed(4)} 0 0 0 0 ${rgb.g.toFixed(4)} 0 0 0 0 ${rgb.b.toFixed(4)} 0 0 0 1 0`
    };
};

