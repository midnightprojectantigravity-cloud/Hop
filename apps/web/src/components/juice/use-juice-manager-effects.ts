import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { TimelineEvent, SimulationEvent } from '@hop/engine';
import type { JuiceActorSnapshot } from './juice-types';
import { buildSignatureJuiceEffects } from './signature-effects';
import { buildLegacyVfxEffects, buildSimulationDamageCueEffects } from './event-effect-builders';
import type { BoardEventDigest } from '../game-board/board-event-digest';
import { createJuiceEffectsStore, type JuiceEffectsStore } from './juice-effects-store';
import {
    classifyDamageCueType,
    CRITICAL_PLAYER_DEATH_MIN_HOLD_MS,
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
}: UseJuiceManagerEffectsArgs): JuiceEffectsStore => {
    const effectsStoreRef = useRef<JuiceEffectsStore | null>(null);
    if (!effectsStoreRef.current) {
        effectsStoreRef.current = createJuiceEffectsStore();
    }
    const effectsStore = effectsStoreRef.current;
    const processedTimelineBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedVisualBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedJuiceSignatureBatchRef = useRef<ReadonlyArray<unknown> | null>(null);
    const processedSimulationCount = useRef(0);
    const timelineQueue = useRef<TimelineEvent[]>([]);
    const isRunningQueue = useRef(false);
    const busyStateRef = useRef({
        timelineBusy: false,
        criticalCueBusy: false,
        combinedBusy: false,
    });
    const onBusyStateChangeRef = useRef(onBusyStateChange);
    const prefersReducedMotion = useRef(false);
    const movementDurationByActor = useRef<Map<string, { durationMs: number; seenAt: number }>>(new Map());
    const criticalCueTimerRef = useRef<number | null>(null);
    const recentSignatureImpactByTileRef = useRef<Map<string, { at: number; signature: string }>>(new Map());
    const criticalCueHoldUntilRef = useRef(0);
    const lastPlayerDefeatedRef = useRef(false);
    const disposedRef = useRef(false);

    const actorById = useMemo(() => {
        const map = new Map<string, JuiceActorSnapshot>();
        for (const actor of actorSnapshots) {
            map.set(actor.id, actor);
        }
        return map;
    }, [actorSnapshots]);

    useEffect(() => {
        onBusyStateChangeRef.current = onBusyStateChange;
    }, [onBusyStateChange]);

    const setBusyState = useCallback((nextPartial: Partial<{
        timelineBusy: boolean;
        criticalCueBusy: boolean;
    }>) => {
        const previous = busyStateRef.current;
        const next = {
            timelineBusy: nextPartial.timelineBusy ?? previous.timelineBusy,
            criticalCueBusy: nextPartial.criticalCueBusy ?? previous.criticalCueBusy,
        };
        const combinedBusy = next.timelineBusy || next.criticalCueBusy;
        if (
            previous.timelineBusy === next.timelineBusy
            && previous.criticalCueBusy === next.criticalCueBusy
            && previous.combinedBusy === combinedBusy
        ) {
            return;
        }
        busyStateRef.current = {
            ...next,
            combinedBusy,
        };
        if (previous.combinedBusy !== combinedBusy) {
            onBusyStateChangeRef.current?.(combinedBusy);
        }
    }, []);

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
        disposedRef.current = false;
        return () => {
            disposedRef.current = true;
            if (criticalCueTimerRef.current !== null) {
                window.clearTimeout(criticalCueTimerRef.current);
                criticalCueTimerRef.current = null;
            }
            effectsStore.dispose();
            onBusyStateChangeRef.current?.(false);
        };
    }, [effectsStore]);

    const armCriticalCueHold = (holdUntil: number) => {
        if (
            disposedRef.current
            || typeof window === 'undefined'
            || !Number.isFinite(holdUntil)
            || holdUntil <= 0
        ) {
            return;
        }

        criticalCueHoldUntilRef.current = Math.max(criticalCueHoldUntilRef.current, holdUntil);
        setBusyState({ criticalCueBusy: true });

        if (criticalCueTimerRef.current !== null) {
            window.clearTimeout(criticalCueTimerRef.current);
            criticalCueTimerRef.current = null;
        }

        const scheduleRelease = () => {
            if (disposedRef.current) return;
            const remainingMs = criticalCueHoldUntilRef.current - Date.now();
            if (remainingMs > 16) {
                criticalCueTimerRef.current = window.setTimeout(scheduleRelease, Math.min(remainingMs, 120));
                return;
            }
            criticalCueTimerRef.current = null;
            criticalCueHoldUntilRef.current = 0;
            setBusyState({ criticalCueBusy: false });
        };

        scheduleRelease();
    };

    const enqueueTimelineEffects = (ev: TimelineEvent) => {
        const now = Date.now();
        const additions = buildTimelinePhaseEffects(ev, now);
        if (additions.length > 0) {
            effectsStore.enqueueEffects(additions);
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
        setBusyState({ timelineBusy: true });

        (async () => {
            try {
                const queueStart = Date.now();
                while (timelineQueue.current.length > 0) {
                    if (disposedRef.current) {
                        break;
                    }
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
                setBusyState({ timelineBusy: false });
            }
        })();
    }, [effectsStore, setBusyState, timelineEvents]);

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
            effectsStore.enqueueEffects(additions);
        }
    }, [boardEventDigest?.signatureVisualEvents, boardEventDigest?.visualEventsRef, effectsStore, visualEvents]);

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
            effectsStore.enqueueEffects(newEffects);
        }
    }, [boardEventDigest?.legacyVfxVisualEvents, boardEventDigest?.visualEventsRef, effectsStore, visualEvents, timelineEvents.length]);

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
            effectsStore.enqueueEffects(additions);
        }
    }, [boardEventDigest?.damageSimulationEvents, simulationEvents, actorById, effectsStore, playerActorId, playerDefeated]);

    return effectsStore;
};
