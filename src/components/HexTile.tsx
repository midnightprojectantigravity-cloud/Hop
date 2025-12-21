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
    isTargeted?: boolean;
    isStairs?: boolean;
    isLava?: boolean;
    isShrine?: boolean;
}

const getHexCorners = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const x = size * Math.cos(angle_rad);
        const y = size * Math.sin(angle_rad);
        points.push(`${x},${y}`);
    }
    return points.join(' ');
};

export const HexTile: React.FC<HexTileProps> = ({ hex, onClick, isCenter, isValidMove, isTargeted, isStairs, isLava, isShrine }) => {
    const { x, y } = hexToPixel(hex, TILE_SIZE);

    // Determine color
    let fill = isStairs ? '#1e3a8a' : (isLava ? '#f97316' : (isShrine ? '#4f46e5' : '#333'));
    let stroke = isStairs ? '#3b82f6' : (isLava ? '#ea580c' : (isShrine ? '#818cf8' : '#555'));

    if (isCenter) fill = isStairs ? '#1e40af' : (isLava ? '#fb923c' : (isShrine ? '#4338ca' : '#444'));
    if (isValidMove) {
        fill = '#2a4a3a';
        stroke = '#4ade80';
    }
    if (isTargeted) {
        stroke = '#ef4444';
    }

    return (
        <g transform={`translate(${x},${y})`}
            onClick={() => onClick(hex)}
            style={{ cursor: isValidMove ? 'pointer' : 'default' }}
            className="hex-tile transition-colors duration-200"
        >
            <polygon
                points={getHexCorners(TILE_SIZE - 2)} // -2 for margin
                fill={fill}
                stroke={stroke}
                strokeWidth={isTargeted ? "4" : "2"}
            />
            {/* Debug Coords */}
            <text x="0" y="0" textAnchor="middle" fill="#666" fontSize="10" dy=".3em" pointerEvents="none">
                {`${hex.q},${hex.r}`}
            </text>
        </g>
    );
};
