import React, { useMemo } from 'react';
import {
  UnifiedTileService,
  getNeighbors,
  hexToPixel,
  pointToKey,
  TILE_SIZE,
  type GameState,
  type PathEdge,
  type PathSegment,
  type Point
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

const buildEdgesFromTileKeys = (tileKeys: string[]): PathEdge[] => {
  const edges: PathEdge[] = [];
  for (let index = 1; index < tileKeys.length; index += 1) {
    const previous = tileKeys[index - 1];
    const current = tileKeys[index];
    if (!previous || !current || previous === current) continue;
    const [fromKey, toKey] = previous < current ? [previous, current] : [current, previous];
    edges.push({ fromKey, toKey });
  }
  return edges;
};

const isDisplayHazard = (gameState: GameState, point: Point): boolean => {
  const traits = UnifiedTileService.getTraitsAt(gameState, point);
  return traits.has('HAZARDOUS') || traits.has('LAVA') || traits.has('FIRE') || traits.has('VOID');
};

const isDisplayWalkable = (gameState: GameState, point: Point): boolean =>
  UnifiedTileService.isWalkable(gameState, point);

type DisplaySegment = Pick<PathSegment, 'id' | 'kind' | 'routeMembership' | 'fromLandmarkId' | 'toLandmarkId'> & {
  tileKeys: string[];
  edges: PathEdge[];
};

const resolveDisplaySegmentPath = (
  gameState: GameState,
  sourceKey: string,
  targetKey: string,
  preferredKeys: ReadonlySet<string>,
  disfavoredKeys: ReadonlySet<string>
): string[] | null => {
  type QueueEntry = {
    key: string;
    cost: number;
    steps: number;
  };

  const search = (avoidHazards: boolean): string[] | null => {
    const frontier: QueueEntry[] = [{ key: sourceKey, cost: 0, steps: 0 }];
    const costByKey = new Map<string, number>([[sourceKey, 0]]);
    const predecessorByKey = new Map<string, string | null>([[sourceKey, null]]);
    const stepByKey = new Map<string, number>([[sourceKey, 0]]);

    while (frontier.length > 0) {
      let bestIndex = 0;
      for (let index = 1; index < frontier.length; index += 1) {
        const candidate = frontier[index]!;
        const currentBest = frontier[bestIndex]!;
        if (
          candidate.cost < currentBest.cost
          || (candidate.cost === currentBest.cost && candidate.steps < currentBest.steps)
          || (
            candidate.cost === currentBest.cost
            && candidate.steps === currentBest.steps
            && candidate.key.localeCompare(currentBest.key) < 0
          )
        ) {
          bestIndex = index;
        }
      }

      const current = frontier.splice(bestIndex, 1)[0]!;
      const bestKnownCost = costByKey.get(current.key);
      const bestKnownSteps = stepByKey.get(current.key);
      if (bestKnownCost !== current.cost || bestKnownSteps !== current.steps) continue;
      if (current.key === targetKey) break;

      const currentPoint = parseKeyToPoint(current.key);
      const neighbors = getNeighbors(currentPoint)
        .map(pointToKey)
        .sort((left, right) => left.localeCompare(right));

      for (const neighborKey of neighbors) {
        const neighborPoint = parseKeyToPoint(neighborKey);
        if (!isDisplayWalkable(gameState, neighborPoint)) continue;

        const isHazard = isDisplayHazard(gameState, neighborPoint);
        if (avoidHazards && isHazard && neighborKey !== targetKey) continue;

        let edgeCost = 10;
        if (isHazard && neighborKey !== targetKey) edgeCost += 40;
        if (!preferredKeys.has(neighborKey)) edgeCost += 3;
        if (disfavoredKeys.has(neighborKey) && neighborKey !== targetKey) edgeCost += 9;

        const nearbyBlockers = getNeighbors(neighborPoint).reduce((count, adjacent) => {
          if (!isDisplayWalkable(gameState, adjacent)) return count + 1;
          if (isDisplayHazard(gameState, adjacent)) return count + 1;
          return count;
        }, 0);
        edgeCost += nearbyBlockers;

        const nextCost = current.cost + edgeCost;
        const nextSteps = current.steps + 1;
        const knownCost = costByKey.get(neighborKey);
        const knownSteps = stepByKey.get(neighborKey);
        if (
          knownCost !== undefined
          && (
            nextCost > knownCost
            || (nextCost === knownCost && knownSteps !== undefined && nextSteps >= knownSteps)
          )
        ) {
          continue;
        }

        costByKey.set(neighborKey, nextCost);
        stepByKey.set(neighborKey, nextSteps);
        predecessorByKey.set(neighborKey, current.key);
        frontier.push({ key: neighborKey, cost: nextCost, steps: nextSteps });
      }
    }

    if (!costByKey.has(targetKey)) return null;

    const reversed: string[] = [];
    let currentKey: string | null | undefined = targetKey;
    while (currentKey) {
      reversed.push(currentKey);
      currentKey = predecessorByKey.get(currentKey);
    }
    return reversed.reverse();
  };

  return search(true) || search(false);
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
    const landmarksById = new Map(pathNetwork.landmarks.map((landmark) => [landmark.id, landmark]));
    const primarySupportKeys = new Set(
      pathNetwork.segments
        .filter((segment) => segment.kind !== 'spur' && segment.routeMembership === 'primary')
        .flatMap((segment) => segment.tileKeys)
    );
    const alternateSupportKeys = new Set(
      pathNetwork.segments
        .filter((segment) => segment.kind !== 'spur' && segment.routeMembership === 'alternate')
        .flatMap((segment) => segment.tileKeys)
    );

    for (const segment of pathNetwork.segments) {
      if (segment.kind === 'spur') continue;
      const sourceLandmark = landmarksById.get(segment.fromLandmarkId);
      const targetLandmark = landmarksById.get(segment.toLandmarkId);
      const sourceKey = sourceLandmark ? pointToKey(sourceLandmark.point) : segment.tileKeys[0];
      const targetKey = targetLandmark ? pointToKey(targetLandmark.point) : segment.tileKeys[segment.tileKeys.length - 1];
      if (!sourceKey || !targetKey) continue;

      const preferredKeys = new Set(segment.tileKeys);
      const opposingKeys = segment.routeMembership === 'alternate'
        ? primarySupportKeys
        : alternateSupportKeys;
      const disfavoredKeys = new Set(
        Array.from(opposingKeys).filter((key) =>
          key !== sourceKey
          && key !== targetKey
          && !preferredKeys.has(key)
        )
      );

      const reroutedTileKeys = resolveDisplaySegmentPath(
        gameState,
        sourceKey,
        targetKey,
        preferredKeys,
        disfavoredKeys
      ) || segment.tileKeys;

      displayedSegments.push({
        id: segment.id,
        kind: segment.kind,
        routeMembership: segment.routeMembership,
        fromLandmarkId: segment.fromLandmarkId,
        toLandmarkId: segment.toLandmarkId,
        tileKeys: reroutedTileKeys,
        edges: buildEdgesFromTileKeys(reroutedTileKeys)
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
  }, [gameState, pathNetwork]);
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
              data-route-edge-key={`${edge.fromKey}|${edge.toKey}`}
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
              data-route-key={tileKey}
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
              data-route-key={tileKey}
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
              data-route-landmark-id={landmark.id}
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
