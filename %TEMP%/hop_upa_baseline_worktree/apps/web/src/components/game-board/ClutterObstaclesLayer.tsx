import React from 'react';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import type { BoardDepthSpriteLike, ResolvedMountainRenderSettingsLike } from './clutter-obstacles-types';
import { renderClutterObstacleSprite } from './clutter-obstacles-renderers';

interface ClutterObstaclesLayerProps {
    sprites: BoardDepthSpriteLike[];
    floor: number;
    manifestUnitToBoardScale: number;
    mountainSettingsByAssetId: Map<string, ResolvedMountainRenderSettingsLike>;
    resolveMountainSettings: (asset?: VisualAssetEntry) => ResolvedMountainRenderSettingsLike;
}

export const ClutterObstaclesLayer: React.FC<ClutterObstaclesLayerProps> = ({
    sprites,
    floor,
    manifestUnitToBoardScale,
    mountainSettingsByAssetId,
    resolveMountainSettings,
}) => {
    return (
        <g data-layer="clutter-obstacles" pointerEvents="none">
            {sprites.map((sprite) => renderClutterObstacleSprite({
                sprite,
                floor,
                manifestUnitToBoardScale,
                mountainSettingsByAssetId,
                resolveMountainSettings,
            }))}
        </g>
    );
};
