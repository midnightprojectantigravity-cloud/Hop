import React from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, type GameState, type Point } from '@hop/engine';
import { buildTranslatedPolygonPath, parseSvgPointList } from './board-svg-paths';

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

  const polygonPoints = React.useMemo(() => parseSvgPointList(FOG_POLYGON), []);
  const { exploredPath, unseenPath } = React.useMemo(() => {
    const visibleKeys = new Set(fog.visibleTileKeys || []);
    const exploredKeys = new Set(fog.exploredTileKeys || []);
    const exploredOrigins: Array<{ x: number; y: number }> = [];
    const unseenOrigins: Array<{ x: number; y: number }> = [];

    for (const hex of cells) {
      const key = pointToKey(hex);
      if (visibleKeys.has(key)) continue;
      const origin = hexToPixel(hex, TILE_SIZE);
      if (exploredKeys.has(key)) {
        exploredOrigins.push(origin);
      } else {
        unseenOrigins.push(origin);
      }
    }

    return {
      exploredPath: buildTranslatedPolygonPath(exploredOrigins, polygonPoints),
      unseenPath: buildTranslatedPolygonPath(unseenOrigins, polygonPoints),
    };
  }, [cells, fog.exploredTileKeys, fog.visibleTileKeys, polygonPoints]);

  return (
    <g data-layer="fog-of-war" pointerEvents="none">
      {unseenPath && (
        <path
          d={unseenPath}
          fill="rgba(8, 8, 10, 0.78)"
        />
      )}
      {exploredPath && (
        <path
          d={exploredPath}
          fill="rgba(8, 8, 10, 0.42)"
        />
      )}
    </g>
  );
};
