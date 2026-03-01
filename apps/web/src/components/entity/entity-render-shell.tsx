import React from 'react';
import type { Actor as EntityType } from '@hop/engine';
import { renderEntityIcon } from './entity-icon';
import { EntityStatusOverlays } from './entity-status-overlays';
import { EntityTeamPad } from './entity-team-pad';
import { EntityAilmentBadges } from './entity-ailment-badges';

interface EntityRenderShellProps {
  entity: EntityType;
  x: number;
  y: number;
  waapiControlled: boolean;
  segmentDurationMs: number;
  segmentEasing: string;
  isDying?: boolean;
  poseTransform?: string;
  stretchTransform: string;
  isFlashing: boolean;
  teleportPhase: 'none' | 'out' | 'in';
  isInvisible: boolean;
  visualOpacity: number;
  isPlayer: boolean;
  isFlying: boolean;
  unitIconYOffset: number;
  unitIconScale: number;
  unitIconSize: number;
  resolvedAssetHref?: string;
  handleAssetError: () => void;
  contrastBoost: number;
  stunned: boolean;
  showFacing: boolean;
  borderColor: string;
}

export const EntityRenderShell: React.FC<EntityRenderShellProps> = ({
  entity,
  x,
  y,
  waapiControlled,
  segmentDurationMs,
  segmentEasing,
  isDying,
  poseTransform,
  stretchTransform,
  isFlashing,
  teleportPhase,
  isInvisible,
  visualOpacity,
  isPlayer,
  isFlying,
  unitIconYOffset,
  unitIconScale,
  unitIconSize,
  resolvedAssetHref,
  handleAssetError,
  contrastBoost,
  stunned,
  showFacing,
  borderColor
}) => (
  <g style={{ pointerEvents: 'none' }}>
    <g
      data-actor-node={entity.id}
      style={{
        transition: waapiControlled ? 'none' : `transform ${segmentDurationMs}ms ${segmentEasing}`,
        transform: `translate(${x}px, ${y}px)`
      }}
      className={isDying ? 'animate-lava-sink' : ''}
    >
      <g transform={poseTransform}>
        <g
          transform={stretchTransform}
          className={`${isFlashing ? 'entity-damaged' : ''} ${!isDying && !stunned ? 'animate-idle' : ''} ${teleportPhase === 'out' ? 'entity-teleport-out' : ''} ${teleportPhase === 'in' ? 'entity-teleport-in' : ''}`}
          opacity={isInvisible ? 0.3 : visualOpacity}
          style={{ filter: isInvisible ? 'blur(1px)' : 'none' }}
        >
          <EntityTeamPad isPlayer={isPlayer} isFlying={isFlying} />

          <g transform={`translate(0,${unitIconYOffset}) scale(${unitIconScale})`}>
            {renderEntityIcon(entity, isPlayer, unitIconSize, resolvedAssetHref, handleAssetError, contrastBoost)}
          </g>

          <EntityStatusOverlays
            stunned={stunned}
            showFacing={showFacing}
            facing={entity.facing}
            borderColor={borderColor}
          />

          <EntityAilmentBadges entity={entity} />

          <title>{`${entity.subtype || entity.type} - HP ${entity.hp}/${entity.maxHp}${entity.intent ? ` - ${entity.intent}` : ''}`}</title>
        </g>
      </g>
    </g>
  </g>
);
