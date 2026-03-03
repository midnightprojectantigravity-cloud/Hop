import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateInitialState, type SynapseThreatPreview } from '@hop/engine';
import { SynapseBottomTray } from '../components/synapse/SynapseBottomTray';

describe('synapse bottom tray', () => {
  it('renders tile mode source list with UPS and z-score values', () => {
    const gameState = generateInitialState(1, 'synapse-tray-tile-seed');
    const enemy = gameState.enemies[0] || {
      ...gameState.player,
      id: 'enemy-1',
      type: 'enemy' as const,
      factionId: 'enemy'
    };

    const preview: SynapseThreatPreview = {
      sourceTurn: gameState.turnNumber,
      playerScore: 52,
      sigmaRef: 9,
      unitScores: [
        {
          actorId: gameState.player.id,
          factionId: gameState.player.factionId,
          isHostileToPlayer: false,
          ups: 5200,
          statScore: 0,
          skillScore: 0,
          stateScore: 0,
          zScore: 0,
          sigmaTier: 'elevated'
        },
        {
          actorId: enemy.id,
          factionId: enemy.factionId,
          isHostileToPlayer: true,
          ups: 6420,
          statScore: 0,
          skillScore: 0,
          stateScore: 0,
          zScore: 1.4,
          sigmaTier: 'high'
        }
      ],
      sources: [
        {
          actorId: enemy.id,
          position: enemy.position,
          actionReach: 4,
          ups: 6420,
          zScore: 1.4,
          sigmaTier: 'high',
          emitterWeight: 1.4
        }
      ],
      tiles: [
        {
          tile: gameState.player.position,
          heat: 1.4,
          band: 'contested_high',
          sourceActorIds: [enemy.id]
        }
      ],
      bandThresholds: {
        contestedHighMin: 1,
        deadlyMin: 2,
        deadZoneZMin: 0.25
      }
    };

    const html = renderToStaticMarkup(
      <SynapseBottomTray
        gameState={gameState}
        synapsePreview={preview}
        synapseSelection={{ mode: 'tile', tile: gameState.player.position }}
        intelMode="force_reveal"
        deltasByActorId={{}}
        onSelectSource={() => { }}
        onClearSelection={() => { }}
      />
    );

    expect(html).toContain('Tile Intel');
    expect(html).toContain('Threat Sources');
    expect(html).toContain('UPS 6420');
    expect(html).toContain('z 1.4');
  });

  it('renders entity mode with UPS and delta fields', () => {
    const gameState = generateInitialState(1, 'synapse-tray-entity-seed');
    const actorId = gameState.player.id;

    const preview: SynapseThreatPreview = {
      sourceTurn: gameState.turnNumber,
      playerScore: 50,
      sigmaRef: 6,
      unitScores: [
        {
          actorId,
          factionId: gameState.player.factionId,
          isHostileToPlayer: false,
          ups: 5000,
          statScore: 0,
          skillScore: 0,
          stateScore: 25,
          zScore: 0,
          sigmaTier: 'elevated'
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
      <SynapseBottomTray
        gameState={gameState}
        synapsePreview={preview}
        synapseSelection={{ mode: 'entity', actorId }}
        intelMode="force_reveal"
        deltasByActorId={{ [actorId]: { upsDelta: -70, stateDelta: -10 } }}
        onSelectSource={() => { }}
        onClearSelection={() => { }}
      />
    );

    expect(html).toContain('Entity Intel');
    expect(html).toContain('UPS');
    expect(html).toContain('Sigma');
    expect(html).toContain('UPS D v -70');
    expect(html).toContain('State D v -10');
  });
});
