import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE, pointToKey } from '@hop/engine';

type LayerMode = 'off' | 'cover' | 'repeat';
type Vec2 = { x: number; y: number };
type LayerScroll = Vec2 & { durationMs: number };
type FrameRect = { x: number; y: number; width: number; height: number };
type MaskHole = { key: string; x: number; y: number };

interface BiomeBackdropLayerProps {
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

export const BiomeBackdropLayer: React.FC<BiomeBackdropLayerProps> = ({
    cells,
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
}) => {
    return (
        <>
            <defs>
                <clipPath id={biomeClipId} clipPathUnits="userSpaceOnUse">
                    {cells.map((hex) => {
                        const { x, y } = hexToPixel(hex, TILE_SIZE);
                        return (
                            <polygon
                                key={`biome-clip-${pointToKey(hex)}`}
                                points={biomeClipPoints}
                                transform={`translate(${x},${y})`}
                            />
                        );
                    })}
                </clipPath>
                {undercurrentHref && undercurrentMode === 'repeat' && (
                    <pattern
                        id={undercurrentPatternId}
                        patternUnits="userSpaceOnUse"
                        width={undercurrentScalePx}
                        height={undercurrentScalePx}
                        patternTransform={`translate(${undercurrentOffset.x} ${undercurrentOffset.y})`}
                    >
                        <image
                            href={undercurrentHref}
                            x="0"
                            y="0"
                            width={undercurrentScalePx}
                            height={undercurrentScalePx}
                            preserveAspectRatio="xMidYMid slice"
                        />
                        {(undercurrentScroll.x !== 0 || undercurrentScroll.y !== 0) && (
                            <animateTransform
                                attributeName="patternTransform"
                                type="translate"
                                from={`${undercurrentOffset.x} ${undercurrentOffset.y}`}
                                to={`${undercurrentOffset.x + undercurrentScroll.x} ${undercurrentOffset.y + undercurrentScroll.y}`}
                                dur={`${undercurrentScroll.durationMs}ms`}
                                repeatCount="indefinite"
                            />
                        )}
                    </pattern>
                )}
                {crustHref && crustMode === 'repeat' && (
                    <pattern
                        id={crustPatternId}
                        patternUnits="userSpaceOnUse"
                        width={crustScalePx}
                        height={crustScalePx}
                        patternTransform={`translate(${crustPatternShift.x} ${crustPatternShift.y})`}
                    >
                        <image
                            href={crustHref}
                            x="0"
                            y="0"
                            width={crustScalePx}
                            height={crustScalePx}
                            preserveAspectRatio="xMidYMid slice"
                        />
                    </pattern>
                )}
                {crustDetailAHref && crustDetailAMode === 'repeat' && (
                    <pattern
                        id={crustDetailAPatternId}
                        patternUnits="userSpaceOnUse"
                        width={crustDetailAScalePx}
                        height={crustDetailAScalePx}
                        patternTransform={`translate(${crustDetailAShift.x} ${crustDetailAShift.y})`}
                    >
                        <image
                            href={crustDetailAHref}
                            x="0"
                            y="0"
                            width={crustDetailAScalePx}
                            height={crustDetailAScalePx}
                            preserveAspectRatio="xMidYMid slice"
                        />
                        {(crustDetailAScroll.x !== 0 || crustDetailAScroll.y !== 0) && (
                            <animateTransform
                                attributeName="patternTransform"
                                type="translate"
                                from={`${crustDetailAShift.x} ${crustDetailAShift.y}`}
                                to={`${crustDetailAShift.x + crustDetailAScroll.x} ${crustDetailAShift.y + crustDetailAScroll.y}`}
                                dur={`${crustDetailAScroll.durationMs}ms`}
                                repeatCount="indefinite"
                            />
                        )}
                    </pattern>
                )}
                {crustDetailBHref && crustDetailBMode === 'repeat' && (
                    <pattern
                        id={crustDetailBPatternId}
                        patternUnits="userSpaceOnUse"
                        width={crustDetailBScalePx}
                        height={crustDetailBScalePx}
                        patternTransform={`translate(${crustDetailBShift.x} ${crustDetailBShift.y})`}
                    >
                        <image
                            href={crustDetailBHref}
                            x="0"
                            y="0"
                            width={crustDetailBScalePx}
                            height={crustDetailBScalePx}
                            preserveAspectRatio="xMidYMid slice"
                        />
                        {(crustDetailBScroll.x !== 0 || crustDetailBScroll.y !== 0) && (
                            <animateTransform
                                attributeName="patternTransform"
                                type="translate"
                                from={`${crustDetailBShift.x} ${crustDetailBShift.y}`}
                                to={`${crustDetailBShift.x + crustDetailBScroll.x} ${crustDetailBShift.y + crustDetailBScroll.y}`}
                                dur={`${crustDetailBScroll.durationMs}ms`}
                                repeatCount="indefinite"
                            />
                        )}
                    </pattern>
                )}
                {crustMaskEnabled && (
                    <mask
                        id={crustMaskId}
                        maskUnits="userSpaceOnUse"
                        maskContentUnits="userSpaceOnUse"
                        x={biomeCoverFrame.x}
                        y={biomeCoverFrame.y}
                        width={biomeCoverFrame.width}
                        height={biomeCoverFrame.height}
                    >
                        <rect
                            x={biomeCoverFrame.x}
                            y={biomeCoverFrame.y}
                            width={biomeCoverFrame.width}
                            height={biomeCoverFrame.height}
                            fill="white"
                        />
                        {crustMaskHoles.map((hole) => (
                            <polygon
                                key={`hole-${hole.key}`}
                                points={maskHexPoints}
                                transform={`translate(${hole.x},${hole.y})`}
                                fill="black"
                                opacity={1}
                            />
                        ))}
                    </mask>
                )}
            </defs>
            <g data-layer="biome-undercurrent" pointerEvents="none" clipPath={`url(#${biomeClipId})`}>
                {undercurrentHref && undercurrentMode === 'repeat' && (
                    <rect
                        x={biomeFrame.x}
                        y={biomeFrame.y}
                        width={biomeFrame.width}
                        height={biomeFrame.height}
                        fill={`url(#${undercurrentPatternId})`}
                        opacity={undercurrentOpacity}
                    />
                )}
                {undercurrentHref && undercurrentMode === 'cover' && (
                    <image
                        href={undercurrentHref}
                        x={biomeCoverFrame.x + undercurrentOffset.x}
                        y={biomeCoverFrame.y + undercurrentOffset.y}
                        width={biomeCoverFrame.width}
                        height={biomeCoverFrame.height}
                        preserveAspectRatio="xMidYMid slice"
                        opacity={undercurrentOpacity}
                    />
                )}
            </g>
            <g data-layer="biome-crust" pointerEvents="none" clipPath={`url(#${biomeClipId})`}>
                {crustHref && crustMode === 'repeat' && (
                    <rect
                        x={biomeFrame.x}
                        y={biomeFrame.y}
                        width={biomeFrame.width}
                        height={biomeFrame.height}
                        fill={`url(#${crustPatternId})`}
                        opacity={crustOpacity}
                        mask={`url(#${crustMaskId})`}
                    />
                )}
                {crustHref && crustMode === 'cover' && (
                    <image
                        href={crustHref}
                        x={biomeCoverFrame.x + crustPatternShift.x}
                        y={biomeCoverFrame.y + crustPatternShift.y}
                        width={biomeCoverFrame.width}
                        height={biomeCoverFrame.height}
                        preserveAspectRatio="xMidYMid slice"
                        opacity={crustOpacity}
                        mask={`url(#${crustMaskId})`}
                    />
                )}
                {crustDetailAHref && crustDetailAMode === 'repeat' && crustDetailAOpacity > 0 && (
                    <rect
                        x={biomeFrame.x}
                        y={biomeFrame.y}
                        width={biomeFrame.width}
                        height={biomeFrame.height}
                        fill={`url(#${crustDetailAPatternId})`}
                        opacity={crustDetailAOpacity}
                        mask={`url(#${crustMaskId})`}
                    />
                )}
                {crustDetailAHref && crustDetailAMode === 'cover' && crustDetailAOpacity > 0 && (
                    <image
                        href={crustDetailAHref}
                        x={biomeCoverFrame.x + crustDetailAShift.x}
                        y={biomeCoverFrame.y + crustDetailAShift.y}
                        width={biomeCoverFrame.width}
                        height={biomeCoverFrame.height}
                        preserveAspectRatio="xMidYMid slice"
                        opacity={crustDetailAOpacity}
                        mask={`url(#${crustMaskId})`}
                    />
                )}
                {crustDetailBHref && crustDetailBMode === 'repeat' && crustDetailBOpacity > 0 && (
                    <rect
                        x={biomeFrame.x}
                        y={biomeFrame.y}
                        width={biomeFrame.width}
                        height={biomeFrame.height}
                        fill={`url(#${crustDetailBPatternId})`}
                        opacity={crustDetailBOpacity}
                        mask={`url(#${crustMaskId})`}
                    />
                )}
                {crustDetailBHref && crustDetailBMode === 'cover' && crustDetailBOpacity > 0 && (
                    <image
                        href={crustDetailBHref}
                        x={biomeCoverFrame.x + crustDetailBShift.x}
                        y={biomeCoverFrame.y + crustDetailBShift.y}
                        width={biomeCoverFrame.width}
                        height={biomeCoverFrame.height}
                        preserveAspectRatio="xMidYMid slice"
                        opacity={crustDetailBOpacity}
                        mask={`url(#${crustMaskId})`}
                    />
                )}
                {crustTintActive && crustTintColor && (
                    <rect
                        x={biomeFrame.x}
                        y={biomeFrame.y}
                        width={biomeFrame.width}
                        height={biomeFrame.height}
                        fill={crustTintColor}
                        opacity={crustTintOpacity}
                        mask={`url(#${crustMaskId})`}
                        style={crustTintBlendMode !== 'normal' ? { mixBlendMode: crustTintBlendMode } : undefined}
                    />
                )}
            </g>
        </>
    );
};
