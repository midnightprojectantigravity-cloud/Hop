import React from 'react';
import type { Actor as EntityType } from '../game/types';
import { hexToPixel } from '../game/hex';
import { TILE_SIZE } from '../game/constants';

interface EntityProps {
    entity: EntityType;
    isSpear?: boolean;
}

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

    const getEmoji = () => {
        if (isPlayer) return '🛡️';
        if (entity.subtype === 'archer') return '🏹';
        if (entity.subtype === 'bomber') return '💣';
        return '🏃';
    };

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
                <circle r={TILE_SIZE * 0.9} fill={isPlayer ? '#0ea5e9' : '#ef4444'} opacity={0.08} />
                <text x="0" y="-6" textAnchor="middle" dy=".3em" fontSize="20" className="entity-emoji">{getEmoji()}</text>

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
                        <rect x={-12} y={18} width={24} height={5} rx={2} ry={2} fill="#333" />
                        <rect x={-12} y={18} width={(24 * hpFraction)} height={5} rx={2} ry={2} fill="#fb7185" />
                        {/* Tooltip for enemy */}
                        <title>{`${entity.subtype || entity.type} — HP ${entity.hp}/${entity.maxHp}`}</title>
                    </>
                )}
            </g>
        </g>
    );
};
