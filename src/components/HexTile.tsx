import React from 'react';
import { hexToPixel } from '../game/hex';
import type { Point } from '../game/types';
import { TILE_SIZE, COLORS } from '../game/constants';

interface HexTileProps {
    hex: Point;
    onClick: (hex: Point) => void;
    isCenter?: boolean;
    isSelected?: boolean;
    isValidMove?: boolean;
    isTargeted?: boolean;
    isStairs?: boolean;
    isLava?: boolean;
    isShrine?: boolean;
    isWall?: boolean;
}

const getHexCorners = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        // Flat-top hex angles: 0, 60, 120, 180, 240, 300
        const angle_deg = 60 * i;
        const angle_rad = Math.PI / 180 * angle_deg;
        const x = size * Math.cos(angle_rad);
        const y = size * Math.sin(angle_rad);
        points.push(`${x},${y}`);
    }
    return points.join(' ');
};

export const HexTile: React.FC<HexTileProps> = ({
    hex, onClick, isValidMove, isTargeted, isStairs, isLava, isShrine, isWall
}) => {
    const { x, y } = hexToPixel(hex, TILE_SIZE);

    // Color selection from design doc
    let fill: string = COLORS.floor;
    let stroke = 'rgba(0,0,0,0.2)';
    let cursor = 'default';

    if (isWall) {
        fill = COLORS.wall;
        stroke = '#1f2937';
    } else if (isLava) {
        fill = COLORS.lava;
        stroke = '#7f1d1d';
    } else if (isStairs) {
        fill = COLORS.portal;
        stroke = '#000000';
    } else if (isShrine) {
        fill = COLORS.shrine;
        stroke = '#c2410c';
    }

    if (isValidMove) {
        stroke = '#ffffff';
        cursor = 'pointer';
    }
    if (isTargeted) {
        stroke = '#ff0000';
    }

    return (
        <g transform={`translate(${x},${y})`}
            onClick={() => onClick(hex)}
            style={{ cursor }}
            className="hex-tile transition-colors duration-200"
        >
            {/* Draw Wall with slight offset for 3D look if it's a wall */}
            {isWall && (
                <polygon
                    points={getHexCorners(TILE_SIZE - 2)}
                    fill="#111827"
                    transform="translate(0, 4)"
                />
            )}
            <polygon
                points={getHexCorners(TILE_SIZE - 2)}
                fill={fill}
                stroke={stroke}
                strokeWidth={isTargeted || isValidMove ? "3" : "1"}
            />
            {/* Debug Coords - optional, let's keep it dim */}
            <text x="0" y="0" textAnchor="middle" fill="rgba(0,0,0,0.15)" fontSize="8" dy=".3em" pointerEvents="none">
                {`${hex.q},${hex.r}`}
            </text>
        </g>
    );
};
