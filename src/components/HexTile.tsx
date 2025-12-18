import React from 'react';
import { hexToPixel } from '../game/hex';
import type { Point } from '../game/types';
import { TILE_SIZE } from '../game/constants';

interface HexTileProps {
    hex: Point;
    onClick: (hex: Point) => void;
    isCenter?: boolean;
    isSelected?: boolean; // e.g. for mouse hover highlights or valid moves
    isValidMove?: boolean;
}

const getHexCorners = (size: number): string => {
    let points = [];
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const x = size * Math.cos(angle_rad);
        const y = size * Math.sin(angle_rad);
        points.push(`${x},${y}`);
    }
    return points.join(' ');
};

export const HexTile: React.FC<HexTileProps> = ({ hex, onClick, isCenter, isValidMove }) => {
    const { x, y } = hexToPixel(hex, TILE_SIZE);

    // Determine color
    let fill = '#333';
    let stroke = '#555';

    if (isCenter) fill = '#444';
    if (isValidMove) {
        fill = '#2a4a3a';
        stroke = '#4ade80';
    }

    return (
        <g transform={`translate(${x},${y})`}
            onClick={() => onClick(hex)}
            style={{ cursor: isValidMove ? 'pointer' : 'default' }}
            className="transition-colors duration-200"
        >
            <polygon
                points={getHexCorners(TILE_SIZE - 2)} // -2 for margin
                fill={fill}
                stroke={stroke}
                strokeWidth="2"
            />
            {/* Debug Coords */}
            <text x="0" y="0" textAnchor="middle" fill="#666" fontSize="10" dy=".3em" pointerEvents="none">
                {`${hex.q},${hex.r}`}
            </text>
        </g>
    );
};
