import React, { useState, useEffect, useRef } from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';

export interface JuiceEffect {
    id: string;
    type: 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring';
    position: Point;
    payload?: any;
    startTime: number;
}

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
    onBusyStateChange?: (busy: boolean) => void;
}

export const JuiceManager: React.FC<JuiceManagerProps> = ({ visualEvents, onBusyStateChange }) => {
    const [effects, setEffects] = useState<JuiceEffect[]>([]);
    const eventHash = useRef<string>('');

    // Notify parent of busy state
    useEffect(() => {
        onBusyStateChange?.(effects.length > 0);
    }, [effects.length, onBusyStateChange]);

    // Process new events
    useEffect(() => {
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
            } else if (ev.type === 'combat_text') {
                newEffects.push({
                    id,
                    type: 'combat_text',
                    position: ev.payload.position || { q: 0, r: 0, s: 0 },
                    payload: ev.payload,
                    startTime: now
                });
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
    }, [visualEvents]);

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
