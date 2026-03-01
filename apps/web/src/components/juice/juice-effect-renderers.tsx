import React from 'react';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveFxAssetId } from '../../visual/asset-selectors';
import type { JuiceEffect, JuiceEffectType } from './juice-types';
import { renderGenericEffect } from './juice-effect-generic-renderers';
import { renderSignatureEffect } from './juice-effect-signature-renderers';

interface RenderJuiceEffectArgs {
    effect: JuiceEffect;
    assetById: Map<string, VisualAssetEntry>;
    frameAssetHref?: string;
    nowMs: number;
}

const FX_ASSET_EFFECT_TYPES = new Set<JuiceEffectType>([
    'impact',
    'flash',
    'combat_text',
    'spear_trail',
    'vaporize',
    'lava_ripple',
    'explosion_ring'
]);

export const renderJuiceEffect = ({
    effect,
    assetById,
    frameAssetHref,
    nowMs,
}: RenderJuiceEffectArgs): React.ReactNode => {
    if (nowMs < effect.startTime) return null;
    if (!effect.position && !effect.worldPosition) return null;

    const fallbackPoint = effect.position ? hexToPixel(effect.position, TILE_SIZE) : { x: 0, y: 0 };
    const x = effect.worldPosition?.x ?? fallbackPoint.x;
    const y = effect.worldPosition?.y ?? fallbackPoint.y;
    const fxAssetId = FX_ASSET_EFFECT_TYPES.has(effect.type)
        ? resolveFxAssetId(effect.type as 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring')
        : undefined;
    const fxAssetHref = fxAssetId ? assetById.get(fxAssetId)?.path : undefined;

    if (effect.type === 'basic_attack_strike' || effect.type === 'archer_shot_signature') {
        return renderSignatureEffect({ effect, x, y });
    }
    return renderGenericEffect({ effect, x, y, fxAssetHref, frameAssetHref });
};

