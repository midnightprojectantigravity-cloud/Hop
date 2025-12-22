import React from 'react';
import type { Actor as EntityType } from '../game/types';
import { hexToPixel } from '../game/hex';
import { TILE_SIZE } from '../game/constants';

interface EntityProps {
    entity: EntityType;
    isSpear?: boolean;
}

const renderIcon = (entity: EntityType, isPlayer: boolean, size = 24) => {
    const stroke = isPlayer ? 'var(--accent)' : '#b91c1c';
    const fill = isPlayer ? 'rgba(139,94,52,0.12)' : 'rgba(185,28,28,0.08)';

    if (isPlayer) {
        return (
            <g>
                <title>Player</title>
                <path d={`M0 ${-size*0.35} L${size*0.3} ${-size*0.1} C${size*0.3} ${size*0.4} 0 ${size*0.55} 0 ${size*0.75} C0 ${size*0.55} ${-size*0.3} ${size*0.4} ${-size*0.3} ${-size*0.1} Z`} stroke={stroke} fill={fill} strokeWidth={1.5} strokeLinecap="round" />
                <line x1={-size*0.06} y1={-size*0.05} x2={size*0.22} y2={size*0.5} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
            </g>
        );
    }

    if (entity.subtype === 'archer') {
        return (
            <g>
                <title>Archer</title>
                <path d={`M${-size*0.3} ${-size*0.4} C${-size*0.05} ${-size*0.35} ${-size*0.05} ${size*0.35} ${-size*0.3} ${size*0.4}`} stroke={stroke} fill="none" strokeWidth={1.8} strokeLinecap="round" />
                <line x1={-size*0.45} y1={0} x2={size*0.45} y2={0} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
                <polygon points={`${size*0.45},0 ${size*0.35},${-size*0.06} ${size*0.35},${size*0.06}`} fill={stroke} />
            </g>
        );
    }

    if (entity.subtype === 'bomber') {
        return (
            <g>
                <title>Bomber</title>
                <circle r={size*0.22} cx={0} cy={-size*0.05} fill={fill} stroke={stroke} strokeWidth={1.6} />
                <path d={`M${-size*0.02} ${-size*0.28} L${size*0.06} ${-size*0.4}`} stroke={stroke} strokeWidth={1.6} strokeLinecap="round" />
                <rect x={-size*0.06} y={size*0.02} width={size*0.12} height={size*0.06} rx={1} fill={stroke} />
            </g>
        );
    }

    // default footman / melee
    return (
        <g>
            <title>Footman</title>
            <rect x={-size*0.02} y={-size*0.28} width={size*0.04} height={size*0.6} rx={1} fill={stroke} />
            <path d={`M${-size*0.18} ${-size*0.08} L0 ${-size*0.2} L${size*0.18} ${-size*0.08} L0 ${size*0.1} Z`} fill={fill} stroke={stroke} strokeWidth={1.2} />
        </g>
    );
};

export const Entity: React.FC<EntityProps> = ({ entity, isSpear }) => {
    const { x, y } = hexToPixel(entity.position, TILE_SIZE);

    const isPlayer = entity.type === 'player';
    const targetPixel = entity.intentPosition ? hexToPixel(entity.intentPosition, TILE_SIZE) : null;

    if (isSpear) {
        return (
            <g transform={`translate(${x},${y})`}>
                <text x="0" y="0" textAnchor="middle" dy=".3em" fontSize="24">🔱</text>
            </g>
        );
    }

    

    const hpFraction = Math.max(0, Math.min(1, (entity.hp || 0) / (entity.maxHp || 1)));

    return (
        <g style={{ transition: 'transform 0.2s ease-in-out' }}>
            {/* Intent Line */}
            {targetPixel && !isPlayer && (
                <line
                    x1={x}
                    y1={y}
                    x2={targetPixel.x}
                    y2={targetPixel.y}
                    stroke="#ef4444"
                    strokeWidth="3"
                    strokeDasharray="4 2"
                    opacity="0.6"
                />
            )}

            <g transform={`translate(${x},${y})`}>
                {/* subtle background circle to help emoji pop */}
                <circle r={TILE_SIZE * 0.9} fill={isPlayer ? 'rgba(139,94,52,0.06)' : 'rgba(184,20,20,0.06)'} opacity={1} />
                <g transform="translate(0,-2) scale(0.9)">
                    {renderIcon(entity, isPlayer, 18)}
                </g>

                {/* HP Bar for player (larger) */}
                {isPlayer && (
                    <g>
                        <rect x={-28} y={18} width={56} height={8} rx={3} ry={3} className="hp-bar-bg" />
                        <rect x={-28} y={18} width={56 * hpFraction} height={8} rx={3} ry={3} className="hp-bar-fill" />
                        <text x={0} y={32} textAnchor="middle" fontSize={10} fill="#ddd">HP {entity.hp}/{entity.maxHp}</text>
                    </g>
                )}

                {/* Tiny HP bar for enemies */}
                {!isPlayer && (
                    <>
                        <rect x={-12} y={18} width={24} height={5} rx={2} ry={2} fill="#2b1f17" />
                        <rect x={-12} y={18} width={(24 * hpFraction)} height={5} rx={2} ry={2} fill="var(--hp-enemy)" />
                        {/* Tooltip for enemy */}
                        <title>{`${entity.subtype || entity.type} — HP ${entity.hp}/${entity.maxHp}`}</title>
                    </>
                )}
            </g>
        </g>
    );
};
