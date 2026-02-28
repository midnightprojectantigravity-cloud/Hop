import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimelineEvent, SimulationEvent } from '@hop/engine';
import type { JuiceEffect, JuiceActorSnapshot } from './juice-types';
import { buildSignatureJuiceEffects } from './signature-effects';
import { buildLegacyVfxEffects, buildSimulationDamageCueEffects } from './event-effect-builders';
import {
    classifyDamageCueType,
    getEffectLifetimeMs,
    resolveEventPoint,
    TIMELINE_TIME_SCALE,
    waitMs,
} from './juice-manager-utils';

const MAX_BLOCKING_WAIT_MS = 650;
const MAX_QUEUE_RUNTIME_MS = 3500;

interface UseJuiceManagerEffectsArgs {
    visualEvents: { type: string; payload: any }[];
    timelineEvents: TimelineEvent[];
    simulationEvents: SimulationEvent[];
    actorSnapshots: JuiceActorSnapshot[];
    onBusyStateChange?: (busy: boolean) => void;
}

export const useJuiceManagerEffects = ({
    visualEvents,
    timelineEvents,
    simulationEvents,
    actorSnapshots,
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
    const prefersReducedMotion = useRef(false);
    const movementDurationByActor = useRef<Map<string, { durationMs: number; seenAt: number }>>(new Map());
    const cleanupTimerRef = useRef<number | null>(null);
    const lastEffectTickRef = useRef<number>(Date.now());
    const recentSignatureImpactByTileRef = useRef<Map<string, { at: number; signature: string }>>(new Map());

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
        if (!visualEvents.length) return;
        const next = new Map(movementDurationByActor.current);
        const now = Date.now();
        for (const ev of visualEvents) {
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
    }, [visualEvents]);

    useEffect(() => {
        onBusyStateChange?.(timelineBusy);
    }, [timelineBusy, onBusyStateChange]);

    const enqueueTimelineEffects = (ev: TimelineEvent) => {
        const now = Date.now();
        const position = resolveEventPoint(ev.payload);
        if (!position) return;

        const additions: JuiceEffect[] = [];
        const effectId = `${ev.id}:${now}`;

        if (ev.phase === 'HAZARD_CHECK') {
            additions.push({
                id: `${effectId}:haz`,
                type: 'combat_text',
                position,
                payload: { text: '!' },
                startTime: now
            });
        } else if (ev.phase === 'DEATH_RESOLVE') {
            additions.push({
                id: `${effectId}:vapor`,
                type: 'vaporize',
                position,
                startTime: now
            });
        }

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
                    let baseDuration = ev.blocking ? Math.round((ev.suggestedDurationMs ?? 140) * TIMELINE_TIME_SCALE) : 0;

                    if (ev.phase === 'MOVE_END') {
                        const actorId = (ev.payload as any)?.targetActorId as string | undefined;
                        if (actorId) {
                            const traced = movementDurationByActor.current.get(actorId);
                            const isFresh = traced ? (Date.now() - traced.seenAt) <= 2500 : false;
                            if (traced && isFresh && traced.durationMs > 0) {
                                baseDuration = Math.max(
                                    baseDuration,
                                    Math.min(MAX_BLOCKING_WAIT_MS, Math.round(traced.durationMs * TIMELINE_TIME_SCALE))
                                );
                            }
                        }
                    }

                    let phaseDuration = 0;
                    if (ev.phase === 'MOVE_END') {
                        phaseDuration = Math.min(460, Math.max(70, baseDuration));
                    } else if (ev.phase === 'DEATH_RESOLVE') {
                        phaseDuration = Math.min(120, Math.max(55, baseDuration));
                    } else if (ev.phase === 'DAMAGE_APPLY') {
                        phaseDuration = Math.min(80, Math.max(35, baseDuration));
                    } else if (ev.phase === 'HAZARD_CHECK') {
                        phaseDuration = Math.min(70, Math.max(30, baseDuration));
                    } else if (ev.blocking) {
                        phaseDuration = Math.min(70, Math.max(0, baseDuration));
                    }

                    const rawWaitDuration = ev.phase === 'MOVE_END'
                        ? baseDuration
                        : (prefersReducedMotion.current
                            ? Math.min(70, Math.floor(phaseDuration * 0.5))
                            : phaseDuration);
                    const waitDuration = Math.max(0, Math.min(MAX_BLOCKING_WAIT_MS, rawWaitDuration));
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
        if (processedJuiceSignatureBatchRef.current === visualEvents) return;
        processedJuiceSignatureBatchRef.current = visualEvents;
        const incoming = visualEvents;
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
    }, [visualEvents]);

    useEffect(() => {
        if (timelineEvents.length > 0) {
            processedVisualBatchRef.current = visualEvents;
            return;
        }
        if (processedVisualBatchRef.current === visualEvents) return;
        processedVisualBatchRef.current = visualEvents;
        const incoming = visualEvents;
        if (!incoming.length) return;

        const now = Date.now();
        const newEffects = buildLegacyVfxEffects({ incoming, now });

        if (newEffects.length > 0) {
            setEffects(prev => [...prev, ...newEffects]);
        }
    }, [visualEvents, timelineEvents.length]);

    useEffect(() => {
        if (simulationEvents.length < processedSimulationCount.current) {
            processedSimulationCount.current = 0;
        }
        const startIndex = processedSimulationCount.current;
        if (startIndex >= simulationEvents.length) return;
        const incoming = simulationEvents.slice(startIndex);
        processedSimulationCount.current = simulationEvents.length;

        const now = Date.now();
        const additions = buildSimulationDamageCueEffects({
            incoming,
            now,
            startIndex,
            actorById,
            recentSignatureImpactByTile: recentSignatureImpactByTileRef.current,
            classifyDamageCueType,
        });

        if (additions.length > 0) {
            setEffects(prev => [...prev, ...additions]);
        }
    }, [simulationEvents, actorById]);

    useEffect(() => {
        if (cleanupTimerRef.current !== null) {
            window.clearTimeout(cleanupTimerRef.current);
            cleanupTimerRef.current = null;
        }

        if (effects.length === 0) return;

        const now = Date.now();
        let nextExpiryMs = Infinity;
        for (const effect of effects) {
            if (effect.startTime > now) {
                const untilStart = effect.startTime - now;
                if (untilStart > 0 && untilStart < nextExpiryMs) {
                    nextExpiryMs = untilStart;
                }
                continue;
            }
            const age = now - effect.startTime;
            const remaining = getEffectLifetimeMs(effect) - age;
            if (remaining > 0 && remaining < nextExpiryMs) {
                nextExpiryMs = remaining;
            }
        }

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
