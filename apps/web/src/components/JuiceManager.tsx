import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Point, TimelineEvent, SimulationEvent } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { VisualAssetManifest, VisualAssetEntry } from '../visual/asset-manifest';
import { resolveFxAssetId, resolveCombatTextFrameAssetId } from '../visual/asset-selectors';

type JuiceEffectType =
    | 'impact'
    | 'combat_text'
    | 'flash'
    | 'spear_trail'
    | 'vaporize'
    | 'lava_ripple'
    | 'explosion_ring'
    | 'melee_lunge'
    | 'arrow_shot'
    | 'arcane_bolt';

interface JuiceEffect {
    id: string;
    type: JuiceEffectType;
    position: Point;
    payload?: any;
    startTime: number;
}

interface JuiceActorSnapshot {
    id: string;
    position: Point;
    subtype?: string;
}

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

const getEffectLifetimeMs = (effectType: JuiceEffect['type']): number => {
    if (effectType === 'impact') return 400;
    if (effectType === 'combat_text') return 1000;
    if (effectType === 'flash') return 300;
    if (effectType === 'melee_lunge') return 240;
    if (effectType === 'arrow_shot') return 260;
    if (effectType === 'arcane_bolt') return 320;
    if (effectType === 'spear_trail') return 500;
    if (effectType === 'vaporize') return 600;
    if (effectType === 'lava_ripple') return 800;
    if (effectType === 'explosion_ring') return 1000;
    return 2000;
};

const FX_ASSET_EFFECT_TYPES = new Set<JuiceEffectType>(['impact', 'flash', 'combat_text', 'spear_trail', 'vaporize', 'lava_ripple', 'explosion_ring']);
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
    const processedTimelineCount = useRef(0);
    const processedVisualCount = useRef(0);
    const processedSimulationCount = useRef(0);
    const timelineQueue = useRef<TimelineEvent[]>([]);
    const isRunningQueue = useRef(false);
    const [timelineBusy, setTimelineBusy] = useState(false);
    const prefersReducedMotion = useRef(false);
    const movementDurationByActor = useRef<Map<string, { durationMs: number; seenAt: number }>>(new Map());
    const cleanupTimerRef = useRef<number | null>(null);
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
        if (timelineEvents.length < processedTimelineCount.current) {
            processedTimelineCount.current = 0;
        }
        const newEvents = timelineEvents.slice(processedTimelineCount.current);
        if (!newEvents.length) return;

        processedTimelineCount.current = timelineEvents.length;
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

    // Fallback mode for legacy visual events when no timeline is present
    useEffect(() => {
        if (timelineEvents.length > 0) {
            processedVisualCount.current = visualEvents.length;
            return;
        }
        if (visualEvents.length < processedVisualCount.current) {
            processedVisualCount.current = 0;
        }

        const startIndex = processedVisualCount.current;
        if (startIndex >= visualEvents.length) return;
        const incoming = visualEvents.slice(startIndex);
        processedVisualCount.current = visualEvents.length;

        const newEffects: JuiceEffect[] = [];
        const now = Date.now();

        incoming.forEach((ev, idx) => {
            const id = `juice-${now}-${startIndex + idx}`;
            if (ev.type === 'vfx' && ev.payload?.type === 'impact') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'impact',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'flash') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'flash',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'spear_trail') {
                if (ev.payload.path && ev.payload.path.length > 0) {
                    newEffects.push({
                        id,
                        type: 'spear_trail',
                        position: ev.payload.path[0],
                        payload: ev.payload,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'vaporize') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'vaporize',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'lava_ripple') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'lava_ripple',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            } else if (ev.type === 'vfx' && ev.payload?.type === 'explosion_ring') {
                if (ev.payload.position) {
                    newEffects.push({
                        id,
                        type: 'explosion_ring',
                        position: ev.payload.position,
                        startTime: now
                    });
                }
            }
        });

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
        const additions: JuiceEffect[] = [];

        incoming.forEach((ev, idx) => {
            if (ev.type !== 'DamageTaken' || !ev.position) return;
            const targetPos = ev.position;
            const sourceId = String(ev.payload?.sourceId || '');
            const source = sourceId ? actorById.get(sourceId) : undefined;
            const reason = String(ev.payload?.reason || '');

            if (source?.position) {
                const fromPx = hexToPixel(source.position, TILE_SIZE);
                const toPx = hexToPixel(targetPos, TILE_SIZE);
                const distancePx = Math.hypot(toPx.x - fromPx.x, toPx.y - fromPx.y);
                const cueType = classifyDamageCueType(source.subtype, reason, distancePx);
                if (cueType) {
                    additions.push({
                        id: `sim-cue-${now}-${startIndex + idx}`,
                        type: cueType,
                        position: targetPos,
                        payload: {
                            source: source.position,
                            sourceSubtype: source.subtype,
                            reason
                        },
                        startTime: now
                    });
                }
            }

            additions.push({
                id: `sim-impact-${now}-${startIndex + idx}`,
                type: 'impact',
                position: targetPos,
                startTime: now
            });
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
            const age = now - effect.startTime;
            const remaining = getEffectLifetimeMs(effect.type) - age;
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
                const next = prev.filter(e => (tickNow - e.startTime) < getEffectLifetimeMs(e.type));
                return next.length === prev.length ? prev : next;
            });
        }, delay);

        return () => {
            if (cleanupTimerRef.current !== null) {
                window.clearTimeout(cleanupTimerRef.current);
                cleanupTimerRef.current = null;
            }
        };
    }, [effects]);

    return (
        <g style={{ pointerEvents: 'none' }}>
            {effects.map(effect => {
                if (!effect.position) return null;
                const { x, y } = hexToPixel(effect.position, TILE_SIZE);
                const fxAssetId = FX_ASSET_EFFECT_TYPES.has(effect.type)
                    ? resolveFxAssetId(effect.type as 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring')
                    : undefined;
                const fxAssetHref = fxAssetId ? assetById.get(fxAssetId)?.path : undefined;
                const frameAssetHref = assetById.get(resolveCombatTextFrameAssetId())?.path;

                if (effect.type === 'melee_lunge' || effect.type === 'arrow_shot' || effect.type === 'arcane_bolt') {
                    const source = effect.payload?.source as Point | undefined;
                    if (!source) return null;
                    const from = hexToPixel(source, TILE_SIZE);
                    const dx = x - from.x;
                    const dy = y - from.y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const tailX = x - ux * Math.min(dist * 0.18, 14);
                    const tailY = y - uy * Math.min(dist * 0.18, 14);
                    const headSize = effect.type === 'arrow_shot' ? 7 : 5;
                    const leftX = x - ux * headSize - uy * (headSize * 0.55);
                    const leftY = y - uy * headSize + ux * (headSize * 0.55);
                    const rightX = x - ux * headSize + uy * (headSize * 0.55);
                    const rightY = y - uy * headSize - ux * (headSize * 0.55);

                    if (effect.type === 'melee_lunge') {
                        return (
                            <g key={effect.id} className="animate-melee-lunge">
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={tailX}
                                    y2={tailY}
                                    stroke="rgba(255,255,255,0.35)"
                                    strokeWidth={5}
                                    strokeLinecap="round"
                                />
                                <line
                                    x1={tailX}
                                    y1={tailY}
                                    x2={x}
                                    y2={y}
                                    stroke="rgba(255,255,255,0.85)"
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                />
                            </g>
                        );
                    }

                    if (effect.type === 'arrow_shot') {
                        return (
                            <g key={effect.id} className="animate-arrow-shot">
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={x}
                                    y2={y}
                                    stroke="rgba(253,230,138,0.9)"
                                    strokeWidth={2.5}
                                    strokeLinecap="round"
                                    strokeDasharray="10 8"
                                />
                                <path
                                    d={`M ${x} ${y} L ${leftX} ${leftY} M ${x} ${y} L ${rightX} ${rightY}`}
                                    stroke="rgba(254,243,199,0.95)"
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                />
                            </g>
                        );
                    }

                    return (
                        <g key={effect.id} className="animate-arcane-bolt">
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={x}
                                y2={y}
                                stroke="rgba(34,211,238,0.92)"
                                strokeWidth={4}
                                strokeLinecap="round"
                                strokeDasharray="12 10"
                            />
                            <line
                                x1={from.x}
                                y1={from.y}
                                x2={x}
                                y2={y}
                                stroke="rgba(207,250,254,0.85)"
                                strokeWidth={1.8}
                                strokeLinecap="round"
                            />
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.22} fill="rgba(34,211,238,0.35)" />
                        </g>
                    );
                }

                if (effect.type === 'impact') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE * 0.75}
                                y={y - TILE_SIZE * 0.75}
                                width={TILE_SIZE * 1.5}
                                height={TILE_SIZE * 1.5}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-impact"
                                opacity="0.9"
                            />
                        );
                    }
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 0.5}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="2"
                            className="animate-impact"
                        />
                    );
                }

                if (effect.type === 'combat_text') {
                    const color = effect.payload.text.startsWith('-') ? '#fb7185' : '#86efac';

                    return (
                        <g key={effect.id} transform={`translate(${x}, ${y - 10})`}>
                            {frameAssetHref && (
                                <image
                                    href={frameAssetHref}
                                    x={-46}
                                    y={-24}
                                    width={92}
                                    height={24}
                                    preserveAspectRatio="xMidYMid meet"
                                    opacity="0.78"
                                />
                            )}
                            <text
                                textAnchor="middle"
                                fill={color}
                                fontSize="16"
                                fontWeight="black"
                                className="animate-float-up"
                                style={{
                                    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                                    paintOrder: 'stroke',
                                    stroke: '#000',
                                    strokeWidth: '4px'
                                }}
                            >
                                {effect.payload.text}
                            </text>
                        </g>
                    );
                }

                if (effect.type === 'flash') {
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 2}
                            fill="#ffffff"
                            className="animate-flash"
                        />
                    );
                }

                if (effect.type === 'spear_trail') {
                    const path = effect.payload.path as Point[];
                    const points = path.map(p => {
                        const pix = hexToPixel(p, TILE_SIZE);
                        return `${pix.x},${pix.y}`;
                    }).join(' ');

                    return (
                        <polyline
                            key={effect.id}
                            points={points}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="4"
                            strokeLinecap="round"
                            className="animate-spear-trail"
                        />
                    );
                }

                if (effect.type === 'vaporize') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE * 0.95}
                                y={y - TILE_SIZE * 0.95}
                                width={TILE_SIZE * 1.9}
                                height={TILE_SIZE * 1.9}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-vaporize"
                                opacity="0.9"
                            />
                        );
                    }
                    return (
                        <g key={effect.id}>
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * 0.6}
                                fill="#f97316"
                                className="animate-vaporize"
                                opacity="0.8"
                            />
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * 1.2}
                                fill="none"
                                stroke="#f97316"
                                strokeWidth="2"
                                className="animate-ping"
                            />
                        </g>
                    );
                }

                if (effect.type === 'lava_ripple') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE}
                                y={y - TILE_SIZE}
                                width={TILE_SIZE * 2}
                                height={TILE_SIZE * 2}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-ping"
                                opacity="0.85"
                            />
                        );
                    }
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 0.8}
                            fill="none"
                            stroke="#ea580c"
                            strokeWidth="3"
                            className="animate-ping"
                        />
                    );
                }

                if (effect.type === 'explosion_ring') {
                    if (fxAssetHref) {
                        return (
                            <image
                                key={effect.id}
                                href={fxAssetHref}
                                x={x - TILE_SIZE * 1.35}
                                y={y - TILE_SIZE * 1.35}
                                width={TILE_SIZE * 2.7}
                                height={TILE_SIZE * 2.7}
                                preserveAspectRatio="xMidYMid meet"
                                className="animate-explosion-ring"
                                opacity="0.88"
                            />
                        );
                    }
                    return (
                        <circle
                            key={effect.id}
                            cx={x}
                            cy={y}
                            r={TILE_SIZE * 2.5}
                            fill="rgba(255, 120, 0, 0.2)"
                            stroke="#ffaa00"
                            strokeWidth="4"
                            className="animate-explosion-ring"
                        />
                    );
                }

                return null;
            })}
        </g>
    );
}
