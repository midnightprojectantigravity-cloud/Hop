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
    isFire?: boolean;
    onMouseEnter?: (hex: Point) => void;
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

const SHOW_DEBUG_HEX_COORDS = (): boolean => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).__HOP_DEBUG_HEX_COORDS);
};

const LAVA_BUBBLES = [
    { cx: -8, cy: -6, r: 3, delay: 0 },
    { cx: 6, cy: 2, r: 2.5, delay: 0.3 },
    { cx: -3, cy: 8, r: 2, delay: 0.6 }
];

const HexTileComponent: React.FC<HexTileProps> = ({
    hex, onClick, isValidMove, isTargeted, isStairs, isLava, isShrine, isWall, isFire, onMouseEnter
}) => {
    const { x, y } = hexToPixel(hex, TILE_SIZE);
    const showDebugCoords = SHOW_DEBUG_HEX_COORDS();

    // Color selection from design doc
    let fill: string = COLORS.floor;
    let stroke = 'rgba(0,0,0,0.2)';
    let cursor = 'default';

    if (isWall) {
        fill = COLORS.wall;
        stroke = '#1f2937';
    } else if (isLava) {
        fill = '#7f1d1d';
        stroke = '#7f1d1d';
    } else if (isFire) {
        fill = '#7c2d12';
        stroke = '#ea580c';
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
            onMouseEnter={() => onMouseEnter?.(hex)}
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

            {/* Main tile polygon */}
            <polygon
                points={getHexCorners(TILE_SIZE - 2)}
                fill={fill}
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
                        strokeWidth="1"
                        opacity="0.35"
                    />
                </g>
            )}

            {/* Fire bubbles/embers */}
            {isFire && (
                <g className="fire-embers">
                    <circle cx="-6" cy="4" r="2" fill="#fbbf24" opacity="0.75" style={{ animation: `lavaBubble 1.6s ease-in-out 0s infinite` }} />
                    <circle cx="4" cy="-6" r="1.5" fill="#fcd34d" opacity="0.75" style={{ animation: `lavaBubble 1.4s ease-in-out 0.5s infinite` }} />
                </g>
            )}

            {/* Shrine crystal icon */}
            {isShrine && (
                <g className="shrine-icon">
                    {/* Crystal base */}
                    <polygon
                        points="0,-18 8,-4 5,12 -5,12 -8,-4"
                        fill="#f97316"
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

            {showDebugCoords && (
                <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    fill="rgba(0,0,0,0.15)"
                    fontSize="8"
                    dy=".3em"
                    pointerEvents="none"
                >
                    {`${hex.q},${hex.r}`}
                </text>
            )}
        </g>
    );
};

export const HexTile = React.memo(HexTileComponent, (prev, next) => {
    return prev.hex.q === next.hex.q
        && prev.hex.r === next.hex.r
        && prev.hex.s === next.hex.s
        && prev.isValidMove === next.isValidMove
        && prev.isTargeted === next.isTargeted
        && prev.isStairs === next.isStairs
        && prev.isLava === next.isLava
        && prev.isShrine === next.isShrine
        && prev.isWall === next.isWall
        && prev.isFire === next.isFire;
});
