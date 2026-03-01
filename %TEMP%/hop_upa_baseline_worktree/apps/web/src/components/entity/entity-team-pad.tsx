import React from 'react';
import { TILE_SIZE } from '@hop/engine';

interface EntityTeamPadProps {
  isPlayer: boolean;
  isFlying: boolean;
}

export const EntityTeamPad: React.FC<EntityTeamPadProps> = ({ isPlayer, isFlying }) => {
  const baseRingStroke = isPlayer ? '#22e7ff' : 'rgba(255,120,120,0.7)';
  const baseRingFill = isPlayer ? 'rgba(34,231,255,0.20)' : 'rgba(239,68,68,0.16)';
  const ringGlow = isPlayer ? 'rgba(34,231,255,0.36)' : 'rgba(255,90,90,0.28)';
  const ringRx = isPlayer ? TILE_SIZE * 0.48 : TILE_SIZE * 0.42;
  const ringRy = isPlayer ? TILE_SIZE * 0.17 : TILE_SIZE * 0.145;
  const ringY = isPlayer ? TILE_SIZE * 0.32 : TILE_SIZE * 0.3;

  return (
    <>
      <g transform={`translate(0,${ringY})`}>
        <ellipse
          cx={0}
          cy={0}
          rx={ringRx}
          ry={ringRy}
          fill={baseRingFill}
          stroke={baseRingStroke}
          strokeWidth={2}
          opacity={0.95}
          style={{ filter: `drop-shadow(0 0 5px ${ringGlow})` }}
        />
        <ellipse
          cx={0}
          cy={0}
          rx={ringRx * 1.14}
          ry={ringRy * 1.14}
          fill="none"
          stroke={baseRingStroke}
          strokeWidth={isPlayer ? 1.8 : 1.6}
          opacity={isPlayer ? 0.62 : 0.54}
        />
      </g>

      {isFlying && (
        <ellipse
          cx={0}
          cy={TILE_SIZE * 0.3}
          rx={TILE_SIZE * 0.4}
          ry={TILE_SIZE * 0.15}
          fill="black"
          opacity={0.2}
        />
      )}
    </>
  );
};
