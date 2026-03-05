import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState } from '@hop/engine';
import { SynapseThreadOverlay } from '../components/game-board/SynapseThreadOverlay';

describe('synapse thread overlay', () => {
  it('highlights only the selected tile', () => {
    const gameState = generateInitialState(1, 'synapse-thread-overlay-seed');
    const playerTile = gameState.player.position;
    const fallbackTile = {
      q: playerTile.q + 1,
      r: playerTile.r - 1,
      s: playerTile.s
    };
    const targetTile = gameState.enemies[0]?.position ?? fallbackTile;

    const html = renderToStaticMarkup(
      <svg>
        <SynapseThreadOverlay
          enabled={true}
          gameState={gameState}
          selection={{ mode: 'tile', tile: targetTile }}
        />
      </svg>
    );

    const highlights = html.match(/data-synapse-thread=\"(active|player)\"/g) || [];
    expect(highlights).toHaveLength(1);
    expect(html).toContain('data-synapse-thread="active"');
    expect(html).not.toContain('data-synapse-thread="player"');
  });

  it('does not duplicate overlay when selected actor is player', () => {
    const gameState = generateInitialState(1, 'synapse-thread-overlay-player-seed');

    const html = renderToStaticMarkup(
      <svg>
        <SynapseThreadOverlay
          enabled={true}
          gameState={gameState}
          selection={{ mode: 'entity', actorId: gameState.player.id }}
        />
      </svg>
    );

    const highlights = html.match(/data-synapse-thread=\"(active|player)\"/g) || [];
    expect(highlights).toHaveLength(1);
    expect(html).toContain('data-synapse-thread="active"');
    expect(html).not.toContain('data-synapse-thread="player"');
  });
});
