import React, { useState, useEffect, useRef } from 'react';
import type { Point, TimelineEvent } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';

interface JuiceEffect {
    id: string;
    type: 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring';
    position: Point;
    payload?: any;
    startTime: number;
}

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
    timelineEvents?: TimelineEvent[];
    onBusyStateChange?: (busy: boolean) => void;
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

export const JuiceManager: React.FC<JuiceManagerProps> = ({ visualEvents, timelineEvents = [], onBusyStateChange }) => {
    const [effects, setEffects] = useState<JuiceEffect[]>([]);
    const eventHash = useRef<string>('');
    const processedTimelineIds = useRef<Set<string>>(new Set());
    const timelineQueue = useRef<TimelineEvent[]>([]);
    const isRunningQueue = useRef(false);
    const [timelineBusy, setTimelineBusy] = useState(false);
    const prefersReducedMotion = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = () => { prefersReducedMotion.current = mq.matches; };
        onChange();
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);

    // Notify parent of busy state
    useEffect(() => {
        onBusyStateChange?.(effects.length > 0 || timelineBusy);
    }, [effects.length, timelineBusy, onBusyStateChange]);

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
        } else if (ev.phase === 'DAMAGE_APPLY') {
            additions.push({
                id: `${effectId}:impact`,
                type: 'impact',
                position,
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
        const newEvents = timelineEvents.filter(ev => !processedTimelineIds.current.has(ev.id));
        if (!newEvents.length) return;

        newEvents.forEach(ev => processedTimelineIds.current.add(ev.id));
        timelineQueue.current.push(...newEvents);

        if (isRunningQueue.current) return;
        isRunningQueue.current = true;
        setTimelineBusy(true);

        (async () => {
            while (timelineQueue.current.length > 0) {
                const ev = timelineQueue.current.shift()!;
                enqueueTimelineEffects(ev);
                const baseDuration = ev.blocking ? (ev.suggestedDurationMs ?? 140) : 0;
                const waitDuration = prefersReducedMotion.current
                    ? Math.min(80, Math.floor(baseDuration * 0.35))
                    : baseDuration;
                if (waitDuration > 0) {
                    await waitMs(waitDuration);
                }
            }
            isRunningQueue.current = false;
            setTimelineBusy(false);
        })();
    }, [timelineEvents]);

    // Fallback mode for legacy visual events when no timeline is present
    useEffect(() => {
        if (timelineEvents.length > 0) return;
        const hash = JSON.stringify(visualEvents);
        if (hash === eventHash.current) return;
        eventHash.current = hash;

        const newEffects: JuiceEffect[] = [];
        const now = Date.now();

        visualEvents.forEach((ev, idx) => {
            const id = `juice-${now}-${idx}`;
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

    // Cleanup finished effects
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setEffects(prev => prev.filter(e => {
                const age = now - e.startTime;
                if (e.type === 'impact') return age < 400;
                if (e.type === 'combat_text') return age < 1000;
                if (e.type === 'flash') return age < 300;
                if (e.type === 'spear_trail') return age < 500;
                if (e.type === 'vaporize') return age < 600;
                if (e.type === 'lava_ripple') return age < 800;
                if (e.type === 'explosion_ring') return age < 1000;
                return age < 2000;
            }));
        }, 100);
        return () => clearInterval(interval);
    }, []);

    return (
        <g style={{ pointerEvents: 'none' }}>
            {effects.map(effect => {
                if (!effect.position) return null;
                const { x, y } = hexToPixel(effect.position, TILE_SIZE);

                if (effect.type === 'impact') {
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
