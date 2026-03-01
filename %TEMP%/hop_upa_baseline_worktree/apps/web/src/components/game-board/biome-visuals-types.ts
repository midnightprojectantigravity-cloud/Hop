import type { GameState, Point } from '@hop/engine';
import type { VisualAssetEntry, VisualAssetManifest, VisualBlendMode } from '../../visual/asset-manifest';

export type TileVisualFlags = { isWall: boolean; isLava: boolean; isFire: boolean };
export type Vec2 = { x: number; y: number };
export type LayerScroll = Vec2 & { durationMs: number };
export type FrameRect = { x: number; y: number; width: number; height: number };
export type MaskHole = { key: string; x: number; y: number };
export type LayerMode = 'off' | 'cover' | 'repeat';

export type BoardProp = {
    id: string;
    kind: 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
};

export type ResolvedMountainRenderSettings = {
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

export interface BoardBounds {
    minX: number;
    minY: number;
    width: number;
    height: number;
}

export interface BoardBiomeDebug {
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

export interface UseBoardBiomeVisualsArgs {
    cells: Point[];
    gameState: GameState;
    bounds: BoardBounds;
    assetManifest?: VisualAssetManifest | null;
    biomeDebug?: BoardBiomeDebug;
}

