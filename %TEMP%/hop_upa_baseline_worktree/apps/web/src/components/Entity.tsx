import React from 'react';
import { isStunned, hexToPixel, getDirectionFromTo, hexEquals, TILE_SIZE, getEntityVisual, isEntityFlying } from '@hop/engine';
import { computeEntityContrastBoost } from './entity/entity-icon';
import { areEntityPropsEqual } from './entity/entity-props-comparator';
import { EntityRenderShell } from './entity/entity-render-shell';
import { EntitySpear } from './entity/entity-spear';
import { useEntityMotion } from './entity/use-entity-motion';
import { useEntityVisualState } from './entity/use-entity-visual-state';
import type { EntityProps } from './entity/entity-types';

export type { EntityVisualPose } from './entity/entity-types';

const EntityBase: React.FC<EntityProps> = ({
    entity,
    isSpear,
    isDying,
    movementTrace,
    waapiControlled = false,
    assetHref,
    fallbackAssetHref,
    floorTheme,
    visualPose
}) => {
    const isPlayer = entity.type === 'player';
    const movementDebugEnabled = typeof window !== 'undefined' && Boolean((window as any).__HOP_DEBUG_MOVEMENT);
    const {
        displayPos,
        displayPixel,
        animationPrevPos,
        segmentDurationMs,
        segmentEasing,
        teleportPhase
    } = useEntityMotion({
        entity,
        movementTrace,
        waapiControlled,
        movementDebugEnabled
    });
    const {
        resolvedAssetHref,
        handleAssetError,
        isFlashing
    } = useEntityVisualState({
        entity,
        assetHref,
        fallbackAssetHref
    });

    const { x, y } = displayPixel || hexToPixel(displayPos, TILE_SIZE);

    // Calculate movement stretch based on the animating previous position
    let stretchTransform = '';
    const movePrev = animationPrevPos;
    if (movePrev && !hexEquals(displayPos, movePrev)) {
        const dir = getDirectionFromTo(movePrev, displayPos);
        if (dir !== -1) {
            const angle = dir * 60;
            stretchTransform = `rotate(${angle}) scale(1.15, 0.85) rotate(${-angle})`;
        }
    }

    // Handle invisibility (assassin)
    const isInvisible = entity.isVisible === false;
    const stunned = isStunned(entity);

    if (isSpear) {
        const spearVisual = getEntityVisual('spear', 'enemy'); // Spear is treated like an entity for visual config
        return <EntitySpear x={x} y={y} icon={spearVisual.icon} />;
    }

    const visual = getEntityVisual(entity.subtype, entity.type, entity.enemyType as 'melee' | 'ranged' | 'boss', entity.archetype);
    const isFlying = isEntityFlying(entity);
    const unitIconScale = isPlayer ? 1.34 : 0.92;
    const unitIconYOffset = isPlayer ? -9 : -2;
    const unitIconSize = isPlayer ? 24 : 18;
    const contrastBoost = computeEntityContrastBoost(floorTheme);
    const poseOffsetX = visualPose?.offsetX ?? 0;
    const poseOffsetY = visualPose?.offsetY ?? 0;
    const poseScaleX = visualPose?.scaleX ?? 1;
    const poseScaleY = visualPose?.scaleY ?? 1;
    const hasPoseTransform = Math.abs(poseOffsetX) > 0.01
        || Math.abs(poseOffsetY) > 0.01
        || Math.abs(poseScaleX - 1) > 0.01
        || Math.abs(poseScaleY - 1) > 0.01;
    const poseTransform = hasPoseTransform
        ? `translate(${poseOffsetX},${poseOffsetY}) scale(${poseScaleX},${poseScaleY})`
        : undefined;

    return (
        <EntityRenderShell
            entity={entity}
            x={x}
            y={y}
            waapiControlled={waapiControlled}
            segmentDurationMs={segmentDurationMs}
            segmentEasing={segmentEasing}
            isDying={isDying}
            poseTransform={poseTransform}
            stretchTransform={stretchTransform}
            isFlashing={isFlashing}
            teleportPhase={teleportPhase}
            isInvisible={isInvisible}
            visualOpacity={visual.opacity || 1}
            isPlayer={isPlayer}
            isFlying={isFlying}
            unitIconYOffset={unitIconYOffset}
            unitIconScale={unitIconScale}
            unitIconSize={unitIconSize}
            resolvedAssetHref={resolvedAssetHref}
            handleAssetError={handleAssetError}
            contrastBoost={contrastBoost}
            stunned={stunned}
            showFacing={Boolean(visual.showFacing)}
            borderColor={visual.borderColor}
        />
    );
};

export const Entity = React.memo(EntityBase, areEntityPropsEqual);

