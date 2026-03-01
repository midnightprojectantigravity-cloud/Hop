import React from 'react';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveCombatTextFrameAssetId } from '../../visual/asset-selectors';
import type { JuiceEffect } from './juice-types';
import { renderJuiceEffect } from './juice-effect-renderers';

interface JuiceEffectsLayerProps {
    effects: JuiceEffect[];
    assetById: Map<string, VisualAssetEntry>;
}

export const JuiceEffectsLayer: React.FC<JuiceEffectsLayerProps> = ({ effects, assetById }) => {
    const frameAssetHref = assetById.get(resolveCombatTextFrameAssetId())?.path;
    const nowMs = Date.now();

    return (
        <g style={{ pointerEvents: 'none' }}>
            {effects.map(effect => renderJuiceEffect({
                effect,
                assetById,
                frameAssetHref,
                nowMs,
            }))}
        </g>
    );
};
