import React from 'react';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { GameState } from '@hop/engine';
import { Entity, type EntityVisualPose } from '../Entity';
import { JuiceManager } from '../JuiceManager';
import type { VisualAssetEntry, VisualAssetManifest } from '../../visual/asset-manifest';
import { resolveUnitAssetId, resolveUnitFallbackAssetHref } from '../../visual/asset-selectors';
import type { SynapsePulse } from '../../app/synapse';

type JuiceActorSnapshot = {
    id: string;
    position: any;
    subtype?: string;
    assetHref?: string;
    fallbackAssetHref?: string;
};

interface EntityLayerProps {
    gameState: GameState;
    entityVisualPoseById: Map<string, EntityVisualPose>;
    assetById: Map<string, VisualAssetEntry>;
    biomeThemeKey: string;
    juiceActorSnapshots: JuiceActorSnapshot[];
    assetManifest?: VisualAssetManifest | null;
    onJuiceBusyStateChange: (busy: boolean) => void;
    isSynapseMode: boolean;
    synapsePulse: SynapsePulse;
    onSynapseInspectEntity: (actorId: string) => void;
}

export const EntityLayer: React.FC<EntityLayerProps> = ({
    gameState,
    entityVisualPoseById,
    assetById,
    biomeThemeKey,
    juiceActorSnapshots,
    assetManifest,
    onJuiceBusyStateChange,
    isSynapseMode,
    synapsePulse,
    onSynapseInspectEntity,
}) => {
    const visibleActorIds = new Set(gameState.visibility?.playerFog?.visibleActorIds || []);
    const detectedActorIds = new Set(gameState.visibility?.playerFog?.detectedActorIds || []);
    const hasFogVisibility = !!gameState.visibility;
    const renderedEnemies = hasFogVisibility
        ? gameState.enemies.filter(enemy => visibleActorIds.has(enemy.id))
        : gameState.enemies;
    const detectedOnlyEnemies = hasFogVisibility
        ? gameState.enemies.filter(enemy => !visibleActorIds.has(enemy.id) && detectedActorIds.has(enemy.id))
        : [];

    return (
        <g>
            {gameState.lastSpearPath && gameState.lastSpearPath.length >= 2 && (() => {
                const pathPoints = gameState.lastSpearPath.map(p => hexToPixel(p, TILE_SIZE));
                const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                return <path d={d} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" strokeDasharray="4 2" strokeLinecap="round" />;
            })()}

            {gameState.spearPosition && (
                <Entity entity={{
                    id: 'spear',
                    type: 'player',
                    subtype: 'footman',
                    position: gameState.spearPosition,
                    hp: 1, maxHp: 1,
                    statusEffects: [],
                    temporaryArmor: 0,
                    activeSkills: [],
                    speed: 0,
                    factionId: 'player'
                } as any} isSpear={true} />
            )}

            <Entity
                key={`player-${gameState.floor}`}
                entity={gameState.player}
                visualPose={entityVisualPoseById.get(gameState.player.id)}
                assetHref={assetById.get(resolveUnitAssetId(gameState.player))?.path}
                fallbackAssetHref={resolveUnitFallbackAssetHref(gameState.player)}
                floorTheme={biomeThemeKey}
                synapseMode={isSynapseMode}
                onSynapseInspect={onSynapseInspectEntity}
                synapsePulseToken={synapsePulse?.actorId === gameState.player.id ? synapsePulse.token : undefined}
            />
            {renderedEnemies.map(e => (
                <Entity
                    key={`${e.id}-${gameState.floor}`}
                    entity={e}
                    visualPose={entityVisualPoseById.get(e.id)}
                    assetHref={assetById.get(resolveUnitAssetId(e))?.path}
                    fallbackAssetHref={resolveUnitFallbackAssetHref(e)}
                    floorTheme={biomeThemeKey}
                    synapseMode={isSynapseMode}
                    onSynapseInspect={onSynapseInspectEntity}
                    synapsePulseToken={synapsePulse?.actorId === e.id ? synapsePulse.token : undefined}
                />
            ))}
            {detectedOnlyEnemies.map(enemy => {
                const { x, y } = hexToPixel(enemy.position, TILE_SIZE);
                return (
                    <g key={`detected-only-${enemy.id}-${gameState.floor}`} pointerEvents="none">
                        <circle cx={x} cy={y} r={TILE_SIZE * 0.18} fill="rgba(24, 196, 255, 0.45)" />
                        <circle cx={x} cy={y} r={TILE_SIZE * 0.08} fill="rgba(130, 239, 255, 0.9)" />
                    </g>
                );
            })}
            {gameState.dyingEntities?.map(e => (
                <Entity
                    key={`dying-${e.id}-${gameState.floor}-${gameState.turnNumber}`}
                    entity={e}
                    isDying={true}
                    visualPose={entityVisualPoseById.get(e.id)}
                    assetHref={assetById.get(resolveUnitAssetId(e))?.path}
                    fallbackAssetHref={resolveUnitFallbackAssetHref(e)}
                    floorTheme={biomeThemeKey}
                />
            ))}

            <JuiceManager
                key={`juice-${gameState.floor}`}
                visualEvents={gameState.visualEvents || []}
                timelineEvents={gameState.timelineEvents || []}
                simulationEvents={gameState.simulationEvents || []}
                actorSnapshots={juiceActorSnapshots}
                onBusyStateChange={onJuiceBusyStateChange}
                assetManifest={assetManifest}
            />
        </g>
    );
};
