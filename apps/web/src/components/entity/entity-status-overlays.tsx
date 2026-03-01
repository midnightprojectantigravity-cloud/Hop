import React from 'react';
import { TILE_SIZE } from '@hop/engine';

interface EntityStatusOverlaysProps {
  stunned: boolean;
  showFacing: boolean;
  facing?: number;
  borderColor: string;
}

export const EntityStatusOverlays: React.FC<EntityStatusOverlaysProps> = ({
  stunned,
  showFacing,
  facing,
  borderColor
}) => (
  <>
    {stunned && (
      <g transform={`translate(0, -${TILE_SIZE * 0.8})`} className="stun-icon">
        <text fontSize="14" textAnchor="middle">*</text>
        <text fontSize="8" textAnchor="middle" dy="-3" dx="6">+</text>
      </g>
    )}

    {showFacing && facing !== undefined && !stunned && (
      <line
        x1={0}
        y1={0}
        x2={Math.cos((facing * 60 - 90) * Math.PI / 180) * TILE_SIZE * 0.5}
        y2={Math.sin((facing * 60 - 90) * Math.PI / 180) * TILE_SIZE * 0.5}
        stroke={borderColor}
        strokeWidth={3}
        strokeLinecap="round"
      />
    )}
  </>
);
