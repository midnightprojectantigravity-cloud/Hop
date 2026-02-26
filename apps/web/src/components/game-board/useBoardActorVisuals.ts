import { useEffect, useMemo } from 'react';
import type { GameState, Point, StateMirrorSnapshot } from '@hop/engine';
import type { EntityVisualPose } from '../Entity';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveUnitAssetId, resolveUnitFallbackAssetHref } from '../../visual/asset-selectors';

type PoseTransformFrame = {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
};

type EntityPoseEffectLike = {
    actorId: string;
    startTime: number;
    endTime: number;
    easing: 'out' | 'inOut';
    from: PoseTransformFrame;
    to: PoseTransformFrame;
};

type JuiceActorSnapshot = {
    id: string;
    position: Point;
    subtype?: string;
    assetHref?: string;
    fallbackAssetHref?: string;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface UseBoardActorVisualsArgs {
    gameState: GameState;
    assetById: Map<string, VisualAssetEntry>;
    entityPoseEffects: ReadonlyArray<EntityPoseEffectLike>;
    entityPoseNowMs: number;
    onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
}

export const useBoardActorVisuals = ({
    gameState,
    assetById,
    entityPoseEffects,
    entityPoseNowMs,
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

    const entityVisualPoseById = useMemo(() => {
        const out = new Map<string, EntityVisualPose>();
        const now = entityPoseNowMs || Date.now();

        for (const effect of entityPoseEffects) {
            if (now < effect.startTime || now > effect.endTime) continue;
            const duration = Math.max(1, effect.endTime - effect.startTime);
            const tRaw = Math.max(0, Math.min(1, (now - effect.startTime) / duration));
            const t = effect.easing === 'inOut' ? easeInOutCubic(tRaw) : easeOutCubic(tRaw);
            const frame: EntityVisualPose = {
                offsetX: lerp(effect.from.offsetX, effect.to.offsetX, t),
                offsetY: lerp(effect.from.offsetY, effect.to.offsetY, t),
                scaleX: lerp(effect.from.scaleX, effect.to.scaleX, t),
                scaleY: lerp(effect.from.scaleY, effect.to.scaleY, t),
            };
            const prev = out.get(effect.actorId);
            if (!prev) {
                out.set(effect.actorId, frame);
                continue;
            }
            out.set(effect.actorId, {
                offsetX: (prev.offsetX ?? 0) + (frame.offsetX ?? 0),
                offsetY: (prev.offsetY ?? 0) + (frame.offsetY ?? 0),
                scaleX: (prev.scaleX ?? 1) * (frame.scaleX ?? 1),
                scaleY: (prev.scaleY ?? 1) * (frame.scaleY ?? 1),
            });
        }

        return out;
    }, [entityPoseEffects, entityPoseNowMs]);

    useEffect(() => {
        if (!onMirrorSnapshot) return;
        const snapshot: StateMirrorSnapshot = {
            turn: gameState.turnNumber || 0,
            stackTick: gameState.stackTrace?.length || 0,
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
        entityVisualPoseById,
    };
};
