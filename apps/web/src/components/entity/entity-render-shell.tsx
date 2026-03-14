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
  isDying?: boolean;
  poseTransform?: string;
  isFlashing: boolean;
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
  blinded: boolean;
  showFacing: boolean;
  borderColor: string;
  interactive?: boolean;
  onInspect?: (event: React.MouseEvent<SVGGElement>) => void;
  synapsePulseActive?: boolean;
}

export const EntityRenderShell: React.FC<EntityRenderShellProps> = ({
  entity,
  x,
  y,
  isDying,
  poseTransform,
  isFlashing,
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
  blinded,
  showFacing,
  borderColor,
  interactive,
  onInspect,
  synapsePulseActive
}) => (
  <g style={{ pointerEvents: interactive ? 'auto' : 'none' }}>
    <g
      data-actor-node={entity.id}
      data-synapse-pulse={synapsePulseActive ? 'active' : undefined}
      style={{
        transform: `translate(${x}px, ${y}px)`
      }}
      className={`${isDying ? 'animate-lava-sink' : ''} ${interactive ? 'entity-synapse-inspectable' : ''} ${synapsePulseActive ? 'entity-synapse-pulse' : ''}`}
      onClick={interactive ? onInspect : undefined}
    >
      <g data-actor-pad-node={entity.id}>
        <EntityTeamPad isPlayer={isPlayer} isFlying={isFlying} />
      </g>
      <g data-actor-motion-node={entity.id}>
        <g transform={poseTransform}>
          <g
            className={`${isFlashing ? 'entity-damaged' : ''} ${!isDying && !stunned ? 'animate-idle' : ''}`}
            opacity={isInvisible ? 0.3 : visualOpacity}
            style={{ filter: isInvisible ? 'blur(1px)' : 'none' }}
          >
            <g transform={`translate(0,${unitIconYOffset}) scale(${unitIconScale})`}>
              {renderEntityIcon(entity, isPlayer, unitIconSize, resolvedAssetHref, handleAssetError, contrastBoost)}
            </g>

            <EntityStatusOverlays
              stunned={stunned}
              blinded={blinded}
              showFacing={showFacing}
              facing={entity.facing}
              borderColor={borderColor}
              iresState={entity.ires?.currentState}
              exhaustion={entity.ires?.exhaustion}
            />

            <EntityAilmentBadges entity={entity} />

            <title>{`${entity.subtype || entity.type}`}</title>
          </g>
        </g>
      </g>
    </g>
  </g>
);
