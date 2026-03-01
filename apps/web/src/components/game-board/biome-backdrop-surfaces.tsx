import React from 'react';
import type { BiomeBackdropLayerProps } from './biome-backdrop-types';

type BiomeBackdropSurfacesProps = Pick<
    BiomeBackdropLayerProps,
    | 'biomeClipId'
    | 'biomeFrame'
    | 'biomeCoverFrame'
    | 'undercurrentHref'
    | 'undercurrentMode'
    | 'undercurrentPatternId'
    | 'undercurrentOffset'
    | 'undercurrentOpacity'
    | 'crustHref'
    | 'crustMode'
    | 'crustPatternId'
    | 'crustPatternShift'
    | 'crustOpacity'
    | 'crustDetailAHref'
    | 'crustDetailAMode'
    | 'crustDetailAPatternId'
    | 'crustDetailAShift'
    | 'crustDetailAOpacity'
    | 'crustDetailBHref'
    | 'crustDetailBMode'
    | 'crustDetailBPatternId'
    | 'crustDetailBShift'
    | 'crustDetailBOpacity'
    | 'crustMaskId'
    | 'crustTintActive'
    | 'crustTintColor'
    | 'crustTintOpacity'
    | 'crustTintBlendMode'
>;

export const BiomeBackdropSurfaces: React.FC<BiomeBackdropSurfacesProps> = ({
    biomeClipId,
    biomeFrame,
    biomeCoverFrame,
    undercurrentHref,
    undercurrentMode,
    undercurrentPatternId,
    undercurrentOffset,
    undercurrentOpacity,
    crustHref,
    crustMode,
    crustPatternId,
    crustPatternShift,
    crustOpacity,
    crustDetailAHref,
    crustDetailAMode,
    crustDetailAPatternId,
    crustDetailAShift,
    crustDetailAOpacity,
    crustDetailBHref,
    crustDetailBMode,
    crustDetailBPatternId,
    crustDetailBShift,
    crustDetailBOpacity,
    crustMaskId,
    crustTintActive,
    crustTintColor,
    crustTintOpacity,
    crustTintBlendMode,
}) => (
    <>
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

