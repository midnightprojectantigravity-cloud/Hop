import React from 'react';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { BiomeBackdropLayerProps } from './biome-backdrop-types';
import { buildTranslatedPolygonPath, parseSvgPointList } from './board-svg-paths';

type BiomeBackdropDefsProps = Pick<
    BiomeBackdropLayerProps,
    | 'cells'
    | 'biomeClipId'
    | 'biomeClipPoints'
    | 'maskHexPoints'
    | 'biomeCoverFrame'
    | 'undercurrentHref'
    | 'undercurrentMode'
    | 'undercurrentPatternId'
    | 'undercurrentScalePx'
    | 'undercurrentOffset'
    | 'undercurrentScroll'
    | 'crustHref'
    | 'crustMode'
    | 'crustPatternId'
    | 'crustScalePx'
    | 'crustPatternShift'
    | 'crustDetailAHref'
    | 'crustDetailAMode'
    | 'crustDetailAPatternId'
    | 'crustDetailAScalePx'
    | 'crustDetailAShift'
    | 'crustDetailAScroll'
    | 'crustDetailBHref'
    | 'crustDetailBMode'
    | 'crustDetailBPatternId'
    | 'crustDetailBScalePx'
    | 'crustDetailBShift'
    | 'crustDetailBScroll'
    | 'crustMaskEnabled'
    | 'crustMaskId'
    | 'crustMaskHoles'
>;

export const BiomeBackdropDefs: React.FC<BiomeBackdropDefsProps> = ({
    cells,
    biomeClipId,
    biomeClipPoints,
    maskHexPoints,
    biomeCoverFrame,
    undercurrentHref,
    undercurrentMode,
    undercurrentPatternId,
    undercurrentScalePx,
    undercurrentOffset,
    undercurrentScroll,
    crustHref,
    crustMode,
    crustPatternId,
    crustScalePx,
    crustPatternShift,
    crustDetailAHref,
    crustDetailAMode,
    crustDetailAPatternId,
    crustDetailAScalePx,
    crustDetailAShift,
    crustDetailAScroll,
    crustDetailBHref,
    crustDetailBMode,
    crustDetailBPatternId,
    crustDetailBScalePx,
    crustDetailBShift,
    crustDetailBScroll,
    crustMaskEnabled,
    crustMaskId,
    crustMaskHoles,
}) => {
    const clipPolygonPoints = React.useMemo(() => parseSvgPointList(biomeClipPoints), [biomeClipPoints]);
    const maskPolygonPoints = React.useMemo(() => parseSvgPointList(maskHexPoints), [maskHexPoints]);
    const clipPathData = React.useMemo(() => (
        buildTranslatedPolygonPath(
            cells.map((hex) => hexToPixel(hex, TILE_SIZE)),
            clipPolygonPoints,
        )
    ), [cells, clipPolygonPoints]);
    const maskHolePathData = React.useMemo(() => (
        buildTranslatedPolygonPath(
            crustMaskHoles.map((hole) => ({ x: hole.x, y: hole.y })),
            maskPolygonPoints,
        )
    ), [crustMaskHoles, maskPolygonPoints]);

    return (
    <defs>
        <clipPath id={biomeClipId} clipPathUnits="userSpaceOnUse">
            {clipPathData && <path d={clipPathData} />}
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
                    {maskHolePathData && (
                        <path
                            d={maskHolePathData}
                            fill="black"
                            opacity={1}
                        />
                    )}
            </mask>
        )}
    </defs>
    );
};
