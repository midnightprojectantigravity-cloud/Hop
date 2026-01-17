import React from 'react';
import { hexToPixel, type Point, TILE_SIZE, COLORS } from '@hop/engine';

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

// Unique ID generator for SVG defs (avoid conflicts between tiles)
let tileIdCounter = 0;
const getTileId = () => `tile-${++tileIdCounter}`;

// Lava bubble positions (pre-calculated for consistency)
const LAVA_BUBBLES = [
    { cx: -8, cy: -6, r: 3, delay: 0 },
    { cx: 6, cy: 2, r: 2.5, delay: 0.3 },
    { cx: -3, cy: 8, r: 2, delay: 0.6 },
    { cx: 10, cy: -4, r: 2, delay: 0.9 },
];

export const HexTile: React.FC<HexTileProps> = ({
    hex, onClick, isValidMove, isTargeted, isStairs, isLava, isShrine, isWall
}) => {
    const { x, y } = hexToPixel(hex, TILE_SIZE);
    const tileId = React.useMemo(() => getTileId(), []);

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
            {/* SVG Defs for gradients and filters */}
            <defs>
                {/* Lava gradient with glow */}
                {isLava && (
                    <radialGradient id={`lava-grad-${tileId}`} cx="50%" cy="50%" r="70%">
                        <stop offset="0%" stopColor="#dc2626" />
                        <stop offset="60%" stopColor="#991b1b" />
                        <stop offset="100%" stopColor="#450a0a" />
                    </radialGradient>
                )}
                {/* Shrine crystal gradient */}
                {isShrine && (
                    <linearGradient id={`shrine-grad-${tileId}`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fdba74" />
                        <stop offset="50%" stopColor="#f97316" />
                        <stop offset="100%" stopColor="#c2410c" />
                    </linearGradient>
                )}
                {/* Floor texture pattern */}
                {!isWall && !isLava && !isStairs && !isShrine && (
                    <pattern id={`floor-texture-${tileId}`} patternUnits="userSpaceOnUse" width="8" height="8">
                        <rect width="8" height="8" fill={COLORS.floor} />
                        <circle cx="2" cy="2" r="0.5" fill="rgba(0,0,0,0.1)" />
                        <circle cx="6" cy="6" r="0.5" fill="rgba(255,255,255,0.05)" />
                    </pattern>
                )}
            </defs>

            {/* Draw Wall with slight offset for 3D look if it's a wall */}
            {isWall && (
                <polygon
                    points={getHexCorners(TILE_SIZE - 2)}
                    fill="#111827"
                    transform="translate(0, 4)"
                />
            )}

            {/* Main tile polygon */}
            <polygon
                points={getHexCorners(TILE_SIZE - 2)}
                fill={isLava ? `url(#lava-grad-${tileId})` : fill}
                stroke={stroke}
                strokeWidth={isTargeted || isValidMove ? "3" : "1"}
            />

            {/* Lava bubbles with animation */}
            {isLava && (
                <g className="lava-bubbles">
                    {LAVA_BUBBLES.map((bubble, i) => (
                        <circle
                            key={i}
                            cx={bubble.cx}
                            cy={bubble.cy}
                            r={bubble.r}
                            fill="#fbbf24"
                            opacity="0.7"
                            style={{
                                animation: `lavaBubble 2s ease-in-out ${bubble.delay}s infinite`,
                            }}
                        />
                    ))}
                    {/* Glowing edge effect */}
                    <polygon
                        points={getHexCorners(TILE_SIZE - 4)}
                        fill="none"
                        stroke="#f97316"
                        strokeWidth="2"
                        opacity="0.5"
                        style={{ filter: 'blur(2px)' }}
                    />
                </g>
            )}

            {/* Shrine crystal icon */}
            {isShrine && (
                <g className="shrine-icon">
                    {/* Crystal base */}
                    <polygon
                        points="0,-18 8,-4 5,12 -5,12 -8,-4"
                        fill={`url(#shrine-grad-${tileId})`}
                        stroke="#fff"
                        strokeWidth="1"
                        opacity="0.9"
                    />
                    {/* Crystal shine */}
                    <polygon
                        points="-2,-14 2,-14 1,-2 -1,-2"
                        fill="rgba(255,255,255,0.6)"
                    />
                    {/* Glow effect */}
                    <circle
                        cx="0"
                        cy="0"
                        r="14"
                        fill="none"
                        stroke="#fdba74"
                        strokeWidth="2"
                        opacity="0.4"
                        style={{ animation: 'shrineGlow 2s ease-in-out infinite' }}
                    />
                </g>
            )}

            {/* Stairs icon */}
            {isStairs && (
                <g className="stairs-icon">
                    {/* Stair steps */}
                    <rect x="-12" y="6" width="8" height="4" fill="#1f2937" rx="1" />
                    <rect x="-6" y="2" width="8" height="4" fill="#374151" rx="1" />
                    <rect x="0" y="-2" width="8" height="4" fill="#4b5563" rx="1" />
                    <rect x="6" y="-6" width="8" height="4" fill="#6b7280" rx="1" />
                    {/* Arrow indicator */}
                    <path
                        d="M 2 -14 L 2 -20 L -4 -20 L 2 -26 L 8 -20 L 2 -20"
                        fill="#22c55e"
                        stroke="#16a34a"
                        strokeWidth="1"
                    />
                </g>
            )}

            {/* Debug Coords - optional, let's keep it dim */}
            <text x="0" y="0" textAnchor="middle" fill="rgba(0,0,0,0.15)" fontSize="8" dy=".3em" pointerEvents="none">
                {`${hex.q},${hex.r}`}
            </text>
        </g>
    );
};
