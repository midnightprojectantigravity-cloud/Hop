import type { Point } from '@hop/engine';

export type LayerMode = 'off' | 'cover' | 'repeat';
export type Vec2 = { x: number; y: number };
export type LayerScroll = Vec2 & { durationMs: number };
export type FrameRect = { x: number; y: number; width: number; height: number };
export type MaskHole = { key: string; x: number; y: number };

export interface BiomeBackdropLayerProps {
    cells: Point[];
    biomeClipId: string;
    biomeClipPoints: string;
    maskHexPoints: string;
    biomeFrame: FrameRect;
    biomeCoverFrame: FrameRect;

    undercurrentHref?: string;
    undercurrentMode: LayerMode;
    undercurrentPatternId: string;
    undercurrentScalePx: number;
    undercurrentOffset: Vec2;
    undercurrentScroll: LayerScroll;
    undercurrentOpacity: number;

    crustHref?: string;
    crustMode: LayerMode;
    crustPatternId: string;
    crustScalePx: number;
    crustPatternShift: Vec2;
    crustOpacity: number;

    crustDetailAHref?: string;
    crustDetailAMode: LayerMode;
    crustDetailAPatternId: string;
    crustDetailAScalePx: number;
    crustDetailAShift: Vec2;
    crustDetailAScroll: LayerScroll;
    crustDetailAOpacity: number;

    crustDetailBHref?: string;
    crustDetailBMode: LayerMode;
    crustDetailBPatternId: string;
    crustDetailBScalePx: number;
    crustDetailBShift: Vec2;
    crustDetailBScroll: LayerScroll;
    crustDetailBOpacity: number;

    crustMaskEnabled: boolean;
    crustMaskId: string;
    crustMaskHoles: MaskHole[];

    crustTintActive: boolean;
    crustTintColor?: string;
    crustTintOpacity: number;
    crustTintBlendMode?: React.CSSProperties['mixBlendMode'];
}

