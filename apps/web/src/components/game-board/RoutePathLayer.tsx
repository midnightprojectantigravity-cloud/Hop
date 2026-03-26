import React, { useMemo } from 'react';
import {
  hexToPixel,
  pointToKey,
  TILE_SIZE,
  type GameState,
  type PathEdge,
  type PathSegment
} from '@hop/engine';

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
const MIN_MEANINGFUL_ALT_TILES = 4;

const buildEdgeSignature = (left: string, right: string): string =>
  left < right ? `${left}|${right}` : `${right}|${left}`;

type DisplaySegment = Pick<PathSegment, 'id' | 'kind' | 'routeMembership' | 'fromLandmarkId' | 'toLandmarkId'> & {
  tileKeys: string[];
  edges: PathEdge[];
};

interface RoutePathLayerProps {
  gameState: GameState;
}

export const RoutePathLayer: React.FC<RoutePathLayerProps> = ({ gameState }) => {
  const pathNetwork = gameState.generatedPaths;
  if (!pathNetwork || pathNetwork.visualTileKeys.length === 0) return null;

  const visibleKeys = new Set(gameState.visibility?.playerFog?.visibleTileKeys || []);
  const exploredKeys = new Set(gameState.visibility?.playerFog?.exploredTileKeys || []);
  const showDebugTactical = Boolean(gameState.worldgenDebug);
  const displayNetwork = useMemo(() => {
    const displayedSegments: DisplaySegment[] = [];

    for (const segment of pathNetwork.segments) {
      if (segment.kind === 'spur') continue;
      displayedSegments.push({
        id: segment.id,
        kind: segment.kind,
        routeMembership: segment.routeMembership,
        fromLandmarkId: segment.fromLandmarkId,
        toLandmarkId: segment.toLandmarkId,
        tileKeys: [...segment.tileKeys],
        edges: [...segment.edges]
      });
    }

    const primaryKeys = new Set(
      displayedSegments
        .filter((segment) => segment.routeMembership === 'primary')
        .flatMap((segment) => segment.tileKeys)
    );
    const alternateKeys = new Set(
      displayedSegments
        .filter((segment) => segment.routeMembership === 'alternate')
        .flatMap((segment) => segment.tileKeys)
    );
    const primaryOnlyCount = Array.from(primaryKeys).filter((key) => !alternateKeys.has(key)).length;
    const alternateOnlyCount = Array.from(alternateKeys).filter((key) => !primaryKeys.has(key)).length;
    const keepAlternate =
      alternateKeys.size === 0
      || (
        primaryOnlyCount >= MIN_MEANINGFUL_ALT_TILES
        && alternateOnlyCount >= MIN_MEANINGFUL_ALT_TILES
      );

    const filteredSegments = keepAlternate
      ? displayedSegments
      : displayedSegments.filter((segment) => segment.routeMembership !== 'alternate');
    const tileKeys = new Set<string>();
    const edgeMap = new Map<string, PathEdge>();
    filteredSegments.forEach((segment) => {
      segment.tileKeys.forEach((key) => tileKeys.add(key));
      segment.edges.forEach((edge) => edgeMap.set(buildEdgeSignature(edge.fromKey, edge.toKey), edge));
    });

    return {
      tileKeys: Array.from(tileKeys).sort(),
      edges: Array.from(edgeMap.values()).sort((left, right) =>
        left.fromKey.localeCompare(right.fromKey) || left.toKey.localeCompare(right.toKey)
      )
    };
  }, [pathNetwork]);
  const displayTileKeySet = useMemo(() => new Set(displayNetwork.tileKeys), [displayNetwork.tileKeys]);
  const exploredVisualTiles = displayNetwork.tileKeys.filter(key => exploredKeys.has(key) && !visibleKeys.has(key));
  const visibleVisualTiles = displayNetwork.tileKeys.filter(key => visibleKeys.has(key));
  const exploredVisualEdges = displayNetwork.edges.filter(edge =>
    exploredKeys.has(edge.fromKey) && exploredKeys.has(edge.toKey)
    && !(visibleKeys.has(edge.fromKey) && visibleKeys.has(edge.toKey))
  );
  const visibleVisualEdges = displayNetwork.edges.filter(edge =>
    visibleKeys.has(edge.fromKey) && visibleKeys.has(edge.toKey)
  );
  const visibleLandmarks = pathNetwork.landmarks.filter(landmark =>
    landmark.onPath
    && visibleKeys.has(pointToKey(landmark.point))
    && displayTileKeySet.has(pointToKey(landmark.point))
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
              data-route-edge-key={`${edge.fromKey}|${edge.toKey}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(156, 123, 93, 0.18)"
              strokeWidth={Math.max(3.5, TILE_SIZE * 0.11)}
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
              data-route-edge-key={`${edge.fromKey}|${edge.toKey}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(212, 187, 144, 0.32)"
              strokeWidth={Math.max(4, TILE_SIZE * 0.13)}
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
              data-route-key={tileKey}
              points={TILE_WASH_POINTS}
              transform={`translate(${x},${y})`}
              fill="rgba(128, 104, 82, 0.07)"
              stroke="rgba(191, 164, 132, 0.07)"
              strokeWidth="0.8"
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
              data-route-key={tileKey}
              points={TILE_WASH_POINTS}
              transform={`translate(${x},${y})`}
              fill="rgba(187, 160, 122, 0.12)"
              stroke="rgba(231, 214, 188, 0.14)"
              strokeWidth="0.95"
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
              data-route-landmark-id={landmark.id}
              points={LANDMARK_RING_POINTS}
              transform={`translate(${x},${y})`}
              fill="none"
              stroke="rgba(226, 207, 177, 0.34)"
              strokeWidth="1"
              strokeDasharray="4 5"
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
                  data-route-edge-key={`${edge.fromKey}|${edge.toKey}`}
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
                data-route-landmark-id={landmark.id}
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
