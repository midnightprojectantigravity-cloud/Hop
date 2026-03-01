import { useCallback, useMemo } from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, UnifiedTileService } from '@hop/engine';
import type {
    VisualAssetEntry,
    VisualBiomeClutterLayer,
    VisualBiomeMaterialProfile,
    VisualBiomeTextureLayer,
    VisualBiomeThemePreset,
    VisualBiomeTintProfile,
    VisualBiomeWallsProfile,
    VisualBiomeWallsThemeOverride,
} from '../../visual/asset-manifest';
import { getBiomeThemePreset } from '../../visual/asset-manifest';
import { resolveDeathDecalAssetId, resolvePropAssetId } from '../../visual/asset-selectors';
import type {
    BoardProp,
    FrameRect,
    MaskHole,
    ResolvedMountainRenderSettings,
    TileVisualFlags,
    UseBoardBiomeVisualsArgs,
} from './biome-visuals-types';
import {
    getHexPoints,
    hashString,
    readBlendMode,
    readLayerMode,
    readLayerOpacity,
    readLayerScalePx,
    readLayerScroll,
    readTintOpacity,
    resolveBiomeLayerPath,
    resolveTintColor,
} from './biome-visuals-utils';
import { buildMountainRenderSettings } from './biome-mountain-settings';

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
        return buildMountainRenderSettings({
            asset,
            biomeThemeKey,
            biomeDebug,
            biomeThemePreset,
            wallsProfile,
            wallsThemeOverride,
            crustTintBlendMode,
            crustTintColor,
            defaultMountainCrustBlendOpacity,
        });
    }, [
        biomeThemeKey,
        biomeDebug,
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
