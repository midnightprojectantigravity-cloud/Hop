import React from 'react';
import { hexToPixel, TILE_SIZE, type Actor, type Point } from '@hop/engine';
import { Entity, type EntityVisualPose } from '../Entity';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveUnitAssetId, resolveUnitFallbackAssetHref } from '../../visual/asset-selectors';
import type { SynapsePulse } from '../../app/synapse';
import type { RegisterActorNodes } from './actor-node-registry';

interface EntityLayerProps {
  player: Actor;
  playerDefeated: boolean;
  renderedEnemies: Actor[];
  detectedOnlyEnemies: Actor[];
  dyingEntities: Actor[];
  lastSpearPath?: Point[];
  spearPosition?: Point;
  floor: number;
  turnNumber: number;
  entityVisualPoseById: Map<string, EntityVisualPose>;
  assetById: Map<string, VisualAssetEntry>;
  biomeThemeKey: string;
  isSynapseMode: boolean;
  synapsePulse: SynapsePulse;
  onSynapseInspectEntity: (actorId: string) => void;
  registerActorNodes?: RegisterActorNodes;
}

const EntityLayerBase: React.FC<EntityLayerProps> = ({
  player,
  playerDefeated,
  renderedEnemies,
  detectedOnlyEnemies,
  dyingEntities,
  lastSpearPath,
  spearPosition,
  floor,
  turnNumber,
  entityVisualPoseById,
  assetById,
  biomeThemeKey,
  isSynapseMode,
  synapsePulse,
  onSynapseInspectEntity,
  registerActorNodes,
}) => {
  return (
    <g>
      {lastSpearPath && lastSpearPath.length >= 2 && (() => {
        const pathPoints = lastSpearPath.map(p => hexToPixel(p, TILE_SIZE));
        const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return <path d={d} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" strokeDasharray="4 2" strokeLinecap="round" />;
      })()}

      {spearPosition && (
        <Entity entity={{
          id: 'spear',
          type: 'player',
          subtype: 'footman',
          position: spearPosition,
          hp: 1,
          maxHp: 1,
          statusEffects: [],
          temporaryArmor: 0,
          activeSkills: [],
          speed: 0,
          factionId: 'player',
        } as any} isSpear={true} />
      )}

      <Entity
        key={`player-${floor}`}
        entity={player}
        isDying={playerDefeated}
        visualPose={entityVisualPoseById.get(player.id)}
        assetHref={assetById.get(resolveUnitAssetId(player))?.path}
        fallbackAssetHref={resolveUnitFallbackAssetHref(player)}
        floorTheme={biomeThemeKey}
        synapseMode={isSynapseMode}
        onSynapseInspect={onSynapseInspectEntity}
        synapsePulseToken={synapsePulse?.actorId === player.id ? synapsePulse.token : undefined}
        registerActorNodes={registerActorNodes}
      />

      {renderedEnemies.map(enemy => (
        <Entity
          key={`${enemy.id}-${floor}`}
          entity={enemy}
          visualPose={entityVisualPoseById.get(enemy.id)}
          assetHref={assetById.get(resolveUnitAssetId(enemy))?.path}
          fallbackAssetHref={resolveUnitFallbackAssetHref(enemy)}
          floorTheme={biomeThemeKey}
          synapseMode={isSynapseMode}
          onSynapseInspect={onSynapseInspectEntity}
          synapsePulseToken={synapsePulse?.actorId === enemy.id ? synapsePulse.token : undefined}
          registerActorNodes={registerActorNodes}
        />
      ))}

      {detectedOnlyEnemies.map(enemy => {
        const { x, y } = hexToPixel(enemy.position, TILE_SIZE);
        return (
          <g key={`detected-only-${enemy.id}-${floor}`} pointerEvents="none">
            <circle cx={x} cy={y} r={TILE_SIZE * 0.18} fill="rgba(24, 196, 255, 0.45)" />
            <circle cx={x} cy={y} r={TILE_SIZE * 0.08} fill="rgba(130, 239, 255, 0.9)" />
          </g>
        );
      })}

      {dyingEntities.map(enemy => (
        <Entity
          key={`dying-${enemy.id}-${floor}-${turnNumber}`}
          entity={enemy}
          isDying={true}
          visualPose={entityVisualPoseById.get(enemy.id)}
          assetHref={assetById.get(resolveUnitAssetId(enemy))?.path}
          fallbackAssetHref={resolveUnitFallbackAssetHref(enemy)}
          floorTheme={biomeThemeKey}
          registerActorNodes={registerActorNodes}
        />
      ))}
    </g>
  );
};

export const EntityLayer = React.memo(EntityLayerBase);
