import { useCallback, useMemo } from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, UnifiedTileService, type GameState, type Point } from '@hop/engine';
import type {
    VisualAssetEntry,
    VisualAssetManifest,
    VisualBiomeClutterLayer,
    VisualBiomeMaterialProfile,
    VisualBiomeTextureLayer,
    VisualBiomeThemePreset,
    VisualBiomeTintProfile,
    VisualBiomeWallsProfile,
    VisualBiomeWallsThemeOverride,
    VisualBlendMode,
    VisualMountainRenderSettings,
} from '../../visual/asset-manifest';
import { getBiomeThemePreset } from '../../visual/asset-manifest';
import { resolveDeathDecalAssetId, resolvePropAssetId } from '../../visual/asset-selectors';

type TileVisualFlags = { isWall: boolean; isLava: boolean; isFire: boolean };
type Vec2 = { x: number; y: number };
type LayerScroll = Vec2 & { durationMs: number };
type FrameRect = { x: number; y: number; width: number; height: number };
type MaskHole = { key: string; x: number; y: number };

type BoardProp = {
    id: string;
    kind: 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
};

type ResolvedMountainRenderSettings = {
    scale: number;
    offsetX: number;
    offsetY: number;
    anchorX: number;
    anchorY: number;
    crustBlendMode: React.CSSProperties['mixBlendMode'] | 'off';
    crustBlendOpacity: number;
    tintColor: string;
    tintBlendMode: React.CSSProperties['mixBlendMode'] | 'off';
    tintOpacity: number;
    tintMatrixValues: string;
};

type LayerMode = 'off' | 'cover' | 'repeat';

interface BoardBounds {
    minX: number;
    minY: number;
    width: number;
    height: number;
}

interface BoardBiomeDebug {
    undercurrentOffset?: { x: number; y: number };
    crustOffset?: { x: number; y: number };
    mountainAssetPath?: string;
    mountainScale?: number;
    mountainOffset?: { x: number; y: number };
    mountainAnchor?: { x: number; y: number };
    mountainCrustBlendMode?: 'off' | VisualBlendMode;
    mountainCrustBlendOpacity?: number;
    mountainTintColor?: string;
    mountainTintBlendMode?: 'off' | VisualBlendMode;
    mountainTintOpacity?: number;
}

interface UseBoardBiomeVisualsArgs {
    cells: Point[];
    gameState: GameState;
    bounds: BoardBounds;
    assetManifest?: VisualAssetManifest | null;
    biomeDebug?: BoardBiomeDebug;
}

const hashString = (input: string): number => {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const resolveBiomeLayerPath = (layer: VisualBiomeTextureLayer | undefined, theme: string): string | undefined => {
    if (!layer) return undefined;
    if (theme && layer.themes?.[theme]) return layer.themes[theme];
    return layer.default;
};

const readLayerMode = (layer?: VisualBiomeTextureLayer): LayerMode => {
    if (!layer) return 'off';
    if (layer.mode === 'cover' || layer.mode === 'repeat' || layer.mode === 'off') return layer.mode;
    return 'cover';
};

const readLayerOpacity = (layer?: VisualBiomeTextureLayer): number =>
    Math.min(1, Math.max(0, Number(layer?.opacity ?? 1)));

const readLayerScalePx = (
    layer: VisualBiomeTextureLayer | undefined,
    fallbackPx: number,
    floorPx = 64,
    ceilPx = Number.POSITIVE_INFINITY
): number => {
    const raw = Number(layer?.scalePx || fallbackPx);
    return Math.min(ceilPx, Math.max(floorPx, raw));
};

const readLayerScroll = (layer?: VisualBiomeTextureLayer): LayerScroll => ({
    x: Number(layer?.scroll?.x ?? 0),
    y: Number(layer?.scroll?.y ?? 0),
    durationMs: Math.max(1000, Number(layer?.scroll?.durationMs ?? 18000))
});

const resolveTintColor = (tint: VisualBiomeTintProfile | undefined, theme: string): string | undefined => {
    if (!tint) return undefined;
    if (theme && tint.themes?.[theme]) return tint.themes[theme];
    return tint.default;
};

const readTintOpacity = (tint?: VisualBiomeTintProfile): number =>
    Math.min(1, Math.max(0, Number(tint?.opacity ?? 0)));

const readBlendMode = (blend?: VisualBlendMode): React.CSSProperties['mixBlendMode'] => {
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

const normalizeHexColor = (value: string, fallback = '#8b6f4a'): string => {
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

const hexToRgb01 = (hex: string): { r: number; g: number; b: number } => {
    const normalized = normalizeHexColor(hex);
    const value = normalized.slice(1);
    return {
        r: parseInt(value.slice(0, 2), 16) / 255,
        g: parseInt(value.slice(2, 4), 16) / 255,
        b: parseInt(value.slice(4, 6), 16) / 255
    };
};

const resolveMountainBlendMode = (
    value: 'off' | VisualBlendMode | undefined,
    fallback: React.CSSProperties['mixBlendMode'] | 'off'
): React.CSSProperties['mixBlendMode'] | 'off' => {
    if (value === 'off') return 'off';
    if (value) return readBlendMode(value);
    return fallback;
};

const getHexPoints = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

export const useBoardBiomeVisuals = ({
    cells,
    gameState,
    bounds,
    assetManifest,
    biomeDebug,
}: UseBoardBiomeVisualsArgs) => {
    const tileVisualFlags = useMemo(() => {
        const out = new Map<string, TileVisualFlags>();
        for (const hex of cells) {
            const key = pointToKey(hex);
            const traits = UnifiedTileService.getTraitsAt(gameState, hex);
            const isWall = traits.has('BLOCKS_MOVEMENT') && traits.has('BLOCKS_LOS');
            const hasLava = traits.has('LAVA') || (traits.has('HAZARDOUS') && traits.has('LIQUID'));
            const hasFire = traits.has('FIRE');
            out.set(key, {
                isWall,
                isLava: !isWall && hasLava,
                isFire: !isWall && hasFire
            });
        }
        return out;
    }, [cells, gameState.tiles]);

    const assetById = useMemo(() => {
        const map = new Map<string, VisualAssetEntry>();
        for (const asset of assetManifest?.assets || []) {
            map.set(asset.id, asset);
        }
        return map;
    }, [assetManifest]);

    const deathDecalHref = useMemo(() => assetById.get(resolveDeathDecalAssetId())?.path, [assetById]);
    const manifestTileUnitPx = useMemo(() => Math.max(1, assetManifest?.tileUnitPx || 256), [assetManifest?.tileUnitPx]);
    const manifestUnitToBoardScale = useMemo(() => (TILE_SIZE * 2) / manifestTileUnitPx, [manifestTileUnitPx]);

    const biomeThemeKey = useMemo(
        () => String(gameState.theme || '').toLowerCase(),
        [gameState.theme]
    );
    const biomeSeed = useMemo(
        () => `${gameState.initialSeed || gameState.rngSeed || gameState.turnNumber}:${gameState.floor}:${biomeThemeKey}`,
        [gameState.initialSeed, gameState.rngSeed, gameState.turnNumber, gameState.floor, biomeThemeKey]
    );
    const biomeThemePreset = useMemo<VisualBiomeThemePreset | undefined>(
        () => getBiomeThemePreset(assetManifest, biomeThemeKey),
        [assetManifest, biomeThemeKey]
    );

    const legacyUnderlayLayer = useMemo<VisualBiomeTextureLayer | undefined>(() => {
        const underlay = assetManifest?.biomeUnderlay;
        if (!underlay) return undefined;
        return {
            default: underlay.default,
            themes: underlay.themes,
            mode: underlay.mode,
            scalePx: underlay.scalePx,
            opacity: underlay.opacity
        };
    }, [assetManifest?.biomeUnderlay]);

    const undercurrentLayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => biomeThemePreset?.biomeLayers?.undercurrent || assetManifest?.biomeLayers?.undercurrent,
        [biomeThemePreset?.biomeLayers?.undercurrent, assetManifest?.biomeLayers?.undercurrent]
    );
    const crustLayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => biomeThemePreset?.biomeLayers?.crust || assetManifest?.biomeLayers?.crust || legacyUnderlayLayer,
        [biomeThemePreset?.biomeLayers?.crust, assetManifest?.biomeLayers?.crust, legacyUnderlayLayer]
    );
    const clutterLayer = useMemo<VisualBiomeClutterLayer | undefined>(
        () => biomeThemePreset?.biomeLayers?.clutter || assetManifest?.biomeLayers?.clutter,
        [biomeThemePreset?.biomeLayers?.clutter, assetManifest?.biomeLayers?.clutter]
    );

    const undercurrentHref = useMemo(
        () => resolveBiomeLayerPath(undercurrentLayer, biomeThemeKey),
        [undercurrentLayer, biomeThemeKey]
    );
    const undercurrentMode = useMemo(
        () => readLayerMode(undercurrentLayer),
        [undercurrentLayer]
    );
    const undercurrentScalePx = useMemo(
        () => readLayerScalePx(undercurrentLayer, manifestTileUnitPx, 64, 192),
        [undercurrentLayer, manifestTileUnitPx]
    );
    const undercurrentOpacity = useMemo(
        () => readLayerOpacity(undercurrentLayer),
        [undercurrentLayer]
    );
    const undercurrentScroll = useMemo(() => ({
        x: Number(undercurrentLayer?.scroll?.x ?? 120),
        y: Number(undercurrentLayer?.scroll?.y ?? 90),
        durationMs: Math.max(1000, Number(undercurrentLayer?.scroll?.durationMs ?? 92000))
    }), [undercurrentLayer?.scroll?.x, undercurrentLayer?.scroll?.y, undercurrentLayer?.scroll?.durationMs]);
    const undercurrentOffset = useMemo(() => ({
        x: Number(undercurrentLayer?.offsetX ?? 0) + Number(biomeDebug?.undercurrentOffset?.x ?? 0),
        y: Number(undercurrentLayer?.offsetY ?? 0) + Number(biomeDebug?.undercurrentOffset?.y ?? 0)
    }), [undercurrentLayer?.offsetX, undercurrentLayer?.offsetY, biomeDebug?.undercurrentOffset?.x, biomeDebug?.undercurrentOffset?.y]);

    const crustHref = useMemo(
        () => resolveBiomeLayerPath(crustLayer, biomeThemeKey),
        [crustLayer, biomeThemeKey]
    );
    const crustMode = useMemo(
        () => readLayerMode(crustLayer),
        [crustLayer]
    );
    const crustScalePx = useMemo(
        () => readLayerScalePx(crustLayer, manifestTileUnitPx, 64),
        [crustLayer, manifestTileUnitPx]
    );
    const crustOpacity = 1;

    const crustSeedShift = useMemo(() => {
        const shiftBudget = Math.max(0, Number(crustLayer?.seedShiftPx ?? TILE_SIZE * 5));
        if (shiftBudget === 0) return { x: 0, y: 0 };
        const h = hashString(`${biomeSeed}|crust-offset`);
        const hx = (((h & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        const hy = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        return { x: hx, y: hy };
    }, [crustLayer?.seedShiftPx, biomeSeed]);
    const crustOffset = useMemo(() => ({
        x: Number(crustLayer?.offsetX ?? 0) + Number(biomeDebug?.crustOffset?.x ?? 0),
        y: Number(crustLayer?.offsetY ?? 0) + Number(biomeDebug?.crustOffset?.y ?? 0)
    }), [crustLayer?.offsetX, crustLayer?.offsetY, biomeDebug?.crustOffset?.x, biomeDebug?.crustOffset?.y]);
    const crustPatternShift = useMemo(
        () => ({ x: crustSeedShift.x + crustOffset.x, y: crustSeedShift.y + crustOffset.y }),
        [crustSeedShift.x, crustSeedShift.y, crustOffset.x, crustOffset.y]
    );

    const wallsProfile = useMemo<VisualBiomeWallsProfile | undefined>(
        () => assetManifest?.walls,
        [assetManifest?.walls]
    );
    const wallsThemeOverride = useMemo<VisualBiomeWallsThemeOverride | undefined>(
        () => biomeThemePreset?.walls || wallsProfile?.themes?.[biomeThemeKey],
        [biomeThemePreset?.walls, wallsProfile?.themes, biomeThemeKey]
    );
    const crustMaterial = useMemo<VisualBiomeMaterialProfile | undefined>(
        () => biomeThemePreset?.biomeMaterials?.crust || assetManifest?.biomeMaterials?.crust,
        [biomeThemePreset?.biomeMaterials?.crust, assetManifest?.biomeMaterials?.crust]
    );
    const crustDetailALayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => crustMaterial?.detailA,
        [crustMaterial?.detailA]
    );
    const crustDetailBLayer = useMemo<VisualBiomeTextureLayer | undefined>(
        () => crustMaterial?.detailB,
        [crustMaterial?.detailB]
    );
    const crustDetailAHref = useMemo(
        () => resolveBiomeLayerPath(crustDetailALayer, biomeThemeKey),
        [crustDetailALayer, biomeThemeKey]
    );
    const crustDetailBHref = useMemo(
        () => resolveBiomeLayerPath(crustDetailBLayer, biomeThemeKey),
        [crustDetailBLayer, biomeThemeKey]
    );
    const crustDetailAMode = useMemo(
        () => readLayerMode(crustDetailALayer),
        [crustDetailALayer]
    );
    const crustDetailBMode = useMemo(
        () => readLayerMode(crustDetailBLayer),
        [crustDetailBLayer]
    );
    const crustDetailAScalePx = useMemo(
        () => readLayerScalePx(crustDetailALayer, crustScalePx, 64),
        [crustDetailALayer, crustScalePx]
    );
    const crustDetailBScalePx = useMemo(
        () => readLayerScalePx(crustDetailBLayer, crustScalePx, 64),
        [crustDetailBLayer, crustScalePx]
    );
    const crustDetailAOpacity = useMemo(
        () => readLayerOpacity(crustDetailALayer),
        [crustDetailALayer]
    );
    const crustDetailBOpacity = useMemo(
        () => readLayerOpacity(crustDetailBLayer),
        [crustDetailBLayer]
    );
    const crustDetailAScroll = useMemo(
        () => readLayerScroll(crustDetailALayer),
        [crustDetailALayer?.scroll?.x, crustDetailALayer?.scroll?.y, crustDetailALayer?.scroll?.durationMs]
    );
    const crustDetailBScroll = useMemo(
        () => readLayerScroll(crustDetailBLayer),
        [crustDetailBLayer?.scroll?.x, crustDetailBLayer?.scroll?.y, crustDetailBLayer?.scroll?.durationMs]
    );
    const crustDetailASeedShift = useMemo(() => {
        const shiftBudget = TILE_SIZE * 0.75;
        const h = hashString(`${biomeSeed}|crust-detail-a-offset`);
        const hx = (((h & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        const hy = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        return { x: hx, y: hy };
    }, [biomeSeed]);
    const crustDetailBSeedShift = useMemo(() => {
        const shiftBudget = TILE_SIZE * 0.75;
        const h = hashString(`${biomeSeed}|crust-detail-b-offset`);
        const hx = (((h & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        const hy = ((((h >>> 16) & 0xffff) / 0xffff) * 2 - 1) * shiftBudget;
        return { x: hx, y: hy };
    }, [biomeSeed]);
    const crustDetailAShift = useMemo(
        () => ({ x: crustPatternShift.x + crustDetailASeedShift.x, y: crustPatternShift.y + crustDetailASeedShift.y }),
        [crustPatternShift.x, crustPatternShift.y, crustDetailASeedShift.x, crustDetailASeedShift.y]
    );
    const crustDetailBShift = useMemo(
        () => ({ x: crustPatternShift.x + crustDetailBSeedShift.x, y: crustPatternShift.y + crustDetailBSeedShift.y }),
        [crustPatternShift.x, crustPatternShift.y, crustDetailBSeedShift.x, crustDetailBSeedShift.y]
    );
    const crustTintProfile = useMemo<VisualBiomeTintProfile | undefined>(
        () => crustMaterial?.tint,
        [crustMaterial?.tint]
    );
    const crustTintColor = useMemo(
        () => resolveTintColor(crustTintProfile, biomeThemeKey),
        [crustTintProfile, biomeThemeKey]
    );
    const crustTintOpacity = useMemo(
        () => readTintOpacity(crustTintProfile),
        [crustTintProfile?.opacity]
    );
    const crustTintBlendMode = useMemo(
        () => readBlendMode(crustTintProfile?.blendMode),
        [crustTintProfile?.blendMode]
    );
    const crustTintActive = Boolean(crustTintColor && crustTintOpacity > 0);
    const defaultMountainCrustBlendOpacity = useMemo(
        () => (crustTintActive ? Math.min(0.55, Math.max(0.15, crustTintOpacity * 0.9)) : 0),
        [crustTintActive, crustTintOpacity]
    );

    const resolveMountainSettings = useCallback((asset?: VisualAssetEntry): ResolvedMountainRenderSettings => {
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
    }, [
        biomeThemeKey,
        biomeDebug?.mountainScale,
        biomeDebug?.mountainOffset?.x,
        biomeDebug?.mountainOffset?.y,
        biomeDebug?.mountainAnchor?.x,
        biomeDebug?.mountainAnchor?.y,
        biomeDebug?.mountainCrustBlendMode,
        biomeDebug?.mountainCrustBlendOpacity,
        biomeDebug?.mountainTintColor,
        biomeDebug?.mountainTintBlendMode,
        biomeDebug?.mountainTintOpacity,
        biomeThemePreset?.assetOverrides,
        wallsProfile,
        wallsThemeOverride,
        crustTintBlendMode,
        crustTintColor,
        defaultMountainCrustBlendOpacity
    ]);

    const crustMaterialVisible = Boolean(
        (crustDetailAHref && crustDetailAMode !== 'off' && crustDetailAOpacity > 0)
        || (crustDetailBHref && crustDetailBMode !== 'off' && crustDetailBOpacity > 0)
        || crustTintActive
    );
    const hybridInteractionLayerEnabled = Boolean(
        (undercurrentHref && undercurrentMode !== 'off')
        || (crustHref && crustMode !== 'off')
        || crustMaterialVisible
    );

    const undercurrentPatternId = useMemo(
        () => `biome-undercurrent-${gameState.floor}`,
        [gameState.floor]
    );
    const crustPatternId = useMemo(
        () => `biome-crust-${gameState.floor}`,
        [gameState.floor]
    );
    const crustMaskId = useMemo(
        () => `biome-crust-mask-${gameState.floor}`,
        [gameState.floor]
    );
    const crustDetailAPatternId = useMemo(
        () => `biome-crust-detail-a-${gameState.floor}`,
        [gameState.floor]
    );
    const crustDetailBPatternId = useMemo(
        () => `biome-crust-detail-b-${gameState.floor}`,
        [gameState.floor]
    );
    const crustMaskEnabled = Boolean(
        (crustHref && crustMode !== 'off')
        || (crustDetailAHref && crustDetailAMode !== 'off' && crustDetailAOpacity > 0)
        || (crustDetailBHref && crustDetailBMode !== 'off' && crustDetailBOpacity > 0)
        || crustTintActive
    );
    const crustMaskHoles = useMemo(() => {
        const holes: MaskHole[] = [];
        for (const hex of cells) {
            const key = pointToKey(hex);
            const flags = tileVisualFlags.get(key);
            if (!flags || (!flags.isLava && !flags.isFire)) continue;
            const { x, y } = hexToPixel(hex, TILE_SIZE);
            holes.push({ key, x, y });
        }
        return holes;
    }, [cells, tileVisualFlags]);

    const stairsPropAsset = useMemo(() => {
        const id = resolvePropAssetId({ isStairs: true });
        return id ? assetById.get(id) : undefined;
    }, [assetById]);
    const shrinePropAsset = useMemo(() => {
        const id = resolvePropAssetId({ isShrine: true });
        return id ? assetById.get(id) : undefined;
    }, [assetById]);
    const boardProps = useMemo((): BoardProp[] => {
        const out: BoardProp[] = [];
        if (gameState.stairsPosition) {
            out.push({
                id: `stairs-${pointToKey(gameState.stairsPosition)}`,
                kind: 'stairs',
                position: gameState.stairsPosition,
                asset: stairsPropAsset
            });
        }
        if (gameState.shrinePosition) {
            out.push({
                id: `shrine-${pointToKey(gameState.shrinePosition)}`,
                kind: 'shrine',
                position: gameState.shrinePosition,
                asset: shrinePropAsset
            });
        }
        return out;
    }, [gameState.stairsPosition, gameState.shrinePosition, stairsPropAsset, shrinePropAsset]);

    const maskHexPoints = useMemo(() => getHexPoints(TILE_SIZE + 1), []);
    const biomeClipPoints = useMemo(() => getHexPoints(TILE_SIZE - 2), []);
    const biomeClipId = useMemo(() => `biome-map-clip-${gameState.floor}`, [gameState.floor]);
    const biomeFrame = useMemo<FrameRect>(() => ({
        x: bounds.minX - TILE_SIZE * 2,
        y: bounds.minY - TILE_SIZE * 2,
        width: bounds.width + TILE_SIZE * 4,
        height: bounds.height + TILE_SIZE * 4
    }), [bounds.minX, bounds.minY, bounds.width, bounds.height]);
    const biomeCoverBleedPx = useMemo(() => {
        const maxShift = Math.max(
            Math.abs(Number(undercurrentOffset?.x ?? 0)),
            Math.abs(Number(undercurrentOffset?.y ?? 0)),
            Math.abs(Number(crustPatternShift?.x ?? 0)),
            Math.abs(Number(crustPatternShift?.y ?? 0)),
            Math.abs(Number(crustDetailAShift?.x ?? 0)),
            Math.abs(Number(crustDetailAShift?.y ?? 0)),
            Math.abs(Number(crustDetailBShift?.x ?? 0)),
            Math.abs(Number(crustDetailBShift?.y ?? 0))
        );
        return Math.min(TILE_SIZE * 32, Math.max(TILE_SIZE * 8, Math.ceil(maxShift + TILE_SIZE * 6)));
    }, [
        undercurrentOffset?.x,
        undercurrentOffset?.y,
        crustPatternShift?.x,
        crustPatternShift?.y,
        crustDetailAShift?.x,
        crustDetailAShift?.y,
        crustDetailBShift?.x,
        crustDetailBShift?.y
    ]);
    const biomeCoverFrame = useMemo<FrameRect>(() => ({
        x: biomeFrame.x - biomeCoverBleedPx,
        y: biomeFrame.y - biomeCoverBleedPx,
        width: biomeFrame.width + biomeCoverBleedPx * 2,
        height: biomeFrame.height + biomeCoverBleedPx * 2
    }), [biomeFrame.x, biomeFrame.y, biomeFrame.width, biomeFrame.height, biomeCoverBleedPx]);

    return {
        tileVisualFlags,
        assetById,
        deathDecalHref,
        manifestUnitToBoardScale,
        biomeThemeKey,
        biomeSeed,
        clutterLayer,
        wallsProfile,
        wallsThemeOverride,
        boardProps,
        resolveMountainSettings,
        hybridInteractionLayerEnabled,
        backdropLayerProps: {
            biomeClipId,
            biomeClipPoints,
            maskHexPoints,
            biomeFrame,
            biomeCoverFrame,
            undercurrentHref,
            undercurrentMode,
            undercurrentPatternId,
            undercurrentScalePx,
            undercurrentOffset,
            undercurrentScroll,
            undercurrentOpacity,
            crustHref,
            crustMode,
            crustPatternId,
            crustScalePx,
            crustPatternShift,
            crustOpacity,
            crustDetailAHref,
            crustDetailAMode,
            crustDetailAPatternId,
            crustDetailAScalePx,
            crustDetailAShift,
            crustDetailAScroll,
            crustDetailAOpacity,
            crustDetailBHref,
            crustDetailBMode,
            crustDetailBPatternId,
            crustDetailBScalePx,
            crustDetailBShift,
            crustDetailBScroll,
            crustDetailBOpacity,
            crustMaskEnabled,
            crustMaskId,
            crustMaskHoles,
            crustTintActive,
            crustTintColor,
            crustTintOpacity,
            crustTintBlendMode,
        },
    };
};
