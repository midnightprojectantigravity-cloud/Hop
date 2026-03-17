import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineEvent, SimulationEvent } from '@hop/engine';
import type { JuiceEffect, JuiceActorSnapshot } from './juice-types';
import { buildSignatureJuiceEffects } from './signature-effects';
import { buildLegacyVfxEffects, buildSimulationDamageCueEffects } from './event-effect-builders';
import type { BoardEventDigest } from '../game-board/board-event-digest';
import {
    classifyDamageCueType,
    CRITICAL_PLAYER_DEATH_MIN_HOLD_MS,
    getEffectLifetimeMs,
    resolveCriticalPlayerCueHoldUntil,
    waitMs,
} from './juice-manager-utils';
import {
    buildTimelinePhaseEffects,
    MAX_QUEUE_RUNTIME_MS,
    resolveTimelineBaseDuration,
    resolveTimelinePhaseDuration,
    resolveTimelineWaitDuration,
} from './juice-timeline-utils';
import { resolveNextCleanupDelayMs } from './juice-cleanup-utils';

interface UseJuiceManagerEffectsArgs {
    visualEvents: { type: string; payload: any }[];
    timelineEvents: TimelineEvent[];
    simulationEvents: SimulationEvent[];
    boardEventDigest?: BoardEventDigest;
    actorSnapshots: JuiceActorSnapshot[];
    playerActorId: string;
    playerDefeated: boolean;
    onBusyStateChange?: (busy: boolean) => void;
}

export const useJuiceManagerEffects = ({
    visualEvents,
    timelineEvents,
    simulationEvents,
    boardEventDigest,
    actorSnapshots,
    playerActorId,
    playerDefeated,
    onBusyStateChange
}: UseJuiceManagerEffectsArgs): JuiceEffect[] => {
    const [effects, setEffects] = useState<JuiceEffect[]>([]);
    const processedTimelineBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuiceSignatureBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedSimulationCount = useRef(0);
    const timelineQueue = useRef<TimelineEvent[]>([]);
    const isRunningQueue = useRef(false);
    const [timelineBusy, setTimelineBusy] = useState(false);
    const [criticalCueBusy, setCriticalCueBusy] = useState(false);
    const prefersReducedMotion = useRef(false);
    const movementDurationByActor = useRef<Map<string, { durationMs: number; seenAt: number }>>(new Map());
    const cleanupTimerRef = useRef<number | null>(null);
    const criticalCueTimerRef = useRef<number | null>(null);
    const lastEffectTickRef = useRef<number>(Date.now());
    const recentSignatureImpactByTileRef = useRef<Map<string, { at: number; signature: string }>>(new Map());
    const criticalCueHoldUntilRef = useRef(0);
    const lastPlayerDefeatedRef = useRef(false);

    const actorById = useMemo(() => {
        const map = new Map<string, JuiceActorSnapshot>();
        for (const actor of actorSnapshots) {
            map.set(actor.id, actor);
        }
        return map;
    }, [actorSnapshots]);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => { prefersReducedMotion.current = mq.matches; };
        onChange();
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    useEffect(() => {
        const movementTraceEvents = boardEventDigest?.movementTraceEvents || visualEvents;
        if (!movementTraceEvents.length) return;
        const next = new Map(movementDurationByActor.current);
        const now = Date.now();
        for (const ev of movementTraceEvents) {
            if (ev.type !== 'kinetic_trace') continue;
            const trace = ev.payload;
            if (!trace?.actorId) continue;
            const duration = Number(trace.durationMs ?? 0);
            if (duration > 0) {
                next.set(String(trace.actorId), {
                    durationMs: duration,
                    seenAt: now
                });
            }
        }
        movementDurationByActor.current = next;
    }, [boardEventDigest?.movementTraceEvents, visualEvents]);

    useEffect(() => {
        onBusyStateChange?.(timelineBusy || criticalCueBusy);
    }, [criticalCueBusy, timelineBusy, onBusyStateChange]);

    useEffect(() => () => {
        if (criticalCueTimerRef.current !== null) {
            window.clearTimeout(criticalCueTimerRef.current);
            criticalCueTimerRef.current = null;
        }
    }, []);

    const armCriticalCueHold = (holdUntil: number) => {
        if (typeof window === 'undefined' || !Number.isFinite(holdUntil) || holdUntil <= 0) return;

        criticalCueHoldUntilRef.current = Math.max(criticalCueHoldUntilRef.current, holdUntil);
        setCriticalCueBusy(true);

        if (criticalCueTimerRef.current !== null) {
            window.clearTimeout(criticalCueTimerRef.current);
            criticalCueTimerRef.current = null;
        }

        const scheduleRelease = () => {
            const remainingMs = criticalCueHoldUntilRef.current - Date.now();
            if (remainingMs > 16) {
                criticalCueTimerRef.current = window.setTimeout(scheduleRelease, Math.min(remainingMs, 120));
                return;
            }
            criticalCueTimerRef.current = null;
            criticalCueHoldUntilRef.current = 0;
            setCriticalCueBusy(false);
        };

        scheduleRelease();
    };

    const enqueueTimelineEffects = (ev: TimelineEvent) => {
        const now = Date.now();
        const additions = buildTimelinePhaseEffects(ev, now);
        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    };

    useEffect(() => {
        if (!timelineEvents.length) return;
        if (processedTimelineBatchRef.current === timelineEvents) return;
        processedTimelineBatchRef.current = timelineEvents;
        const newEvents = timelineEvents;
        if (!newEvents.length) return;
        timelineQueue.current.push(...newEvents);

        if (isRunningQueue.current) return;
        isRunningQueue.current = true;
        setTimelineBusy(true);

        (async () => {
            try {
                const queueStart = Date.now();
                while (timelineQueue.current.length > 0) {
                    if ((Date.now() - queueStart) > MAX_QUEUE_RUNTIME_MS) {
                        console.warn('[HOP_JUICE] Timeline queue exceeded runtime budget; flushing remaining events.', {
                            queued: timelineQueue.current.length
                        });
                        break;
                    }
                    const ev = timelineQueue.current.shift()!;
                    enqueueTimelineEffects(ev);
                    const now = Date.now();
                    const baseDuration = resolveTimelineBaseDuration(ev, movementDurationByActor.current, now);
                    const phaseDuration = resolveTimelinePhaseDuration(ev, baseDuration);
                    const waitDuration = resolveTimelineWaitDuration(
                        ev,
                        baseDuration,
                        phaseDuration,
                        prefersReducedMotion.current
                    );
                    if (waitDuration > 0) {
                        await waitMs(waitDuration);
                    }
                }
            } catch (err) {
                console.error('[HOP_JUICE] Timeline queue processing failed; releasing busy lock.', err);
            } finally {
                timelineQueue.current = [];
                isRunningQueue.current = false;
                setTimelineBusy(false);
            }
        })();
    }, [timelineEvents]);

    useEffect(() => {
        const signatureBatchRef = boardEventDigest?.visualEventsRef || visualEvents;
        if (processedJuiceSignatureBatchRef.current === signatureBatchRef) return;
        processedJuiceSignatureBatchRef.current = signatureBatchRef;
        const incoming = boardEventDigest?.signatureVisualEvents
            ? Array.from(boardEventDigest.signatureVisualEvents)
            : visualEvents;
        if (!incoming.length) return;

        const now = Date.now();
        const additions = buildSignatureJuiceEffects({
            incoming,
            now,
            reducedMotion: prefersReducedMotion.current,
            recentSignatureImpactByTile: recentSignatureImpactByTileRef.current,
        });

        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    }, [boardEventDigest?.signatureVisualEvents, boardEventDigest?.visualEventsRef, visualEvents]);

    useEffect(() => {
        if (playerDefeated && !lastPlayerDefeatedRef.current) {
            armCriticalCueHold(Date.now() + CRITICAL_PLAYER_DEATH_MIN_HOLD_MS);
        }
        lastPlayerDefeatedRef.current = playerDefeated;
    }, [playerDefeated]);

    useEffect(() => {
        if (timelineEvents.length > 0) {
            processedVisualBatchRef.current = boardEventDigest?.visualEventsRef || visualEvents;
            return;
        }
        const legacyBatchRef = boardEventDigest?.visualEventsRef || visualEvents;
        if (processedVisualBatchRef.current === legacyBatchRef) return;
        processedVisualBatchRef.current = legacyBatchRef;
        const incoming = boardEventDigest?.legacyVfxVisualEvents
            ? Array.from(boardEventDigest.legacyVfxVisualEvents)
            : visualEvents;
        if (!incoming.length) return;

        const now = Date.now();
        const newEffects = buildLegacyVfxEffects({ incoming, now });

        if (newEffects.length > 0) {
            setEffects(prev => [...prev, ...newEffects]);
        }
    }, [boardEventDigest?.legacyVfxVisualEvents, boardEventDigest?.visualEventsRef, visualEvents, timelineEvents.length]);

    useEffect(() => {
        const damageEvents = boardEventDigest?.damageSimulationEvents || simulationEvents;
        if (damageEvents.length < processedSimulationCount.current) {
            processedSimulationCount.current = 0;
        }
        const startIndex = processedSimulationCount.current;
        if (startIndex >= damageEvents.length) return;
        const incoming = damageEvents.slice(startIndex);
        processedSimulationCount.current = damageEvents.length;

        const now = Date.now();
        const additions = buildSimulationDamageCueEffects({
            incoming,
            now,
            startIndex,
            actorById,
            playerActorId,
            recentSignatureImpactByTile: recentSignatureImpactByTileRef.current,
            classifyDamageCueType,
        });
        const criticalCueHoldUntil = resolveCriticalPlayerCueHoldUntil({
            additions,
            now,
            playerDefeated,
        });
        if (criticalCueHoldUntil > 0) {
            armCriticalCueHold(criticalCueHoldUntil);
        }

        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    }, [boardEventDigest?.damageSimulationEvents, simulationEvents, actorById, playerActorId, playerDefeated]);

    useEffect(() => {
        if (cleanupTimerRef.current !== null) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = null;
        }

        if (effects.length === 0) return;

        const now = Date.now();
        const nextExpiryMs = resolveNextCleanupDelayMs(effects, now);

        if (!Number.isFinite(nextExpiryMs)) {
            setEffects([]);
            return;
        }

        const delay = Math.max(16, Math.min(180, Math.floor(nextExpiryMs)));
        cleanupTimerRef.current = window.setTimeout(() => {
            const tickNow = Date.now();
            setEffects(prev => {
                const prevTick = lastEffectTickRef.current;
                lastEffectTickRef.current = tickNow;
                const next = prev.filter(e => tickNow < (e.startTime + getEffectLifetimeMs(e)));
                if (next.length !== prev.length) return next;

                const startedAny = prev.some(e => prevTick < e.startTime && e.startTime <= tickNow);
                return startedAny ? [...prev] : prev;
            });
        }, delay);

        return () => {
            if (cleanupTimerRef.current !== null) {
                window.clearTimeout(cleanupTimerRef.current);
                cleanupTimerRef.current = null;
            }
        };
    }, [effects]);

    return effects;
};
