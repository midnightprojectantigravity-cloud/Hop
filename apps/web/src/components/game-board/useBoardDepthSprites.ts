import { useMemo } from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, type Point } from '@hop/engine';
import type {
    VisualAssetEntry,
    VisualAssetManifest,
    VisualBiomeClutterLayer,
} from '../../visual/asset-manifest';

type TileFlags = { isWall: boolean; isLava: boolean; isFire: boolean };

type BoardDepthSprite = {
    id: string;
    kind: 'clutter' | 'mountain' | 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
    renderScale: number;
    zAnchorY: number;
    fallback?: 'stairs' | 'shrine';
};

type BoardProp = {
    id: string;
    kind: 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
};

const hashString = (input: string): number => {
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

const hashFloat = (input: string): number => hashString(input) / 0xffffffff;

const parseMountainClusterSize = (asset: VisualAssetEntry): number => {
    const tags = (asset.tags || []).map(t => t.toLowerCase());
    const tokens = [asset.id.toLowerCase(), ...tags];
    for (const token of tokens) {
        const match = token.match(/(?:cluster|hex)[-_]?([123])\b/);
        if (match) return Number(match[1]);
        if (token.includes('1-hex') || token.includes('single')) return 1;
        if (token.includes('2-hex') || token.includes('double')) return 2;
        if (token.includes('3-hex') || token.includes('triple')) return 3;
    }
    return 1;
};

interface UseBoardDepthSpritesArgs<TMountainSettings extends { scale: number; offsetY: number }> {
    assetManifest?: VisualAssetManifest | null;
    biomeThemeKey: string;
    biomeSeed: string;
    mountainAssetPathOverride?: string;
    wallsMountainPath?: string;
    wallsThemeMountainPath?: string;
    clutterLayer?: VisualBiomeClutterLayer;
    cells: Point[];
    tileVisualFlags: Map<string, TileFlags>;
    boardProps: BoardProp[];
    resolveMountainSettings: (asset?: VisualAssetEntry) => TMountainSettings;
}

export const useBoardDepthSprites = <TMountainSettings extends { scale: number; offsetY: number }>({
    assetManifest,
    biomeThemeKey,
    biomeSeed,
    mountainAssetPathOverride,
    wallsMountainPath,
    wallsThemeMountainPath,
    clutterLayer,
    cells,
    tileVisualFlags,
    boardProps,
    resolveMountainSettings,
}: UseBoardDepthSpritesArgs<TMountainSettings>) => {
    const mountainAssets = useMemo(() => {
        const all = (assetManifest?.assets || []).filter(asset => {
            if (asset.type !== 'prop') return false;
            const id = asset.id.toLowerCase();
            const tags = new Set((asset.tags || []).map(t => t.toLowerCase()));
            const isMountain = id.includes('mountain') || tags.has('mountain');
            if (!isMountain) return false;
            if (!asset.theme) return true;
            const theme = asset.theme.toLowerCase();
            return theme === biomeThemeKey || theme === 'core';
        });
        const sorted = all.sort((a, b) => a.id.localeCompare(b.id));
        const presetPath = String(wallsThemeMountainPath || wallsMountainPath || '').trim();
        const overridePath = String(mountainAssetPathOverride || presetPath).trim();
        if (!overridePath) return sorted;

        const exactMatch = sorted.find(asset => asset.path === overridePath);
        return exactMatch ? [exactMatch] : [];
    }, [assetManifest?.assets, biomeThemeKey, mountainAssetPathOverride, wallsMountainPath, wallsThemeMountainPath]);

    const mountainSettingsByAssetId = useMemo(() => {
        const out = new Map<string, TMountainSettings>();
        for (const asset of mountainAssets) {
            out.set(asset.id, resolveMountainSettings(asset));
        }
        return out;
    }, [mountainAssets, resolveMountainSettings]);

    const mountainSprites = useMemo((): BoardDepthSprite[] => {
        if (!mountainAssets.length) return [];
        const singleHexPool = mountainAssets.filter(asset => parseMountainClusterSize(asset) === 1);
        const assetPool = singleHexPool.length ? singleHexPool : mountainAssets;
        const wallHexes = cells
            .filter(hex => tileVisualFlags.get(pointToKey(hex))?.isWall)
            .sort((a, b) => pointToKey(a).localeCompare(pointToKey(b)));
        if (!wallHexes.length) return [];

        return wallHexes.map((hex) => {
            const key = pointToKey(hex);
            const pick = Math.floor(
                hashFloat(`${biomeSeed}|mountain-tile|${key}|asset`) * assetPool.length
            ) % assetPool.length;
            const asset = assetPool[pick];
            const settings = mountainSettingsByAssetId.get(asset.id) || resolveMountainSettings(asset);
            const { y } = hexToPixel(hex, TILE_SIZE);
            return {
                id: `mountain-${key}-${asset.id}`,
                kind: 'mountain',
                position: hex,
                asset,
                renderScale: settings.scale,
                zAnchorY: y + TILE_SIZE * 0.42 + settings.offsetY
            };
        });
    }, [mountainAssets, cells, tileVisualFlags, biomeSeed, mountainSettingsByAssetId, resolveMountainSettings]);

    const clutterAssets = useMemo(() => {
        const tags = new Set((clutterLayer?.tags?.length ? clutterLayer.tags : ['clutter', 'obstacle']).map(t => t.toLowerCase()));
        return (assetManifest?.assets || []).filter(asset => {
            if (asset.type !== 'prop' && asset.type !== 'decal') return false;
            const id = asset.id.toLowerCase();
            if (id.includes('mountain')) return false;
            const assetTags = (asset.tags || []).map(t => t.toLowerCase());
            if (assetTags.includes('mountain')) return false;
            if (!assetTags.some(tag => tags.has(tag))) return false;
            if (!asset.theme) return true;
            return asset.theme.toLowerCase() === biomeThemeKey || asset.theme.toLowerCase() === 'core';
        });
    }, [assetManifest?.assets, clutterLayer?.tags, biomeThemeKey]);

    const clutterSprites = useMemo((): BoardDepthSprite[] => {
        if (!clutterAssets.length) return [];
        const density = Math.min(0.6, Math.max(0, Number(clutterLayer?.density ?? 0.08)));
        const maxPerHex = Math.max(1, Math.floor(Number(clutterLayer?.maxPerHex ?? 1)));
        const bleedScaleMax = Math.min(2, Math.max(1, Number(clutterLayer?.bleedScaleMax ?? 2)));
        const out: BoardDepthSprite[] = [];

        for (const hex of cells) {
            const key = pointToKey(hex);
            const flags = tileVisualFlags.get(key);
            if (flags?.isWall || flags?.isLava || flags?.isFire) continue;
            const { y } = hexToPixel(hex, TILE_SIZE);

            for (let slot = 0; slot < maxPerHex; slot++) {
                const roll = hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|roll`);
                if (roll > density / (slot + 1)) continue;
                const pick = Math.floor(hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|pick`) * clutterAssets.length) % clutterAssets.length;
                const asset = clutterAssets[pick];
                const scale = 1 + hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|scale`) * (bleedScaleMax - 1);
                const depthOffset = (hashFloat(`${biomeSeed}|clutter|${key}|slot:${slot}|depth`) - 0.5) * TILE_SIZE * 0.28;
                out.push({
                    id: `clutter-${key}-${slot}-${asset.id}`,
                    kind: 'clutter',
                    position: hex,
                    asset,
                    renderScale: scale,
                    zAnchorY: y + depthOffset
                });
            }
        }

        return out;
    }, [cells, tileVisualFlags, clutterAssets, clutterLayer?.density, clutterLayer?.maxPerHex, clutterLayer?.bleedScaleMax, biomeSeed]);

    const depthSortedSprites = useMemo((): BoardDepthSprite[] => {
        const out: BoardDepthSprite[] = [...mountainSprites, ...clutterSprites];
        for (const prop of boardProps) {
            const { y } = hexToPixel(prop.position, TILE_SIZE);
            const isShrine = prop.kind === 'shrine';
            out.push({
                id: prop.id,
                kind: prop.kind,
                position: prop.position,
                asset: prop.asset,
                renderScale: Math.min(2, isShrine ? 1.5 : 1.42),
                zAnchorY: y + (isShrine ? TILE_SIZE * 0.32 : TILE_SIZE * 0.28),
                fallback: prop.kind
            });
        }
        out.sort((a, b) => {
            if (a.zAnchorY === b.zAnchorY) return a.id.localeCompare(b.id);
            return a.zAnchorY - b.zAnchorY;
        });
        return out;
    }, [mountainSprites, clutterSprites, boardProps]);

    const mountainCoveredWallKeys = useMemo(() => {
        const out = new Set<string>();
        for (const sprite of mountainSprites) {
            out.add(pointToKey(sprite.position));
        }
        return out;
    }, [mountainSprites]);

    return {
        mountainSettingsByAssetId,
        depthSortedSprites,
        mountainCoveredWallKeys,
    };
};
