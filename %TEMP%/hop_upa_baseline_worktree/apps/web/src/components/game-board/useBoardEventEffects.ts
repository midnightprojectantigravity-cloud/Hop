import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { hexToPixel, TILE_SIZE, type GameState, type Point, type SimulationEvent } from '@hop/engine';

type BoardDecal = { id: string; position: Point; href: string; createdAt: number };

type PoseTransformFrame = {
    offsetX: number;
    offsetY: number;
    scaleX: number;
    scaleY: number;
};

type EntityPoseEffect = {
    id: string;
    actorId: string;
    startTime: number;
    endTime: number;
    easing: 'out' | 'inOut';
    from: PoseTransformFrame;
    to: PoseTransformFrame;
};

interface UseBoardEventEffectsArgs {
    gameState: GameState;
    deathDecalHref?: string;
    decals: BoardDecal[];
    setDecals: Dispatch<SetStateAction<BoardDecal[]>>;
    setEntityPoseEffects: Dispatch<SetStateAction<EntityPoseEffect[]>>;
    setEntityPoseNowMs: Dispatch<SetStateAction<number>>;
    onSimulationEvents?: (events: SimulationEvent[]) => void;
}

export const useBoardEventEffects = ({
    gameState,
    deathDecalHref,
    decals,
    setDecals,
    setEntityPoseEffects,
    setEntityPoseNowMs,
    onSimulationEvents,
}: UseBoardEventEffectsArgs) => {
    const processedTimelineDecalBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedVisualDecalBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedSimulationEventCountRef = useRef(0);
    const processedSimulationPoseCountRef = useRef(0);

    const resolveEventPoint = useCallback((payload: any): Point | null => {
        if (!payload) return null;
        const p = payload.position || payload.destination || payload.origin || payload.target;
        if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') return p;
        return null;
    }, []);

    useEffect(() => {
        if (!deathDecalHref) return;
        const timelineEvents = gameState.timelineEvents || [];
        const visualEvents = gameState.visualEvents || [];

        if (processedTimelineDecalBatchRef.current === timelineEvents
            && processedVisualDecalBatchRef.current === visualEvents) {
            return;
        }
        const newTimeline = processedTimelineDecalBatchRef.current === timelineEvents ? [] : timelineEvents;
        processedTimelineDecalBatchRef.current = timelineEvents;

        const newVisual = processedVisualDecalBatchRef.current === visualEvents ? [] : visualEvents;
        processedVisualDecalBatchRef.current = visualEvents;

        const additions: BoardDecal[] = [];
        const now = Date.now();

        for (const ev of newTimeline) {
            if (ev.phase !== 'DEATH_RESOLVE') continue;
            const p = resolveEventPoint(ev.payload);
            if (!p) continue;
            additions.push({
                id: `decal-tl-${ev.id}-${now}-${additions.length}`,
                position: p,
                href: deathDecalHref,
                createdAt: now
            });
        }

        for (const ev of newVisual) {
            if (ev.type !== 'vfx') continue;
            const vfxType = ev.payload?.type;
            if (vfxType !== 'vaporize' && vfxType !== 'explosion_ring') continue;
            const p = resolveEventPoint(ev.payload);
            if (!p) continue;
            additions.push({
                id: `decal-vx-${vfxType}-${now}-${additions.length}`,
                position: p,
                href: deathDecalHref,
                createdAt: now
            });
        }

        if (additions.length > 0) {
            setDecals(prev => [...prev, ...additions].slice(-80));
        }
    }, [gameState.timelineEvents, gameState.visualEvents, deathDecalHref, resolveEventPoint, setDecals]);

    useEffect(() => {
        const events = gameState.simulationEvents || [];
        if (events.length < processedSimulationEventCountRef.current) {
            processedSimulationEventCountRef.current = 0;
        }
        const newEvents = events.slice(processedSimulationEventCountRef.current);
        processedSimulationEventCountRef.current = events.length;
        if (newEvents.length > 0) {
            onSimulationEvents?.(newEvents);
        }
    }, [gameState.simulationEvents, onSimulationEvents]);

    useEffect(() => {
        const events = gameState.simulationEvents || [];
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
            setEntityPoseNowMs(now);
            setEntityPoseEffects(prev => [...prev, ...additions]);
        }
    }, [
        gameState.simulationEvents,
        gameState.player,
        gameState.enemies,
        gameState.companions,
        gameState.dyingEntities,
        setEntityPoseEffects,
        setEntityPoseNowMs
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
        setEntityPoseEffects([]);
        setEntityPoseNowMs(0);
        processedTimelineDecalBatchRef.current = null;
        processedVisualDecalBatchRef.current = null;
        processedSimulationEventCountRef.current = 0;
        processedSimulationPoseCountRef.current = 0;
    }, [setDecals, setEntityPoseEffects, setEntityPoseNowMs]);

    return { resetBoardEventEffects };
};
