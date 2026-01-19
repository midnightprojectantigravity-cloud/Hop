import React, { useState, useEffect, useRef } from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';

export interface JuiceEffect {
    id: string;
    type: 'impact' | 'combat_text' | 'flash' | 'spear_trail';
    position: Point;
    payload?: any;
    startTime: number;
}

interface JuiceManagerProps {
    visualEvents: { type: string; payload: any }[];
}

export const JuiceManager: React.FC<JuiceManagerProps> = ({ visualEvents }) => {
    const [effects, setEffects] = useState<JuiceEffect[]>([]);
    const eventHash = useRef<string>('');

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

                    // Note: If no position is provided, it's harder to render text correctly in SVG space 
                    // without knowing where the actor is. We'll assume the caller provides position.

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

                return null;
            })}
        </g>
    );
};
