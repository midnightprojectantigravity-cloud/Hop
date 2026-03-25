import React from 'react';
import { TILE_SIZE } from '@hop/engine';

interface EntityStatusOverlaysProps {
  stunned: boolean;
  blinded: boolean;
  showFacing: boolean;
  facing?: number;
  borderColor: string;
  iresState?: 'rested' | 'base' | 'exhausted';
  exhaustion?: number;
}

export const EntityStatusOverlays: React.FC<EntityStatusOverlaysProps> = ({
  stunned,
  blinded,
  showFacing,
  facing,
  borderColor,
  iresState,
  exhaustion = 0
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

    {iresState && iresState !== 'base' && (
      <g transform={`translate(0, ${TILE_SIZE * 0.95})`} className={iresState === 'exhausted' ? 'ires-exhausted-badge' : ''}>
        <rect
          x={-12}
          y={-5}
          rx={4}
          width={24}
          height={10}
          fill={iresState === 'exhausted' ? 'rgba(127,29,29,0.92)' : 'rgba(186,230,253,0.92)'}
          stroke={iresState === 'exhausted' ? 'rgba(251,113,133,0.8)' : 'rgba(14,116,144,0.8)'}
          strokeWidth={1}
        />
        <text
          x={0}
          y={2.5}
          textAnchor="middle"
          fontSize="6.2"
          fill={iresState === 'exhausted' ? '#ffe4e6' : '#082f49'}
          style={{ fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase' as any }}
        >
          {iresState === 'exhausted' ? 'RED' : 'RST'}
        </text>
        {iresState === 'exhausted' && (
          <title>{`Redline ${Math.round(exhaustion)}% reserve spent`}</title>
        )}
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
