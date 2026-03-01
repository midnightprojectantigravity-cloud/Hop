import type { Point } from '@hop/engine';
import type { VisualAssetEntry } from '../../visual/asset-manifest';

export type BoardDepthSpriteLike = {
    id: string;
    kind: 'clutter' | 'mountain' | 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
    renderScale: number;
    fallback?: 'stairs' | 'shrine';
};

export type ResolvedMountainRenderSettingsLike = {
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

