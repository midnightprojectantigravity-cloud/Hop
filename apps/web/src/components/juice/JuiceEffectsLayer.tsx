import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { VisualAssetEntry } from '../../visual/asset-manifest';
import { resolveCombatTextFrameAssetId, resolveFxAssetId } from '../../visual/asset-selectors';
import type { JuiceEffect, JuiceEffectType, WorldPoint } from './juice-types';

interface JuiceEffectsLayerProps {
    effects: JuiceEffect[];
    assetById: Map<string, VisualAssetEntry>;
}

const FX_ASSET_EFFECT_TYPES = new Set<JuiceEffectType>([
    'impact',
    'flash',
    'combat_text',
    'spear_trail',
    'vaporize',
    'lava_ripple',
    'explosion_ring'
]);

export const JuiceEffectsLayer: React.FC<JuiceEffectsLayerProps> = ({ effects, assetById }) => {
    const frameAssetHref = assetById.get(resolveCombatTextFrameAssetId())?.path;

    return (
        <g style={{ pointerEvents: 'none' }}>
            {effects.map(effect => {
                const renderNow = Date.now();
                if (renderNow < effect.startTime) return null;
                if (!effect.position && !effect.worldPosition) return null;
                const fallbackPoint = effect.position ? hexToPixel(effect.position, TILE_SIZE) : { x: 0, y: 0 };
                const x = effect.worldPosition?.x ?? fallbackPoint.x;
                const y = effect.worldPosition?.y ?? fallbackPoint.y;
                const fxAssetId = FX_ASSET_EFFECT_TYPES.has(effect.type)
                    ? resolveFxAssetId(effect.type as 'impact' | 'combat_text' | 'flash' | 'spear_trail' | 'vaporize' | 'lava_ripple' | 'explosion_ring')
                    : undefined;
                const fxAssetHref = fxAssetId ? assetById.get(fxAssetId)?.path : undefined;

                if (effect.type === 'basic_attack_strike') {
                    const p = effect.payload || {};
                    const source = p.source as Point | undefined;
                    const target = p.target as Point | undefined;
                    const phase = String(p.phase || 'impact');
                    if (!source || !target) return null;

                    const srcPix = hexToPixel(source, TILE_SIZE);
                    const contact = (p.contactWorld && typeof p.contactWorld.x === 'number' && typeof p.contactWorld.y === 'number')
                        ? (p.contactWorld as WorldPoint)
                        : { x, y };
                    const dx = contact.x - srcPix.x;
                    const dy = contact.y - srcPix.y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const intensity = String(p.intensity || 'medium');
                    const phaseTtl = Math.max(120, Math.min(360, Number(effect.ttlMs || 180)));
                    const fxAnimDuration = `${Math.round(phaseTtl * 0.85)}ms`;
                    const impactRadius = intensity === 'extreme' ? TILE_SIZE * 0.34 : intensity === 'high' ? TILE_SIZE * 0.28 : TILE_SIZE * 0.22;

                    if (phase !== 'impact') return null;

                    const sparkStroke = intensity === 'extreme'
                        ? 'rgba(253,224,71,0.98)'
                        : intensity === 'high'
                            ? 'rgba(255,255,255,0.96)'
                            : 'rgba(226,232,240,0.95)';
                    const sparkFill = intensity === 'extreme'
                        ? 'rgba(251,191,36,0.9)'
                        : 'rgba(255,255,255,0.92)';
                    return (
                        <g key={effect.id}>
                            <g className="juice-basic-strike-spark" style={{ animationDuration: fxAnimDuration }}>
                                <circle
                                    cx={contact.x}
                                    cy={contact.y}
                                    r={impactRadius * 1.65}
                                    fill="rgba(255,255,255,0.16)"
                                    stroke="rgba(255,255,255,0.55)"
                                    strokeWidth={1.4}
                                />
                                <circle cx={contact.x} cy={contact.y} r={impactRadius * 0.62} fill={sparkFill} />
                                <circle cx={contact.x} cy={contact.y} r={impactRadius * 1.2} fill="none" stroke={sparkStroke} strokeWidth={2.4} />
                                <path
                                    d={`M ${contact.x - ux * impactRadius * 1.6} ${contact.y - uy * impactRadius * 1.6} L ${contact.x + ux * impactRadius * 1.6} ${contact.y + uy * impactRadius * 1.6}`}
                                    stroke={sparkStroke}
                                    strokeWidth={2.1}
                                    strokeLinecap="round"
                                />
                                <path
                                    d={`M ${contact.x - uy * impactRadius * 1.35} ${contact.y + ux * impactRadius * 1.35} L ${contact.x + uy * impactRadius * 1.35} ${contact.y - ux * impactRadius * 1.35}`}
                                    stroke="rgba(255,255,255,0.9)"
                                    strokeWidth={1.8}
                                    strokeLinecap="round"
                                />
                            </g>
                        </g>
                    );
                }

                if (effect.type === 'archer_shot_signature') {
                    const p = effect.payload || {};
                    const source = p.source as Point | undefined;
                    const target = p.target as Point | undefined;
                    const phase = String(p.phase || 'travel');
                    if (!source || !target) return null;

                    const from = hexToPixel(source, TILE_SIZE);
                    const targetPix = hexToPixel(target, TILE_SIZE);
                    const contact = (p.contactWorld && typeof p.contactWorld.x === 'number' && typeof p.contactWorld.y === 'number')
                        ? (p.contactWorld as WorldPoint)
                        : { x, y };
                    const end = phase === 'impact' ? contact : targetPix;
                    const dx = end.x - from.x;
                    const dy = end.y - from.y;
                    const dist = Math.max(1, Math.hypot(dx, dy));
                    const ux = dx / dist;
                    const uy = dy / dist;
                    const intensity = String(p.intensity || 'medium');

                    if (phase === 'anticipation') {
                        return (
                            <g key={effect.id} className="animate-arrow-shot" opacity={0.95}>
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={targetPix.x}
                                    y2={targetPix.y}
                                    stroke="rgba(248,113,113,0.75)"
                                    strokeWidth={1.5}
                                    strokeDasharray="4 5"
                                    strokeLinecap="round"
                                />
                                <circle
                                    cx={targetPix.x}
                                    cy={targetPix.y}
                                    r={TILE_SIZE * 0.18}
                                    fill="none"
                                    stroke="rgba(254,202,202,0.9)"
                                    strokeWidth={1.5}
                                />
                            </g>
                        );
                    }

                    if (phase === 'travel') {
                        const tailLen = Math.min(dist * 0.22, TILE_SIZE * 0.75);
                        const shaftStartX = end.x - ux * tailLen;
                        const shaftStartY = end.y - uy * tailLen;
                        const headSize = 7.5;
                        const leftX = end.x - ux * headSize - uy * (headSize * 0.52);
                        const leftY = end.y - uy * headSize + ux * (headSize * 0.52);
                        const rightX = end.x - ux * headSize + uy * (headSize * 0.52);
                        const rightY = end.y - uy * headSize - ux * (headSize * 0.52);
                        return (
                            <g key={effect.id} className="animate-arrow-shot">
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={end.x}
                                    y2={end.y}
                                    stroke="rgba(180,83,9,0.38)"
                                    strokeWidth={3.2}
                                    strokeLinecap="round"
                                    strokeDasharray="8 9"
                                />
                                <line
                                    x1={shaftStartX}
                                    y1={shaftStartY}
                                    x2={end.x}
                                    y2={end.y}
                                    stroke="rgba(254,240,138,0.98)"
                                    strokeWidth={2.2}
                                    strokeLinecap="round"
                                />
                                <path
                                    d={`M ${end.x} ${end.y} L ${leftX} ${leftY} M ${end.x} ${end.y} L ${rightX} ${rightY}`}
                                    stroke="rgba(255,251,235,0.98)"
                                    strokeWidth={1.9}
                                    strokeLinecap="round"
                                />
                                <circle cx={from.x} cy={from.y} r={TILE_SIZE * 0.08} fill="rgba(251,191,36,0.55)" />
                            </g>
                        );
                    }

                    const impactRadius = intensity === 'extreme' || intensity === 'high'
                        ? TILE_SIZE * 0.24
                        : TILE_SIZE * 0.19;
                    return (
                        <g key={effect.id} className="animate-impact">
                            <circle
                                cx={contact.x}
                                cy={contact.y}
                                r={impactRadius * 1.35}
                                fill="rgba(251,191,36,0.14)"
                                stroke="rgba(254,243,199,0.72)"
                                strokeWidth={1.4}
                            />
                            <line
                                x1={contact.x - ux * impactRadius * 1.6}
                                y1={contact.y - uy * impactRadius * 1.6}
                                x2={contact.x + ux * impactRadius * 1.25}
                                y2={contact.y + uy * impactRadius * 1.25}
                                stroke="rgba(255,251,235,0.95)"
                                strokeWidth={2}
                                strokeLinecap="round"
                            />
                            <path
                                d={`M ${contact.x + ux * impactRadius * 1.2} ${contact.y + uy * impactRadius * 1.2} L ${contact.x + ux * impactRadius * 1.75 - uy * impactRadius * 0.45} ${contact.y + uy * impactRadius * 1.75 + ux * impactRadius * 0.45} M ${contact.x + ux * impactRadius * 1.2} ${contact.y + uy * impactRadius * 1.2} L ${contact.x + ux * impactRadius * 1.75 + uy * impactRadius * 0.45} ${contact.y + uy * impactRadius * 1.75 - ux * impactRadius * 0.45}`}
                                stroke="rgba(254,240,138,0.9)"
                                strokeWidth={1.5}
                                strokeLinecap="round"
                            />
                        </g>
                    );
                }

                if (effect.type === 'melee_lunge' || effect.type === 'arrow_shot' || effect.type === 'arcane_bolt' || effect.type === 'generic_line') {
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

                    if (effect.type === 'arrow_shot' || effect.type === 'generic_line') {
                        const lineStroke = effect.type === 'generic_line'
                            ? 'rgba(255,255,255,0.85)'
                            : 'rgba(253,230,138,0.9)';
                        const headStroke = effect.type === 'generic_line'
                            ? 'rgba(255,255,255,0.9)'
                            : 'rgba(254,243,199,0.95)';
                        return (
                            <g key={effect.id} className={effect.type === 'generic_line' ? 'animate-melee-lunge' : 'animate-arrow-shot'}>
                                <line
                                    x1={from.x}
                                    y1={from.y}
                                    x2={x}
                                    y2={y}
                                    stroke={lineStroke}
                                    strokeWidth={effect.type === 'generic_line' ? 2 : 2.5}
                                    strokeLinecap="round"
                                    strokeDasharray={effect.type === 'generic_line' ? '6 6' : '10 8'}
                                />
                                <path
                                    d={`M ${x} ${y} L ${leftX} ${leftY} M ${x} ${y} L ${rightX} ${rightY}`}
                                    stroke={headStroke}
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

                if (effect.type === 'kinetic_wave' || effect.type === 'generic_ring') {
                    const stroke = effect.type === 'kinetic_wave'
                        ? 'rgba(125,211,252,0.9)'
                        : 'rgba(255,255,255,0.7)';
                    const fill = effect.type === 'kinetic_wave'
                        ? 'rgba(56,189,248,0.14)'
                        : 'rgba(255,255,255,0.08)';
                    return (
                        <g key={effect.id} className="animate-explosion-ring">
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * (effect.type === 'kinetic_wave' ? 1.5 : 1.1)}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth={effect.type === 'kinetic_wave' ? 3 : 2}
                                strokeDasharray={effect.type === 'kinetic_wave' ? '10 6' : '6 4'}
                            />
                        </g>
                    );
                }

                if (effect.type === 'wall_crack') {
                    const p = effect.payload || {};
                    const source = p.source as Point | undefined;
                    const target = p.target as Point | undefined;
                    const angle = source && target
                        ? Math.atan2(hexToPixel(target, TILE_SIZE).y - hexToPixel(source, TILE_SIZE).y, hexToPixel(target, TILE_SIZE).x - hexToPixel(source, TILE_SIZE).x)
                        : 0;
                    const len = TILE_SIZE * 0.32;
                    const perp = angle + Math.PI / 2;
                    const x1 = x - Math.cos(angle) * len;
                    const y1 = y - Math.sin(angle) * len;
                    const x2 = x + Math.cos(angle) * len;
                    const y2 = y + Math.sin(angle) * len;
                    return (
                        <g key={effect.id} className="animate-impact">
                            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.95)" strokeWidth={2.2} strokeLinecap="round" />
                            <line x1={x - Math.cos(perp) * len * 0.8} y1={y - Math.sin(perp) * len * 0.8} x2={x + Math.cos(perp) * len * 0.8} y2={y + Math.sin(perp) * len * 0.8} stroke="rgba(147,197,253,0.9)" strokeWidth={1.7} strokeLinecap="round" />
                            <circle cx={x} cy={y} r={3.5} fill="rgba(255,255,255,0.9)" />
                        </g>
                    );
                }

                if (effect.type === 'dash_blur') {
                    const path = effect.payload?.path as Point[] | undefined;
                    if (!path || path.length < 2) return null;
                    const points = path.map(p => {
                        const pix = hexToPixel(p, TILE_SIZE);
                        return `${pix.x},${pix.y}`;
                    }).join(' ');
                    return (
                        <polyline
                            key={effect.id}
                            points={points}
                            fill="none"
                            stroke="rgba(255,255,255,0.4)"
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="animate-arrow-shot"
                            opacity={0.6}
                        />
                    );
                }

                if (effect.type === 'hidden_fade') {
                    return (
                        <g key={effect.id} className="animate-flash">
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.78} fill="rgba(168,85,247,0.16)" stroke="rgba(196,181,253,0.75)" strokeWidth={2} />
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.34} fill="rgba(30,27,75,0.35)" />
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
                    const textValue = String(effect.payload.text || '');
                    const color = effect.payload.color
                        || (textValue.startsWith('-') ? '#fb7185' : '#86efac');

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
                                {textValue}
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
};
