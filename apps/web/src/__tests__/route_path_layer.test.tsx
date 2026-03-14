import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState } from '@hop/engine';
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
});
