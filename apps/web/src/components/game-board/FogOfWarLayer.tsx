import React from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, type GameState, type Point } from '@hop/engine';

interface FogOfWarLayerProps {
  gameState: GameState;
  cells: Point[];
}

const getHexCorners = (size: number): string => {
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
  }
  return points.join(' ');
};

const FOG_POLYGON = getHexCorners(TILE_SIZE - 2);

export const FogOfWarLayer: React.FC<FogOfWarLayerProps> = ({ gameState, cells }) => {
  const fog = gameState.visibility?.playerFog;
  if (!fog) return null;

  const visibleKeys = new Set(fog.visibleTileKeys || []);
  const exploredKeys = new Set(fog.exploredTileKeys || []);

  return (
    <g data-layer="fog-of-war" pointerEvents="none">
      {cells.map((hex) => {
        const key = pointToKey(hex);
        const isVisible = visibleKeys.has(key);
        const isExplored = exploredKeys.has(key);
        const opacity = isVisible ? 0 : (isExplored ? 0.42 : 0.78);
        if (opacity <= 0) return null;
        const { x, y } = hexToPixel(hex, TILE_SIZE);
        return (
          <polygon
            key={`fow-${key}`}
            points={FOG_POLYGON}
            transform={`translate(${x},${y})`}
            fill={`rgba(8, 8, 10, ${opacity})`}
          />
        );
      })}
    </g>
  );
};

