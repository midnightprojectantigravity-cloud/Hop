import React from 'react';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { GameState } from '@hop/engine';
import { Entity, type EntityVisualPose } from '../Entity';
import { JuiceManager } from '../JuiceManager';
import type { VisualAssetEntry, VisualAssetManifest } from '../../visual/asset-manifest';
import { resolveUnitAssetId, resolveUnitFallbackAssetHref } from '../../visual/asset-selectors';

type JuiceActorSnapshot = {
    id: string;
    position: any;
    subtype?: string;
    assetHref?: string;
    fallbackAssetHref?: string;
};

interface EntityLayerProps {
    gameState: GameState;
    latestTraceByActor: Record<string, any>;
    entityVisualPoseById: Map<string, EntityVisualPose>;
    assetById: Map<string, VisualAssetEntry>;
    biomeThemeKey: string;
    juiceActorSnapshots: JuiceActorSnapshot[];
    assetManifest?: VisualAssetManifest | null;
    onJuiceBusyStateChange: (busy: boolean) => void;
}

export const EntityLayer: React.FC<EntityLayerProps> = ({
    gameState,
    latestTraceByActor,
    entityVisualPoseById,
    assetById,
    biomeThemeKey,
    juiceActorSnapshots,
    assetManifest,
    onJuiceBusyStateChange,
}) => {
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
                movementTrace={latestTraceByActor[gameState.player.id]}
                waapiControlled={true}
                visualPose={entityVisualPoseById.get(gameState.player.id)}
                assetHref={assetById.get(resolveUnitAssetId(gameState.player))?.path}
                fallbackAssetHref={resolveUnitFallbackAssetHref(gameState.player)}
                floorTheme={biomeThemeKey}
            />
            {gameState.enemies.map(e => (
                <Entity
                    key={`${e.id}-${gameState.floor}`}
                    entity={e}
                    movementTrace={latestTraceByActor[e.id]}
                    waapiControlled={true}
                    visualPose={entityVisualPoseById.get(e.id)}
                    assetHref={assetById.get(resolveUnitAssetId(e))?.path}
                    fallbackAssetHref={resolveUnitFallbackAssetHref(e)}
                    floorTheme={biomeThemeKey}
                />
            ))}
            {gameState.dyingEntities?.map(e => (
                <Entity
                    key={`dying-${e.id}-${gameState.floor}-${gameState.turnNumber}`}
                    entity={e}
                    isDying={true}
                    movementTrace={latestTraceByActor[e.id]}
                    waapiControlled={true}
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
