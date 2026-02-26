import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { VisualAssetEntry } from '../../visual/asset-manifest';

type BoardDepthSpriteLike = {
    id: string;
    kind: 'clutter' | 'mountain' | 'stairs' | 'shrine';
    position: Point;
    asset?: VisualAssetEntry;
    renderScale: number;
    fallback?: 'stairs' | 'shrine';
};

type ResolvedMountainRenderSettingsLike = {
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

interface ClutterObstaclesLayerProps {
    sprites: BoardDepthSpriteLike[];
    floor: number;
    manifestUnitToBoardScale: number;
    mountainSettingsByAssetId: Map<string, ResolvedMountainRenderSettingsLike>;
    resolveMountainSettings: (asset?: VisualAssetEntry) => ResolvedMountainRenderSettingsLike;
}

const toSvgSafeId = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, '-');

export const ClutterObstaclesLayer: React.FC<ClutterObstaclesLayerProps> = ({
    sprites,
    floor,
    manifestUnitToBoardScale,
    mountainSettingsByAssetId,
    resolveMountainSettings,
}) => {
    return (
        <g data-layer="clutter-obstacles" pointerEvents="none">
            {sprites.map((sprite) => {
                const { x, y } = hexToPixel(sprite.position, TILE_SIZE);
                if (sprite.asset?.path) {
                    const baseAnchorX = Math.min(1, Math.max(0, sprite.asset.anchor?.x ?? 0.5));
                    const baseAnchorY = Math.min(1, Math.max(0, sprite.asset.anchor?.y ?? 0.5));
                    const isMountain = sprite.kind === 'mountain';
                    const mountainSettings = isMountain
                        ? (mountainSettingsByAssetId.get(sprite.asset.id) || resolveMountainSettings(sprite.asset))
                        : null;
                    const anchorX = mountainSettings ? mountainSettings.anchorX : baseAnchorX;
                    const anchorY = mountainSettings ? mountainSettings.anchorY : baseAnchorY;
                    const renderX = x + (mountainSettings ? mountainSettings.offsetX : 0);
                    const renderY = y + (mountainSettings ? mountainSettings.offsetY : 0);
                    const renderWidth = Math.max(8, sprite.asset.width * manifestUnitToBoardScale * sprite.renderScale);
                    const renderHeight = Math.max(8, sprite.asset.height * manifestUnitToBoardScale * sprite.renderScale);
                    const isShrineProp = sprite.kind === 'shrine';
                    const isStairsProp = sprite.kind === 'stairs';
                    const isObjectiveProp = isShrineProp || isStairsProp;
                    const haloColor = isShrineProp ? 'rgba(251,146,60,0.25)' : 'rgba(74,222,128,0.22)';
                    const haloStroke = isShrineProp ? '#fdba74' : '#86efac';
                    const haloCx = x;
                    const haloCy = y - renderHeight * anchorY + renderHeight * 0.84;
                    const haloRx = Math.max(14, renderWidth * 0.32);
                    const haloRy = Math.max(8, renderHeight * 0.14);
                    return (
                        <g key={sprite.id}>
                            {isObjectiveProp && (
                                <>
                                    <ellipse
                                        cx={haloCx}
                                        cy={haloCy}
                                        rx={haloRx}
                                        ry={haloRy}
                                        fill={haloColor}
                                        opacity={0.95}
                                    />
                                    <ellipse
                                        cx={haloCx}
                                        cy={haloCy}
                                        rx={haloRx * 1.14}
                                        ry={haloRy * 1.14}
                                        fill="none"
                                        stroke={haloStroke}
                                        strokeWidth={2}
                                        opacity={0.72}
                                        style={{ animation: `shrineGlow ${isShrineProp ? 1.8 : 2.4}s ease-in-out infinite` }}
                                    />
                                </>
                            )}
                            {(() => {
                                const baseFilter = isObjectiveProp
                                    ? (isShrineProp
                                        ? 'drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 4px rgba(251,146,60,0.45)) saturate(1.08) contrast(1.06)'
                                        : 'drop-shadow(0 4px 6px rgba(0,0,0,0.55)) drop-shadow(0 0 4px rgba(74,222,128,0.42)) saturate(1.08) contrast(1.06)')
                                    : (isMountain
                                        ? 'drop-shadow(0 7px 10px rgba(0,0,0,0.56)) saturate(1.04) contrast(1.08)'
                                        : 'drop-shadow(0 5px 8px rgba(0,0,0,0.48)) saturate(0.98) contrast(1.04)');
                                const baseOpacity = isObjectiveProp ? 0.99 : (isMountain ? 0.96 : 0.9);
                                const mountainBlendPassEnabled = Boolean(
                                    mountainSettings
                                    && mountainSettings.crustBlendMode !== 'off'
                                    && mountainSettings.crustBlendOpacity > 0
                                );
                                const mountainTintPassEnabled = Boolean(
                                    mountainSettings
                                    && mountainSettings.tintBlendMode !== 'off'
                                    && mountainSettings.tintOpacity > 0
                                );
                                const mountainBlendMode = (
                                    mountainSettings?.crustBlendMode !== 'off'
                                        ? mountainSettings?.crustBlendMode
                                        : undefined
                                ) as React.CSSProperties['mixBlendMode'] | undefined;
                                const mountainTintMode = (
                                    mountainSettings?.tintBlendMode !== 'off'
                                        ? mountainSettings?.tintBlendMode
                                        : undefined
                                ) as React.CSSProperties['mixBlendMode'] | undefined;
                                const imageX = renderX - renderWidth * anchorX;
                                const imageY = renderY - renderHeight * anchorY;
                                const spriteSafeId = toSvgSafeId(sprite.id);
                                const mountainGroundGradientId = `mountain-ground-gradient-${floor}-${spriteSafeId}`;
                                const mountainGroundMaskId = `mountain-ground-mask-${floor}-${spriteSafeId}`;
                                const mountainTintFilterId = `mountain-tint-filter-${floor}-${spriteSafeId}`;
                                return (
                                    <>
                                        {(mountainBlendPassEnabled || mountainTintPassEnabled) && (
                                            <defs>
                                                {mountainBlendPassEnabled && (
                                                    <>
                                                        <linearGradient id={mountainGroundGradientId} x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                                                            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.04" />
                                                            <stop offset="64%" stopColor="#ffffff" stopOpacity="0.42" />
                                                            <stop offset="82%" stopColor="#ffffff" stopOpacity="0.82" />
                                                            <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
                                                        </linearGradient>
                                                        <mask
                                                            id={mountainGroundMaskId}
                                                            maskUnits="userSpaceOnUse"
                                                            maskContentUnits="userSpaceOnUse"
                                                        >
                                                            <rect
                                                                x={imageX}
                                                                y={imageY}
                                                                width={renderWidth}
                                                                height={renderHeight}
                                                                fill={`url(#${mountainGroundGradientId})`}
                                                            />
                                                        </mask>
                                                    </>
                                                )}
                                                {mountainTintPassEnabled && (
                                                    <filter
                                                        id={mountainTintFilterId}
                                                        x="-10%"
                                                        y="-10%"
                                                        width="120%"
                                                        height="120%"
                                                    >
                                                        <feColorMatrix
                                                            type="matrix"
                                                            values={mountainSettings?.tintMatrixValues}
                                                        />
                                                    </filter>
                                                )}
                                            </defs>
                                        )}
                                        <image
                                            href={sprite.asset.path}
                                            x={imageX}
                                            y={imageY}
                                            width={renderWidth}
                                            height={renderHeight}
                                            preserveAspectRatio="xMidYMid meet"
                                            opacity={baseOpacity}
                                            style={{ filter: baseFilter }}
                                        />
                                        {mountainBlendPassEnabled && (
                                            <image
                                                href={sprite.asset.path}
                                                x={imageX}
                                                y={imageY}
                                                width={renderWidth}
                                                height={renderHeight}
                                                preserveAspectRatio="xMidYMid meet"
                                                opacity={Math.min(0.9, mountainSettings?.crustBlendOpacity || 0)}
                                                mask={`url(#${mountainGroundMaskId})`}
                                                style={{
                                                    mixBlendMode: mountainBlendMode,
                                                    filter: 'brightness(0.92) saturate(0.76) contrast(1.03)'
                                                }}
                                            />
                                        )}
                                        {mountainTintPassEnabled && (
                                            <image
                                                href={sprite.asset.path}
                                                x={imageX}
                                                y={imageY}
                                                width={renderWidth}
                                                height={renderHeight}
                                                preserveAspectRatio="xMidYMid meet"
                                                opacity={Math.min(0.95, mountainSettings?.tintOpacity || 0)}
                                                filter={`url(#${mountainTintFilterId})`}
                                                style={{ mixBlendMode: mountainTintMode }}
                                            />
                                        )}
                                    </>
                                );
                            })()}
                        </g>
                    );
                }

                if (sprite.fallback === 'shrine') {
                    return (
                        <g key={sprite.id} transform={`translate(${x},${y})`}>
                            <polygon
                                points="0,-18 8,-4 5,12 -5,12 -8,-4"
                                fill="#f97316"
                                stroke="#fff"
                                strokeWidth="1"
                                opacity="0.9"
                            />
                            <polygon points="-2,-14 2,-14 1,-2 -1,-2" fill="rgba(255,255,255,0.6)" />
                            <circle
                                cx="0"
                                cy="0"
                                r="14"
                                fill="none"
                                stroke="#fdba74"
                                strokeWidth="2"
                                opacity="0.4"
                                style={{ animation: 'shrineGlow 2s ease-in-out infinite' }}
                            />
                        </g>
                    );
                }

                return (
                    <g key={sprite.id} transform={`translate(${x},${y})`}>
                        <rect x="-12" y="6" width="8" height="4" fill="#1f2937" rx="1" />
                        <rect x="-6" y="2" width="8" height="4" fill="#374151" rx="1" />
                        <rect x="0" y="-2" width="8" height="4" fill="#4b5563" rx="1" />
                        <rect x="6" y="-6" width="8" height="4" fill="#6b7280" rx="1" />
                        <path d="M 2 -14 L 2 -20 L -4 -20 L 2 -26 L 8 -20 L 2 -20" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />
                    </g>
                );
            })}
        </g>
    );
};
