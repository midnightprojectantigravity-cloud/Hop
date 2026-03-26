import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createHex, generateInitialState, pointToKey } from '@hop/engine';
import { RoutePathLayer } from '../components/game-board/RoutePathLayer';

const buildRouteState = () => generateInitialState(8, 'golden-escape-a:8', 'golden-escape-a');
const buildDebugRouteState = () => generateInitialState(5, 'golden-watch-1:5', 'golden-watch-1');

const withVisibility = (
  state: ReturnType<typeof generateInitialState>,
  exploredTileKeys: string[],
  visibleTileKeys: string[]
) => ({
  ...state,
  visibility: {
    ...state.visibility!,
    playerFog: {
      ...state.visibility!.playerFog,
      exploredTileKeys,
      visibleTileKeys
    }
  }
});

describe('RoutePathLayer', () => {
  it('renders nothing for unexplored route tiles', () => {
    const state = buildRouteState();
    const html = renderToStaticMarkup(
      <svg>
        <RoutePathLayer
          gameState={{
            ...withVisibility(state, [], []),
            worldgenDebug: undefined
          }}
        />
      </svg>
    );

    expect(html).not.toContain('data-route-tile=');
    expect(html).not.toContain('data-route-edge=');
  });

  it('renders dim explored tiles and bright visible tiles for the visual route', () => {
    const state = buildRouteState();
    const path = state.generatedPaths!;
    const htmlExplored = renderToStaticMarkup(
      <svg>
        <RoutePathLayer
          gameState={{
            ...withVisibility(state, [...path.visualTileKeys], []),
            worldgenDebug: undefined
          }}
        />
      </svg>
    );
    const htmlVisible = renderToStaticMarkup(
      <svg>
        <RoutePathLayer
          gameState={{
            ...withVisibility(state, [...path.visualTileKeys], [...path.visualTileKeys]),
            worldgenDebug: undefined
          }}
        />
      </svg>
    );

    expect(htmlExplored).toContain('data-route-tile="explored"');
    expect(htmlExplored).toContain('data-route-edge="explored"');
    expect(htmlVisible).toContain('data-route-tile="visible"');
    expect(htmlVisible).toContain('data-route-edge="visible"');
    expect(htmlVisible).toContain('data-route-landmark="main"');
  });

  it('keeps tactical spurs out of the player route layer unless debug overlay is enabled', () => {
    const state = buildDebugRouteState();
    const allKnownTiles = Array.from(new Set([
      ...state.generatedPaths!.tacticalTileKeys,
      ...state.generatedPaths!.visualTileKeys
    ]));

    const playerHtml = renderToStaticMarkup(
      <svg>
        <RoutePathLayer
          gameState={{
            ...withVisibility(state, allKnownTiles, [...state.generatedPaths!.visualTileKeys]),
            worldgenDebug: undefined
          }}
        />
      </svg>
    );

    const debugHtml = renderToStaticMarkup(
      <svg>
        <RoutePathLayer
          gameState={{
            ...withVisibility(state, allKnownTiles, allKnownTiles),
            worldgenDebug: (state.worldgenDebug || {}) as any
          }}
        />
      </svg>
    );

    expect(playerHtml).not.toContain('data-route-edge="tactical-spur"');
    expect(debugHtml).toContain('data-route-edge="tactical-spur"');
    expect(debugHtml).toContain('data-route-landmark="hidden"');
  });

  it('keeps rendering the generated route even if live tiles later become hazardous', () => {
    const state = generateInitialState(1, 'route-display-reroute');
    const entry = createHex(4, 4);
    const middle = createHex(5, 4);
    const exit = createHex(6, 4);
    const detourA = createHex(5, 3);
    const detourB = createHex(6, 3);
    const blockedLower = createHex(5, 5);
    const blockedFarLower = createHex(6, 5);

    const tile = (point: ReturnType<typeof createHex>, baseId: 'STONE' | 'WALL' | 'LAVA', traits: string[]) => ({
      position: point,
      baseId,
      traits: new Set(traits),
      effects: []
    } as any);

    const nextState = {
      ...state,
      tiles: new Map(state.tiles),
      generatedPaths: {
        landmarks: [
          { id: 'entry', kind: 'start', point: entry, onPath: true, routeMembership: 'shared', reachable: true, orderHint: 0 },
          { id: 'exit', kind: 'exit', point: exit, onPath: true, routeMembership: 'shared', reachable: true, orderHint: 100 }
        ],
        tacticalTileKeys: [pointToKey(entry), pointToKey(middle), pointToKey(exit)],
        tacticalEdges: [
          { fromKey: pointToKey(entry), toKey: pointToKey(middle) },
          { fromKey: pointToKey(exit), toKey: pointToKey(middle) }
        ],
        visualTileKeys: [pointToKey(entry), pointToKey(middle), pointToKey(exit)],
        visualEdges: [
          { fromKey: pointToKey(entry), toKey: pointToKey(middle) },
          { fromKey: pointToKey(exit), toKey: pointToKey(middle) }
        ],
        segments: [
          {
            id: 'primary:entry->exit',
            fromLandmarkId: 'entry',
            toLandmarkId: 'exit',
            tileKeys: [pointToKey(entry), pointToKey(middle), pointToKey(exit)],
            edges: [
              { fromKey: pointToKey(entry), toKey: pointToKey(middle) },
              { fromKey: pointToKey(exit), toKey: pointToKey(middle) }
            ],
            kind: 'primary',
            routeMembership: 'primary'
          }
        ],
        routeCount: 1,
        junctionTileKeys: [],
        maxStraightRun: 3,
        environmentalPressureClusters: []
      },
      visibility: {
        ...state.visibility!,
        playerFog: {
          ...state.visibility!.playerFog,
          exploredTileKeys: [
            pointToKey(entry),
            pointToKey(middle),
            pointToKey(exit),
            pointToKey(detourA),
            pointToKey(detourB)
          ],
          visibleTileKeys: [
            pointToKey(entry),
            pointToKey(middle),
            pointToKey(exit),
            pointToKey(detourA),
            pointToKey(detourB)
          ]
        }
      }
    };

    nextState.tiles.set(pointToKey(entry), tile(entry, 'STONE', ['WALKABLE']));
    nextState.tiles.set(pointToKey(middle), tile(middle, 'LAVA', ['HAZARDOUS', 'LAVA', 'LIQUID']));
    nextState.tiles.set(pointToKey(exit), tile(exit, 'STONE', ['WALKABLE']));
    nextState.tiles.set(pointToKey(detourA), tile(detourA, 'STONE', ['WALKABLE']));
    nextState.tiles.set(pointToKey(detourB), tile(detourB, 'STONE', ['WALKABLE']));
    nextState.tiles.set(pointToKey(blockedLower), tile(blockedLower, 'WALL', ['BLOCKS_MOVEMENT', 'BLOCKS_LOS', 'ANCHOR']));
    nextState.tiles.set(pointToKey(blockedFarLower), tile(blockedFarLower, 'WALL', ['BLOCKS_MOVEMENT', 'BLOCKS_LOS', 'ANCHOR']));

    const html = renderToStaticMarkup(
      <svg>
        <RoutePathLayer gameState={nextState as any} />
      </svg>
    );

    expect(html).toContain(`data-route-key="${pointToKey(middle)}"`);
    expect(html).not.toContain(`data-route-key="${pointToKey(detourA)}"`);
    expect(html).not.toContain(`data-route-key="${pointToKey(detourB)}"`);
  });

  it('suppresses alternate lanes that barely diverge from the primary route', () => {
    const state = generateInitialState(1, 'route-display-meaningful-branch');
    const entry = createHex(4, 4);
    const primaryA = createHex(5, 4);
    const primaryB = createHex(6, 4);
    const primaryC = createHex(7, 4);
    const alternateA = createHex(5, 3);
    const exit = createHex(7, 4);

    const nextState = {
      ...state,
      generatedPaths: {
        landmarks: [
          { id: 'entry', kind: 'start', point: entry, onPath: true, routeMembership: 'shared', reachable: true, orderHint: 0 },
          { id: 'exit', kind: 'exit', point: exit, onPath: true, routeMembership: 'shared', reachable: true, orderHint: 100 }
        ],
        tacticalTileKeys: [
          pointToKey(entry),
          pointToKey(primaryA),
          pointToKey(primaryB),
          pointToKey(primaryC),
          pointToKey(alternateA)
        ],
        tacticalEdges: [],
        visualTileKeys: [
          pointToKey(entry),
          pointToKey(primaryA),
          pointToKey(primaryB),
          pointToKey(primaryC),
          pointToKey(alternateA)
        ],
        visualEdges: [],
        segments: [
          {
            id: 'primary:entry->exit',
            fromLandmarkId: 'entry',
            toLandmarkId: 'exit',
            tileKeys: [pointToKey(entry), pointToKey(primaryA), pointToKey(primaryB), pointToKey(primaryC)],
            edges: [],
            kind: 'primary',
            routeMembership: 'primary'
          },
          {
            id: 'alternate:entry->exit',
            fromLandmarkId: 'entry',
            toLandmarkId: 'exit',
            tileKeys: [pointToKey(entry), pointToKey(alternateA), pointToKey(primaryB), pointToKey(primaryC)],
            edges: [],
            kind: 'alternate',
            routeMembership: 'alternate'
          }
        ],
        routeCount: 2,
        junctionTileKeys: [pointToKey(entry), pointToKey(primaryB)],
        maxStraightRun: 3,
        environmentalPressureClusters: []
      },
      visibility: {
        ...state.visibility!,
        playerFog: {
          ...state.visibility!.playerFog,
          exploredTileKeys: [
            pointToKey(entry),
            pointToKey(primaryA),
            pointToKey(primaryB),
            pointToKey(primaryC),
            pointToKey(alternateA)
          ],
          visibleTileKeys: [
            pointToKey(entry),
            pointToKey(primaryA),
            pointToKey(primaryB),
            pointToKey(primaryC),
            pointToKey(alternateA)
          ]
        }
      }
    };

    const html = renderToStaticMarkup(
      <svg>
        <RoutePathLayer gameState={nextState as any} />
      </svg>
    );

    expect(html).not.toContain(`data-route-key="${pointToKey(alternateA)}"`);
    expect(html).toContain(`data-route-key="${pointToKey(primaryA)}"`);
  });
});
