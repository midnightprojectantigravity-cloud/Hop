import React from 'react';
import { hexToPixel, pointToKey, TILE_SIZE, type GameState } from '@hop/engine';

const parseKeyToPoint = (key: string) => {
  const [q, r] = key.split(',').map(Number);
  return { q, r, s: -q - r };
};

const getHexPoints = (size: number): string => {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i);
    points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
  }
  return points.join(' ');
};

const TILE_WASH_POINTS = getHexPoints(TILE_SIZE * 0.42);
const LANDMARK_RING_POINTS = getHexPoints(TILE_SIZE * 0.56);

interface RoutePathLayerProps {
  gameState: GameState;
}

export const RoutePathLayer: React.FC<RoutePathLayerProps> = ({ gameState }) => {
  const pathNetwork = gameState.generatedPaths;
  if (!pathNetwork || pathNetwork.visualTileKeys.length === 0) return null;

  const visibleKeys = new Set(gameState.visibility?.playerFog?.visibleTileKeys || []);
  const exploredKeys = new Set(gameState.visibility?.playerFog?.exploredTileKeys || []);
  const showDebugTactical = Boolean(gameState.worldgenDebug);

  const exploredVisualTiles = pathNetwork.visualTileKeys.filter(key => exploredKeys.has(key) && !visibleKeys.has(key));
  const visibleVisualTiles = pathNetwork.visualTileKeys.filter(key => visibleKeys.has(key));
  const exploredVisualEdges = pathNetwork.visualEdges.filter(edge =>
    exploredKeys.has(edge.fromKey) && exploredKeys.has(edge.toKey)
    && !(visibleKeys.has(edge.fromKey) && visibleKeys.has(edge.toKey))
  );
  const visibleVisualEdges = pathNetwork.visualEdges.filter(edge =>
    visibleKeys.has(edge.fromKey) && visibleKeys.has(edge.toKey)
  );
  const visibleLandmarks = pathNetwork.landmarks.filter(landmark =>
    landmark.onPath && visibleKeys.has(pointToKey(landmark.point))
  );
  const debugSpurSegments = showDebugTactical
    ? pathNetwork.segments.filter(segment => segment.kind === 'spur')
    : [];
  const debugHiddenLandmarks = showDebugTactical
    ? pathNetwork.landmarks.filter(landmark => !landmark.onPath)
    : [];

  return (
    <g data-layer="route-path" pointerEvents="none">
      <g data-route-edges="explored">
        {exploredVisualEdges.map((edge) => {
          const from = hexToPixel(parseKeyToPoint(edge.fromKey), TILE_SIZE);
          const to = hexToPixel(parseKeyToPoint(edge.toKey), TILE_SIZE);
          return (
            <line
              key={`route-edge-explored-${edge.fromKey}-${edge.toKey}`}
              data-route-edge="explored"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(219, 122, 63, 0.34)"
              strokeWidth={Math.max(5, TILE_SIZE * 0.16)}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g data-route-edges="visible">
        {visibleVisualEdges.map((edge) => {
          const from = hexToPixel(parseKeyToPoint(edge.fromKey), TILE_SIZE);
          const to = hexToPixel(parseKeyToPoint(edge.toKey), TILE_SIZE);
          return (
            <line
              key={`route-edge-visible-${edge.fromKey}-${edge.toKey}`}
              data-route-edge="visible"
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(245, 181, 102, 0.68)"
              strokeWidth={Math.max(6, TILE_SIZE * 0.2)}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <g data-route-tiles="explored">
        {exploredVisualTiles.map((tileKey) => {
          const { x, y } = hexToPixel(parseKeyToPoint(tileKey), TILE_SIZE);
          return (
            <polygon
              key={`route-tile-explored-${tileKey}`}
              data-route-tile="explored"
              points={TILE_WASH_POINTS}
              transform={`translate(${x},${y})`}
              fill="rgba(184, 117, 79, 0.18)"
              stroke="rgba(239, 183, 127, 0.1)"
              strokeWidth="1"
            />
          );
        })}
      </g>
      <g data-route-tiles="visible">
        {visibleVisualTiles.map((tileKey) => {
          const { x, y } = hexToPixel(parseKeyToPoint(tileKey), TILE_SIZE);
          return (
            <polygon
              key={`route-tile-visible-${tileKey}`}
              data-route-tile="visible"
              points={TILE_WASH_POINTS}
              transform={`translate(${x},${y})`}
              fill="rgba(238, 171, 94, 0.28)"
              stroke="rgba(255, 221, 169, 0.28)"
              strokeWidth="1.2"
            />
          );
        })}
      </g>
      <g data-route-landmarks="visible">
        {visibleLandmarks.map((landmark) => {
          const { x, y } = hexToPixel(landmark.point, TILE_SIZE);
          return (
            <polygon
              key={`route-landmark-${landmark.id}`}
              data-route-landmark="main"
              points={LANDMARK_RING_POINTS}
              transform={`translate(${x},${y})`}
              fill="none"
              stroke="rgba(255, 224, 178, 0.72)"
              strokeWidth="1.4"
              strokeDasharray="5 4"
            />
          );
        })}
      </g>
      {showDebugTactical && (
        <g data-route-debug="tactical">
          {debugSpurSegments.map((segment) =>
            segment.edges.map((edge) => {
              const from = hexToPixel(parseKeyToPoint(edge.fromKey), TILE_SIZE);
              const to = hexToPixel(parseKeyToPoint(edge.toKey), TILE_SIZE);
              return (
                <line
                  key={`route-debug-${segment.id}-${edge.fromKey}-${edge.toKey}`}
                  data-route-edge="tactical-spur"
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="rgba(132, 189, 255, 0.44)"
                  strokeWidth={Math.max(3, TILE_SIZE * 0.11)}
                  strokeLinecap="round"
                  strokeDasharray="7 5"
                />
              );
            })
          )}
          {debugHiddenLandmarks.map((landmark) => {
            const { x, y } = hexToPixel(landmark.point, TILE_SIZE);
            return (
              <circle
                key={`route-hidden-landmark-${landmark.id}`}
                data-route-landmark="hidden"
                cx={x}
                cy={y}
                r={Math.max(4, TILE_SIZE * 0.14)}
                fill="rgba(117, 177, 255, 0.78)"
                stroke="rgba(240, 248, 255, 0.82)"
                strokeWidth="1.1"
              />
            );
          })}
        </g>
      )}
    </g>
  );
};
