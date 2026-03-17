import React from 'react';
import { isStunned, hexToPixel, TILE_SIZE, getEntityVisual, isEntityFlying } from '@hop/engine';
import { computeEntityContrastBoost } from './entity/entity-icon';
import { areEntityPropsEqual } from './entity/entity-props-comparator';
import { EntityRenderShell } from './entity/entity-render-shell';
import { EntitySpear } from './entity/entity-spear';
import { useEntityVisualState } from './entity/use-entity-visual-state';
import type { EntityProps } from './entity/entity-types';
import { SYNAPSE_PULSE_DURATION_MS } from '../app/synapse';
import type { RegisteredActorNodes } from './game-board/actor-node-registry';

export type { EntityVisualPose } from './entity/entity-types';

const EntityBase: React.FC<EntityProps> = ({
    entity,
    isSpear,
    isDying,
    assetHref,
    fallbackAssetHref,
    floorTheme,
    visualPose,
    synapseMode = false,
    onSynapseInspect,
    synapsePulseToken,
    registerActorNodes,
}) => {
    const isPlayer = entity.type === 'player';
    const {
        resolvedAssetHref,
        handleAssetError,
        isFlashing
    } = useEntityVisualState({
        entity,
        assetHref,
        fallbackAssetHref
    });
    const [synapsePulseActive, setSynapsePulseActive] = React.useState(false);

    React.useEffect(() => {
        if (!synapsePulseToken) return undefined;
        setSynapsePulseActive(true);
        const timeoutId = setTimeout(() => setSynapsePulseActive(false), SYNAPSE_PULSE_DURATION_MS);
        return () => clearTimeout(timeoutId);
    }, [synapsePulseToken]);

    const { x, y } = hexToPixel(entity.position, TILE_SIZE);

    // Handle invisibility (assassin)
    const isInvisible = entity.isVisible === false;
    const stunned = isStunned(entity);
    const blinded = (entity.statusEffects || []).some(status => status.type === 'blinded');

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
    const inspectable = Boolean(synapseMode && onSynapseInspect && !isSpear && !isDying);
    const handleInspect = React.useCallback((event: React.MouseEvent<SVGGElement>) => {
        if (!onSynapseInspect) return;
        event.stopPropagation();
        onSynapseInspect(entity.id);
    }, [entity.id, onSynapseInspect]);
    const handleActorNodesChange = React.useCallback((nodes: RegisteredActorNodes | null) => {
        registerActorNodes?.(entity.id, nodes);
    }, [entity.id, registerActorNodes]);

    return (
        <EntityRenderShell
            entity={entity}
            x={x}
            y={y}
            isDying={isDying}
            poseTransform={poseTransform}
            isFlashing={isFlashing}
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
            blinded={blinded}
            showFacing={Boolean(visual.showFacing)}
            borderColor={visual.borderColor}
            interactive={inspectable}
            onInspect={inspectable ? handleInspect : undefined}
            synapsePulseActive={synapsePulseActive}
            onActorNodesChange={registerActorNodes ? handleActorNodesChange : undefined}
        />
    );
};

export const Entity = React.memo(EntityBase, areEntityPropsEqual);

