import React, { useEffect, useState } from 'react';
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
    assetHref?: string;
    interactionOnly?: boolean;
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

const getWallReliefPoints = (size: number) => {
    const body = [
        [-0.60, 0.42], [-0.50, 0.15], [-0.34, -0.18], [-0.16, -0.36], [0.00, -0.62],
        [0.12, -0.42], [0.30, -0.20], [0.48, 0.10], [0.60, 0.40], [0.40, 0.48], [-0.48, 0.48]
    ];
    const leftFace = [
        [-0.48, 0.48], [-0.60, 0.42], [-0.34, -0.18], [-0.18, -0.24], [-0.28, 0.28]
    ];
    const rightFace = [
        [0.60, 0.40], [0.40, 0.48], [0.20, 0.28], [0.30, -0.20], [0.48, 0.10]
    ];
    const ridgeA = [
        [-0.34, -0.18], [-0.16, -0.36], [0.00, -0.62], [0.12, -0.42], [0.30, -0.20]
    ];
    const ridgeB = [
        [-0.46, 0.10], [-0.30, -0.12], [-0.10, -0.24], [0.00, -0.40]
    ];
    const toPoints = (pairs: number[][]): string =>
        pairs.map(([px, py]) => `${(px * size).toFixed(2)},${(py * size).toFixed(2)}`).join(' ');
    return {
        body: toPoints(body),
        leftFace: toPoints(leftFace),
        rightFace: toPoints(rightFace),
        ridgeA: toPoints(ridgeA),
        ridgeB: toPoints(ridgeB)
    };
};

const HexTileComponent: React.FC<HexTileProps> = ({
    hex, onClick, isValidMove, isTargeted, isStairs, isLava, isShrine, isWall, isFire, onMouseEnter, assetHref, interactionOnly
}) => {
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [assetHref]);

    const { x, y } = hexToPixel(hex, TILE_SIZE);
    const showDebugCoords = SHOW_DEBUG_HEX_COORDS();
    const tilePoints = getHexCorners(TILE_SIZE - 2);
    const wallRelief = getWallReliefPoints(TILE_SIZE - 2);
    const clipId = `hex-clip-${hex.q}-${hex.r}-${hex.s}`;

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
    if (interactionOnly) {
        fill = 'transparent';
        stroke = 'rgba(255,255,255,0.10)';
    }

    if (isValidMove) {
        stroke = 'rgba(255,255,255,0.78)';
        cursor = 'pointer';
    }
    if (isTargeted) {
        stroke = '#f97316';
    }
    const showTileImage = Boolean(assetHref) && !interactionOnly && !imageFailed;

    return (
        <g transform={`translate(${x},${y})`}
            onClick={() => onClick(hex)}
            onMouseEnter={() => onMouseEnter?.(hex)}
            style={{ cursor }}
            className="hex-tile transition-colors duration-200"
        >
            {/* Draw Wall underside for depth when using image-backed tiles */}
            {isWall && showTileImage && (
                <polygon
                    points={getHexCorners(TILE_SIZE - 2)}
                    fill="#111827"
                    transform="translate(0, 4)"
                />
            )}

            {/* Main tile polygon */}
            {!showTileImage && (
                isWall ? (
                    <g data-wall-fallback="relief">
                        <ellipse
                            cx="0"
                            cy={TILE_SIZE * 0.56}
                            rx={TILE_SIZE * 0.56}
                            ry={TILE_SIZE * 0.18}
                            fill="rgba(3,7,18,0.55)"
                        />
                        <polygon
                            points={tilePoints}
                            fill="#0f172a"
                            transform="translate(0, 5)"
                            opacity="0.92"
                        />
                        <polygon
                            points={tilePoints}
                            fill="#1f2937"
                            transform="translate(0, 2)"
                            opacity="0.98"
                        />
                        <polygon points={tilePoints} fill="#273447" />
                        <polygon points={wallRelief.body} fill="#4b5563" opacity="0.96" />
                        <polygon points={wallRelief.leftFace} fill="#6b7280" opacity="0.9" />
                        <polygon points={wallRelief.rightFace} fill="#374151" opacity="0.95" />
                        <polyline
                            points={wallRelief.ridgeA}
                            fill="none"
                            stroke="rgba(229,231,235,0.55)"
                            strokeWidth="1.1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <polyline
                            points={wallRelief.ridgeB}
                            fill="none"
                            stroke="rgba(17,24,39,0.58)"
                            strokeWidth="1"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                        <polygon
                            points={tilePoints}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={isTargeted || isValidMove ? "2" : "1"}
                        />
                    </g>
                ) : (
                    <polygon
                        points={tilePoints}
                        fill={fill}
                        stroke={stroke}
                        strokeWidth={isTargeted || isValidMove ? "2" : "1"}
                    />
                )
            )}

            {showTileImage && (
                <>
                    <defs>
                        <clipPath id={clipId}>
                            <polygon points={tilePoints} />
                        </clipPath>
                    </defs>
                    <image
                        href={assetHref}
                        x={-TILE_SIZE}
                        y={-(TILE_SIZE * 0.866)}
                        width={TILE_SIZE * 2}
                        height={TILE_SIZE * 1.732}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath={`url(#${clipId})`}
                        onError={() => setImageFailed(true)}
                    />
                    <polygon
                        points={tilePoints}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={isTargeted || isValidMove ? "2" : "1"}
                    />
                </>
            )}

            {/* Lava bubbles with animation */}
            {isLava && !interactionOnly && (
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
            {isFire && !interactionOnly && (
                <g className="fire-embers">
                    <circle cx="-6" cy="4" r="2" fill="#fbbf24" opacity="0.75" style={{ animation: `lavaBubble 1.6s ease-in-out 0s infinite` }} />
                    <circle cx="4" cy="-6" r="1.5" fill="#fcd34d" opacity="0.75" style={{ animation: `lavaBubble 1.4s ease-in-out 0.5s infinite` }} />
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
        && prev.onClick === next.onClick
        && prev.onMouseEnter === next.onMouseEnter
        && prev.isCenter === next.isCenter
        && prev.isSelected === next.isSelected
        && prev.isValidMove === next.isValidMove
        && prev.isTargeted === next.isTargeted
        && prev.isStairs === next.isStairs
        && prev.isLava === next.isLava
        && prev.isShrine === next.isShrine
        && prev.isWall === next.isWall
        && prev.isFire === next.isFire
        && prev.assetHref === next.assetHref
        && prev.interactionOnly === next.interactionOnly;
});
