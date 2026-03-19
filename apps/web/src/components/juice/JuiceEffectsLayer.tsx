import React, { useMemo } from 'react';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveCombatTextFrameAssetId } from '../../visual/asset-selectors';
import type { JuiceEffect } from './juice-types';
import { renderJuiceEffect } from './juice-effect-renderers';

interface JuiceEffectsLayerProps {
    effects: ReadonlyArray<JuiceEffect>;
    nowMs: number;
    assetById: Map<string, VisualAssetEntry>;
}

const JuiceEffectNode: React.FC<{
    effect: JuiceEffect;
    assetById: Map<string, VisualAssetEntry>;
    frameAssetHref?: string;
}> = React.memo(({ effect, assetById, frameAssetHref }) => (
    <>{renderJuiceEffect({ effect, assetById, frameAssetHref })}</>
));

export const JuiceEffectsLayer: React.FC<JuiceEffectsLayerProps> = ({ effects, nowMs, assetById }) => {
    const frameAssetHref = assetById.get(resolveCombatTextFrameAssetId())?.path;
    const visibleEffects = useMemo(
        () => effects.filter((effect) => nowMs >= effect.startTime),
        [effects, nowMs]
    );

    return (
        <g style={{ pointerEvents: 'none' }}>
            {visibleEffects.map((effect) => (
                <JuiceEffectNode
                    key={effect.id}
                    effect={effect}
                    assetById={assetById}
                    frameAssetHref={frameAssetHref}
                />
            ))}
        </g>
    );
};
