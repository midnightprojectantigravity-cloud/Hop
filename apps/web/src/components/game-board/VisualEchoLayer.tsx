import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';

export interface VisualEchoEntry {
  id: string;
  actorId: string;
  position: Point;
  expireTurn: number;
}

interface VisualEchoLayerProps {
  echoes: VisualEchoEntry[];
  currentTurn: number;
  enhanced?: boolean;
}

export const VisualEchoLayer = ({ echoes, currentTurn, enhanced = false }: VisualEchoLayerProps) => {
  const activeEchoes = React.useMemo(
    () => echoes.filter((echo) => echo.expireTurn >= currentTurn),
    [currentTurn, echoes]
  );

  if (activeEchoes.length === 0) return null;

  return (
    <g className={`visual-echo-layer ${enhanced ? 'visual-echo-layer-enhanced' : ''}`}>
      {activeEchoes.map((echo) => {
        const center = hexToPixel(echo.position, TILE_SIZE);
        return (
          <g key={echo.id} transform={`translate(${center.x}, ${center.y})`}>
            <circle
              r={TILE_SIZE * 0.42}
              fill="var(--accent-royal-soft)"
              stroke="var(--accent-royal)"
              strokeWidth={2}
              className="visual-echo-ring"
            />
            <circle
              r={TILE_SIZE * 0.18}
              fill="var(--surface-panel)"
              stroke="var(--border-subtle)"
              strokeWidth={1.5}
              className="visual-echo-core"
            />
          </g>
        );
      })}
    </g>
  );
};

