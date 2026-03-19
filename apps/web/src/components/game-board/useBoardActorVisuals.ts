import { useEffect, useMemo } from 'react';
import type { GameState, Point, StateMirrorSnapshot } from '@hop/engine';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveUnitAssetId, resolveUnitFallbackAssetHref } from '../../visual/asset-selectors';

type JuiceActorSnapshot = {
    id: string;
    position: Point;
    subtype?: string;
    assetHref?: string;
    fallbackAssetHref?: string;
};

interface UseBoardActorVisualsArgs {
    gameState: GameState;
    assetById: Map<string, VisualAssetEntry>;
    onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
}

export const useBoardActorVisuals = ({
    gameState,
    assetById,
    onMirrorSnapshot,
}: UseBoardActorVisualsArgs) => {
    const actorPositionById = useMemo(() => {
        const out = new Map<string, Point>();
        out.set(gameState.player.id, gameState.player.position);
        for (const e of gameState.enemies) out.set(e.id, e.position);
        for (const e of gameState.companions || []) out.set(e.id, e.position);
        for (const e of gameState.dyingEntities || []) out.set(e.id, e.position);
        return out;
    }, [gameState.player.id, gameState.player.position, gameState.enemies, gameState.companions, gameState.dyingEntities]);

    const juiceActorSnapshots = useMemo<JuiceActorSnapshot[]>(() => ([
        {
            id: gameState.player.id,
            position: gameState.player.position,
            subtype: gameState.player.subtype || 'player',
            assetHref: assetById.get(resolveUnitAssetId(gameState.player))?.path,
            fallbackAssetHref: resolveUnitFallbackAssetHref(gameState.player)
        },
        ...gameState.enemies.map(e => ({
            id: e.id,
            position: e.position,
            subtype: e.subtype,
            assetHref: assetById.get(resolveUnitAssetId(e))?.path,
            fallbackAssetHref: resolveUnitFallbackAssetHref(e)
        })),
        ...(gameState.companions || []).map(e => ({
            id: e.id,
            position: e.position,
            subtype: e.subtype,
            assetHref: assetById.get(resolveUnitAssetId(e))?.path,
            fallbackAssetHref: resolveUnitFallbackAssetHref(e)
        })),
        ...(gameState.dyingEntities || []).map(e => ({
            id: e.id,
            position: e.position,
            subtype: e.subtype,
            assetHref: assetById.get(resolveUnitAssetId(e))?.path,
            fallbackAssetHref: resolveUnitFallbackAssetHref(e)
        }))
    ]), [assetById, gameState.player, gameState.enemies, gameState.companions, gameState.dyingEntities]);

    useEffect(() => {
        if (!onMirrorSnapshot) return;
        const snapshot: StateMirrorSnapshot = {
            floor: gameState.floor || 0,
            turn: gameState.turnNumber || 0,
            stackTick: gameState.stackTrace?.length || 0,
            frame: gameState.commandLog?.length || 0,
            actors: [...actorPositionById.entries()].map(([id, position]) => ({
                id,
                position: { q: position.q, r: position.r, s: position.s }
            }))
        };
        onMirrorSnapshot(snapshot);
    }, [onMirrorSnapshot, gameState.turnNumber, gameState.stackTrace, actorPositionById]);

    return {
        actorPositionById,
        juiceActorSnapshots,
    };
};
