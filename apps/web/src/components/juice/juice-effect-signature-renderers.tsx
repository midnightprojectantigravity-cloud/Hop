import React from 'react';
import type { Point } from '@hop/engine';
import { hexToPixel, TILE_SIZE } from '@hop/engine';
import type { JuiceEffect, WorldPoint } from './juice-types';

interface SignatureRenderArgs {
    effect: JuiceEffect;
    x: number;
    y: number;
}

const renderBasicAttackStrikeEffect = ({ effect, x, y }: SignatureRenderArgs): React.ReactNode => {
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
};

const renderArcherShotSignatureEffect = ({ effect, x, y }: SignatureRenderArgs): React.ReactNode => {
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
};

export const renderSignatureEffect = (args: SignatureRenderArgs): React.ReactNode => {
    if (args.effect.type === 'basic_attack_strike') return renderBasicAttackStrikeEffect(args);
    if (args.effect.type === 'archer_shot_signature') return renderArcherShotSignatureEffect(args);
    return null;
};

