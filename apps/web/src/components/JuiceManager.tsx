import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Point, TimelineEvent, SimulationEvent } from '@hop/engine';
import { TILE_SIZE } from '@hop/engine';
import type { VisualAssetManifest, VisualAssetEntry } from '../visual/asset-manifest';
import { JuiceEffectsLayer } from './juice/JuiceEffectsLayer';
import type { JuiceEffectType, JuiceEffect, JuiceActorSnapshot } from './juice/juice-types';
import { buildSignatureJuiceEffects } from './juice/signature-effects';
import { buildLegacyVfxEffects, buildSimulationDamageCueEffects } from './juice/event-effect-builders';

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
    timelineEvents?: TimelineEvent[];
    simulationEvents?: SimulationEvent[];
    actorSnapshots?: JuiceActorSnapshot[];
    onBusyStateChange?: (busy: boolean) => void;
    assetManifest?: VisualAssetManifest | null;
}

const waitMs = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const resolveEventPoint = (payload: any): Point | null => {
    if (!payload) return null;
    const p = payload.position || payload.destination || payload.origin || payload.target;
    if (p && typeof p.q === 'number' && typeof p.r === 'number' && typeof p.s === 'number') {
        return p;
    }
    return null;
};

const getEffectLifetimeMs = (effect: JuiceEffect): number => {
    if (effect.ttlMs && effect.ttlMs > 0) return effect.ttlMs;
    const effectType = effect.type;
    if (effectType === 'basic_attack_strike') return 180;
    if (effectType === 'archer_shot_signature') return 170;
    if (effectType === 'impact') return 400;
    if (effectType === 'combat_text') return 1000;
    if (effectType === 'flash') return 300;
    if (effectType === 'melee_lunge') return 240;
    if (effectType === 'arrow_shot') return 260;
    if (effectType === 'arcane_bolt') return 320;
    if (effectType === 'kinetic_wave') return 520;
    if (effectType === 'wall_crack') return 700;
    if (effectType === 'dash_blur') return 320;
    if (effectType === 'hidden_fade') return 360;
    if (effectType === 'generic_ring') return 700;
    if (effectType === 'generic_line') return 280;
    if (effectType === 'spear_trail') return 500;
    if (effectType === 'vaporize') return 600;
    if (effectType === 'lava_ripple') return 800;
    if (effectType === 'explosion_ring') return 1000;
    return 2000;
};

const TIMELINE_TIME_SCALE = 0.72;

const classifyDamageCueType = (
    sourceSubtype: string | undefined,
    reason: string,
    distancePx: number
): JuiceEffectType | null => {
    const normalizedSubtype = String(sourceSubtype || '').toLowerCase();
    const normalizedReason = String(reason || '').toLowerCase();

    if (
        normalizedReason.includes('lava')
        || normalizedReason.includes('fire')
        || normalizedReason.includes('hazard')
        || normalizedReason.includes('burn')
        || normalizedReason.includes('crush')
        || normalizedReason.includes('collision')
    ) {
        return null;
    }

    if (normalizedSubtype === 'bomber' || normalizedReason.includes('bomb') || normalizedReason.includes('explosion')) {
        return null;
    }
    if (normalizedSubtype === 'warlock' || normalizedReason.includes('arcane') || normalizedReason.includes('force') || normalizedReason.includes('spell')) {
        return 'arcane_bolt';
    }
    if (normalizedSubtype === 'archer' || normalizedReason.includes('arrow') || normalizedReason.includes('spear_throw')) {
        return 'arrow_shot';
    }
    if (distancePx <= TILE_SIZE * 2.05 || normalizedReason.includes('basic_attack') || normalizedReason.includes('melee')) {
        return 'melee_lunge';
    }
    return null;
};

export const JuiceManager: React.FC<JuiceManagerProps> = ({
    visualEvents,
    timelineEvents = [],
    simulationEvents = [],
    actorSnapshots = [],
    onBusyStateChange,
    assetManifest
}) => {
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
    const MAX_BLOCKING_WAIT_MS = 650;
    const MAX_QUEUE_RUNTIME_MS = 3500;
    const assetById = useMemo(() => {
        const map = new Map<string, VisualAssetEntry>();
        for (const asset of assetManifest?.assets || []) {
            map.set(asset.id, asset);
        }
        return map;
    }, [assetManifest]);
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

    // Notify parent of busy state.
    // Only timeline sequencing should gate turn progression; decorative effects
    // (combat text, flashes, etc.) must not hold input lock.
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

                    // Movement is rendered by Entity animations using kinetic_trace.durationMs.
                    // For strict sequence fidelity, use recent movement durations only.
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

    // Fallback mode for legacy visual events when no timeline is present
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

    // Cleanup finished effects
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

                // Force a render when any queued effect crosses its scheduled start time.
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

    return <JuiceEffectsLayer effects={effects} assetById={assetById} />;
}
