import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { hexToPixel, TILE_SIZE, type GameState, type Point, type SimulationEvent } from '@hop/engine';
import type { BoardEventDigest } from './board-event-digest';
import type { EntityPoseEffect } from './board-juice-presentation-types';

type BoardDecal = { id: string; position: Point; href: string; createdAt: number };

type PoseTransformFrame = EntityPoseEffect['from'];

interface UseBoardEventEffectsArgs {
    gameState: GameState;
    boardEventDigest: BoardEventDigest;
    deathDecalHref?: string;
    decals: BoardDecal[];
    setDecals: Dispatch<SetStateAction<BoardDecal[]>>;
    enqueueEntityPoseEffects: (effects: ReadonlyArray<EntityPoseEffect>) => void;
    onSimulationEvents?: (events: SimulationEvent[]) => void;
}

export const useBoardEventEffects = ({
    gameState,
    boardEventDigest,
    deathDecalHref,
    decals,
    setDecals,
    enqueueEntityPoseEffects,
    onSimulationEvents,
}: UseBoardEventEffectsArgs) => {
    const processedTimelineDecalCountRef = useRef(0);
    const processedVisualDecalCountRef = useRef(0);
    const processedSimulationEventCountRef = useRef(0);
    const processedSimulationPoseCountRef = useRef(0);

    useEffect(() => {
        if (!deathDecalHref) return;
        const timelineEvents = boardEventDigest.timelineDeathEvents;
        const visualEvents = boardEventDigest.deathDecalVisualEvents;
        if (timelineEvents.length < processedTimelineDecalCountRef.current) {
            processedTimelineDecalCountRef.current = 0;
        }
        if (visualEvents.length < processedVisualDecalCountRef.current) {
            processedVisualDecalCountRef.current = 0;
        }
        const newTimeline = timelineEvents.slice(processedTimelineDecalCountRef.current);
        const newVisual = visualEvents.slice(processedVisualDecalCountRef.current);
        processedTimelineDecalCountRef.current = timelineEvents.length;
        processedVisualDecalCountRef.current = visualEvents.length;
        if (newTimeline.length === 0 && newVisual.length === 0) return;

        const additions: BoardDecal[] = [];
        const now = Date.now();

        for (const ev of newTimeline) {
            additions.push({
                id: `decal-tl-${ev.id}-${now}-${additions.length}`,
                position: ev.position,
                href: deathDecalHref,
                createdAt: now
            });
        }

        for (const ev of newVisual) {
            additions.push({
                id: `decal-vx-${ev.id}-${now}-${additions.length}`,
                position: ev.position,
                href: deathDecalHref,
                createdAt: now
            });
        }

        if (additions.length > 0) {
            setDecals(prev => [...prev, ...additions].slice(-80));
        }
    }, [boardEventDigest.deathDecalVisualEvents, boardEventDigest.timelineDeathEvents, deathDecalHref, setDecals]);

    useEffect(() => {
        const events = boardEventDigest.simulationEventsRef;
        if (events.length < processedSimulationEventCountRef.current) {
            processedSimulationEventCountRef.current = 0;
        }
        const newEvents = events.slice(processedSimulationEventCountRef.current);
        processedSimulationEventCountRef.current = events.length;
        if (newEvents.length > 0) {
            onSimulationEvents?.(newEvents);
        }
    }, [boardEventDigest.simulationEventsRef, onSimulationEvents]);

    useEffect(() => {
        const events = boardEventDigest.simulationPoseEvents;
        if (events.length < processedSimulationPoseCountRef.current) {
            processedSimulationPoseCountRef.current = 0;
        }
        const newEvents = events.slice(processedSimulationPoseCountRef.current);
        processedSimulationPoseCountRef.current = events.length;
        if (newEvents.length === 0) return;

        const now = Date.now();
        const actors = [
            gameState.player,
            ...gameState.enemies,
            ...(gameState.companions || []),
            ...(gameState.dyingEntities || [])
        ];
        const actorByIdLocal = new Map(actors.map(a => [a.id, a]));
        const additions: EntityPoseEffect[] = [];

        const pushPose = (
            actorId: string | undefined,
            tag: string,
            from: PoseTransformFrame,
            to: PoseTransformFrame,
            startTime: number,
            durationMs: number
        ) => {
            if (!actorId) return;
            additions.push({
                id: `${tag}:${actorId}:${startTime}`,
                actorId,
                startTime,
                endTime: startTime + Math.max(35, durationMs),
                easing: 'out',
                from,
                to
            });
        };

        for (const ev of newEvents) {
            if (ev.type === 'RestTriggered') {
                const actorId = String(ev.actorId || ev.targetId || '');
                if (!actorId) continue;
                pushPose(
                    actorId,
                    'rest-cool',
                    { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                    { offsetX: 0, offsetY: -6, scaleX: 0.98, scaleY: 1.03 },
                    now,
                    160
                );
                pushPose(
                    actorId,
                    'rest-cool-return',
                    { offsetX: 0, offsetY: -2, scaleX: 0.99, scaleY: 1.02 },
                    { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                    now + 120,
                    220
                );
                continue;
            }

            if (ev.type !== 'DamageTaken') continue;
            const targetId = String(ev.targetId || '');
            const targetActor = targetId ? actorByIdLocal.get(targetId) : undefined;
            if (!targetActor) continue;

            const payload = ev.payload || {};
            const reason = String(payload.reason || '').toLowerCase();
            const sourceId = String(payload.sourceId || '');
            if (!sourceId || !reason || reason.includes('basic_attack')) continue;

            const sourceActor = actorByIdLocal.get(sourceId);
            const isProjectileLike = reason.includes('spear')
                || reason.includes('multi_shoot')
                || reason.includes('withdrawal')
                || (sourceActor?.subtype === 'archer' && !reason.includes('crush'));
            if (!isProjectileLike) continue;

            const srcPix = sourceActor ? hexToPixel(sourceActor.position, TILE_SIZE) : undefined;
            const tgtPix = hexToPixel(targetActor.position, TILE_SIZE);
            let ux = 0;
            let uy = 1;
            if (srcPix) {
                const dx = tgtPix.x - srcPix.x;
                const dy = tgtPix.y - srcPix.y;
                const mag = Math.hypot(dx, dy);
                if (mag > 0.001) {
                    ux = dx / mag;
                    uy = dy / mag;
                }
            }

            const flinch = sourceActor?.subtype === 'archer' ? 10 : 8;
            const dur = 100;
            pushPose(
                targetActor.id,
                'projectile-hit',
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                { offsetX: ux * flinch, offsetY: uy * flinch, scaleX: 1.02, scaleY: 0.95 },
                now,
                dur
            );
            pushPose(
                targetActor.id,
                'projectile-hit-return',
                { offsetX: ux * (flinch * 0.35), offsetY: uy * (flinch * 0.35), scaleX: 1.01, scaleY: 0.99 },
                { offsetX: 0, offsetY: 0, scaleX: 1, scaleY: 1 },
                now + Math.floor(dur * 0.5),
                130
            );
        }

        if (additions.length > 0) {
            enqueueEntityPoseEffects(additions);
        }
    }, [
        boardEventDigest.simulationPoseEvents,
        enqueueEntityPoseEffects,
        gameState.player,
        gameState.enemies,
        gameState.companions,
        gameState.dyingEntities,
    ]);

    useEffect(() => {
        if (decals.length === 0) return;
        const ttlMs = 12_000;
        const timer = window.setTimeout(() => {
            const now = Date.now();
            setDecals(prev => prev.filter(d => now - d.createdAt < ttlMs));
        }, 1000);
        return () => window.clearTimeout(timer);
    }, [decals, setDecals]);

    const resetBoardEventEffects = useCallback(() => {
        setDecals([]);
        processedTimelineDecalCountRef.current = 0;
        processedVisualDecalCountRef.current = 0;
        processedSimulationEventCountRef.current = 0;
        processedSimulationPoseCountRef.current = 0;
    }, [setDecals]);

    return { resetBoardEventEffects };
};
