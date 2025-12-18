import React from 'react';
import type { Entity as EntityType } from '../game/types';
import { hexToPixel } from '../game/hex';
import { TILE_SIZE } from '../game/constants';

interface EntityProps {
    entity: EntityType;
}

export const Entity: React.FC<EntityProps> = ({ entity }) => {
    const { x, y } = hexToPixel(entity.position, TILE_SIZE);

    const isPlayer = entity.type === 'player';

    return (
        <g transform={`translate(${x},${y})`} style={{ transition: 'transform 0.3s ease-in-out' }}>
            <circle
                r={TILE_SIZE * 0.6}
                fill={isPlayer ? '#3b82f6' : '#ef4444'}
                stroke="#fff"
                strokeWidth="2"
            />
            <text x="0" y="0" textAnchor="middle" dy=".3em" fill="white" fontWeight="bold">
                {isPlayer ? 'P' : 'E'}
            </text>
            {/* HP Bar tiny */}
            <rect x={-10} y={15} width={20} height={4} fill="#555" />
            <rect x={-10} y={15} width={(20 * entity.hp) / entity.maxHp} height={4} fill={isPlayer ? '#60a5fa' : '#f87171'} />
        </g>
    );
};
