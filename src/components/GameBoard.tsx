import React from 'react';
import type { GameState, Point } from '../game/types';
import { hexDistance, hexEquals } from '../game/hex';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from '../game/constants';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    onThrowSpear: (hex: Point) => void;
    onLeap: (hex: Point) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onMove, onThrowSpear, onLeap }) => {
    // Collect all hexes from rooms (or just use gameState.rooms[0].hexes)
    const cells = gameState.rooms?.[0]?.hexes || [];

    // Calculate ViewBox for a 9x11 grid
    // Width: (9 columns * 1.5 * size)
    // Height: (11 rows * sqrt(3) * size)
    const viewWidth = (GRID_WIDTH + 1) * 1.5 * TILE_SIZE;
    const viewHeight = (GRID_HEIGHT + 1) * Math.sqrt(3) * TILE_SIZE;

    // Offset viewbox to center the grid
    const offsetX = -TILE_SIZE;
    const offsetY = -TILE_SIZE;

    return (
        <div className="flex justify-center items-center p-8 bg-[#1f2937]/50 rounded-xl">
            <svg width={800} height={600} viewBox={`${offsetX} ${offsetY} ${viewWidth} ${viewHeight}`}>
                <g>
                    {cells.map((hex) => {
                        const dist = hexDistance(hex, gameState.player.position);
                        const isValidMove = dist === 1;
                        const isTargeted = gameState.enemies.some(e => e.intentPosition && hexEquals(e.intentPosition, hex));
                        const isStairs = hexEquals(hex, gameState.stairsPosition);
                        const isLava = gameState.lavaPositions.some(lp => hexEquals(lp, hex));
                        const isWall = gameState.wallPositions?.some(wp => hexEquals(wp, hex));
                        const isShrine = gameState.shrinePosition && hexEquals(hex, gameState.shrinePosition);

                        const handleClick = () => {
                            if (dist === 1 && !isWall) {
                                onMove(hex);
                            } else if (dist === 2 && gameState.upgrades.includes('LEAP')) {
                                onLeap(hex);
                            } else if (gameState.hasSpear && dist > 1 && dist <= 4 && !isWall) {
                                onThrowSpear(hex);
                            }
                        };

                        return (
                            <HexTile
                                key={`${hex.q},${hex.r}`}
                                hex={hex}
                                onClick={handleClick}
                                isValidMove={isValidMove && !isWall}
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
                    {/* Spear on ground */}
                    {gameState.spearPosition && (
                        <Entity entity={{
                            id: 'spear',
                            type: 'player', // Using player type for coloring for now
                            subtype: 'footman',
                            position: gameState.spearPosition,
                            hp: 1, maxHp: 1
                        }} isSpear={true} />
                    )}
                    <Entity entity={gameState.player} />
                    {gameState.enemies.map(e => <Entity key={e.id} entity={e} />)}
                </g>
            </svg>
        </div>
    );
};
