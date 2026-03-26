import React from 'react';
import { TILE_SIZE } from '@hop/engine';

interface EntityStatusOverlaysProps {
  stunned: boolean;
  blinded: boolean;
  showFacing: boolean;
  facing?: number;
  borderColor: string;
}

export const EntityStatusOverlays: React.FC<EntityStatusOverlaysProps> = ({
  stunned,
  blinded,
  showFacing,
  facing,
  borderColor
}) => (
  <>
    {blinded && (
      <g transform={`translate(0, -${TILE_SIZE * 1.05})`} className="blind-icon">
        <ellipse cx={0} cy={0} rx={8} ry={4.8} fill="none" stroke="#fde68a" strokeWidth={1.5} />
        <circle cx={0} cy={0} r={1.6} fill="#fde68a" />
        <line x1={-8} y1={6} x2={8} y2={-6} stroke="#f97316" strokeWidth={1.8} strokeLinecap="round" />
        <title>Blinded</title>
      </g>
    )}

    {stunned && (
      <g transform={`translate(0, -${TILE_SIZE * 0.72})`} className="stun-icon">
        <text fontSize="14" textAnchor="middle">*</text>
        <text fontSize="8" textAnchor="middle" dy="-3" dx="6">+</text>
        <title>Stunned</title>
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
