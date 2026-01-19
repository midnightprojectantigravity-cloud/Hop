import React, { useMemo, useState, useEffect } from 'react';
import type { GameState, Point } from '@hop/engine';
import { hexDistance, hexEquals, isTileInDiamond, hexToPixel } from '@hop/engine';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import { TILE_SIZE, getSkillRange } from '@hop/engine';
import PreviewOverlay from './PreviewOverlay';
import { JuiceManager } from './JuiceManager';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    selectedSkillId: string | null;
    showMovementRange: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onMove, selectedSkillId, showMovementRange }) => {
    const [isShaking, setIsShaking] = useState(false);

    // Filter cells based on dynamic diamond geometry
    const cells = useMemo(() => {
        let hexes = gameState.rooms?.[0]?.hexes;

        // Fallback: If rooms are missing (e.g. legacy saves or engine bug), generate the full diamond grid
        if (!hexes || hexes.length === 0) {
            hexes = [];
            for (let q = 0; q < gameState.gridWidth; q++) {
                for (let r = 0; r < gameState.gridHeight; r++) {
                    hexes.push({ q, r, s: -q - r });
                }
            }
        }

        return hexes.filter(h =>
            isTileInDiamond(h.q, h.r, gameState.gridWidth, gameState.gridHeight)
        );
    }, [gameState.rooms, gameState.gridWidth, gameState.gridHeight]);

    // Handle board shake
    useEffect(() => {
        const shakeEvent = gameState.visualEvents?.find(e => e.type === 'shake');
        if (shakeEvent) {
            setIsShaking(true);
            const timer = setTimeout(() => setIsShaking(false), 200);
            return () => clearTimeout(timer);
        }
    }, [gameState.visualEvents]);

    // Dynamically calculate the Bounding Box of the actual hexes to maximize size
    const bounds = useMemo(() => {
        if (cells.length === 0) return { minX: 0, minY: 0, width: 100, height: 100 };

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        cells.forEach(hex => {
            const { x, y } = hexToPixel(hex, TILE_SIZE);
            // Add half-tile buffer for the hex corners
            minX = Math.min(minX, x - TILE_SIZE);
            minY = Math.min(minY, y - TILE_SIZE);
            maxX = Math.max(maxX, x + TILE_SIZE);
            maxY = Math.max(maxY, y + TILE_SIZE);
        });

        return {
            minX,
            minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }, [cells]);

    // Use the helper to calculate real range (including upgrades)
    const selectedSkillRange = selectedSkillId ? getSkillRange(gameState.player, selectedSkillId) : 0;

    return (
        <div className={`w-full h-full flex justify-center items-center overflow-hidden transition-transform duration-75 ${isShaking ? 'animate-shake' : ''}`}>
            <svg
                width="100%"
                height="100%"
                viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
                preserveAspectRatio="xMidYMid meet"
                shapeRendering="geometricPrecision"
                className="max-h-full max-w-full"
            >
                <g>
                    <PreviewOverlay gameState={gameState} selectedSkillId={selectedSkillId} showMovementRange={showMovementRange} />
                    {cells.map((hex) => {
                        const dist = hexDistance(hex, gameState.player.position);
                        const isWall = gameState.wallPositions?.some(wp => hexEquals(wp, hex));
                        const isLava = gameState.lavaPositions.some(lp => hexEquals(lp, hex));

                        // Contextual Highlights:
                        // 1. If movement range toggle is on, show distance 1
                        const isMoveHighlight = showMovementRange && dist === 1;

                        // 2. If a skill is selected, show its specific range
                        let isSkillHighlight = !!(selectedSkillId && dist > 0 && dist <= selectedSkillRange);

                        // Enforce straight line for Spear Throw
                        if (selectedSkillId === 'SPEAR_THROW') {
                            const isInLine = (hex.q === gameState.player.position.q) ||
                                (hex.r === gameState.player.position.r) ||
                                (hex.s === gameState.player.position.s);
                            isSkillHighlight = isSkillHighlight && isInLine;
                        }

                        // Final highlight state (respects walkable constraint: !isWall)
                        let showRangeHighlight = (isMoveHighlight || isSkillHighlight) && !isWall;

                        // Target restrictions:
                        // Spear Throw, Jump, and Lunge cannot target lava
                        if ((selectedSkillId === 'SPEAR_THROW' || selectedSkillId === 'JUMP' || selectedSkillId === 'LUNGE') && isLava) {
                            showRangeHighlight = false;
                        }

                        const isTargeted = gameState.enemies.some(e => e.intentPosition && hexEquals(e.intentPosition, hex));
                        const isStairs = hexEquals(hex, gameState.stairsPosition);
                        const isShrine = gameState.shrinePosition && hexEquals(hex, gameState.shrinePosition);

                        return (
                            <HexTile
                                key={`${hex.q},${hex.r}`}
                                hex={hex}
                                onClick={() => onMove(hex)}
                                isValidMove={showRangeHighlight}
                                isTargeted={isTargeted}
                                isStairs={isStairs}
                                isLava={isLava}
                                isShrine={isShrine}
                                isWall={isWall}
                            />
                        );
                    })}
                </g>
                <g>
                    {/* Spear Trail */}
                    {gameState.lastSpearPath && gameState.lastSpearPath.length >= 2 && (() => {
                        const pathPoints = gameState.lastSpearPath.map(p => hexToPixel(p, TILE_SIZE));
                        const d = pathPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                        return <path d={d} stroke="rgba(255, 255, 255, 0.15)" strokeWidth="2" fill="none" strokeDasharray="4 2" strokeLinecap="round" />;
                    })()}

                    {/* Spear on ground */}
                    {gameState.spearPosition && (
                        <Entity entity={{
                            id: 'spear',
                            type: 'player',
                            subtype: 'footman',
                            position: gameState.spearPosition,
                            hp: 1, maxHp: 1,
                            statusEffects: [],
                            temporaryArmor: 0,
                            activeSkills: [],
                            speed: 0,
                            factionId: 'player'
                        }} isSpear={true} />
                    )}
                    <Entity entity={gameState.player} />
                    {gameState.enemies.map(e => <Entity key={e.id} entity={e} />)}
                    {gameState.dyingEntities?.map(e => <Entity key={`dying-${e.id}-${gameState.turnNumber}`} entity={e} isDying={true} />)}

                    {/* Juice Effects Layer (Top-most) */}
                    <JuiceManager visualEvents={gameState.visualEvents || []} />
                </g>
            </svg>
        </div>
    );
};
