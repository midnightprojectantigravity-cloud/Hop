import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState, type SynapseThreatPreview } from '@hop/engine';
import { SynapseUnitScoreLayer } from '../components/game-board/SynapseUnitScoreLayer';

describe('synapse unit score layer', () => {
  it('renders UPS chips and only shows delta marker above threshold', () => {
    const gameState = generateInitialState(1, 'synapse-chip-seed');
    const enemy = gameState.enemies[0] || {
      ...gameState.player,
      id: 'enemy-1',
      type: 'enemy' as const,
      factionId: 'enemy'
    };
    const preview: SynapseThreatPreview = {
      sourceTurn: gameState.turnNumber,
      playerScore: 48,
      sigmaRef: 8,
      unitScores: [
        {
          actorId: gameState.player.id,
          factionId: gameState.player.factionId,
          isHostileToPlayer: false,
          ups: 4800,
          statScore: 0,
          skillScore: 0,
          stateScore: 20,
          zScore: 0,
          sigmaTier: 'elevated'
        },
        {
          actorId: enemy.id,
          factionId: enemy.factionId,
          isHostileToPlayer: true,
          ups: 5550,
          statScore: 0,
          skillScore: 0,
          stateScore: 18,
          zScore: 1.1,
          sigmaTier: 'high'
        }
      ],
      sources: [],
      tiles: [],
      bandThresholds: {
        contestedHighMin: 1,
        deadlyMin: 2,
        deadZoneZMin: 0.25
      }
    };

    const html = renderToStaticMarkup(
      <svg>
        <SynapseUnitScoreLayer
          enabled={true}
          gameState={gameState}
          preview={preview}
          deltasByActorId={{
            [gameState.player.id]: { upsDelta: 1, stateDelta: 0 },
            [enemy.id]: { upsDelta: 80, stateDelta: 0 }
          }}
        />
      </svg>
    );

    expect(html).toContain(`data-synapse-chip=\"${gameState.player.id}\"`);
    expect(html).toContain(`data-synapse-chip=\"${enemy.id}\"`);
    const markers = html.match(/data-synapse-delta=\"up\"/g) || [];
    expect(markers).toHaveLength(1);
  });
});
