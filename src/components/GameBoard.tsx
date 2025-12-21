import React from 'react';
import type { GameState, Point } from '../game/types';
import { getGridCells, hexDistance, hexEquals } from '../game/hex';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import { TILE_SIZE } from '../game/constants';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    onThrowSpear: (hex: Point) => void;
    onLeap: (hex: Point) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onMove, onThrowSpear, onLeap }) => {
    const cells = getGridCells(gameState.gridRadius);

    // Calculate ViewBox
    const width = (gameState.gridRadius * 2 + 2) * TILE_SIZE * 2;
    const height = (gameState.gridRadius * 2 + 2) * TILE_SIZE * 2;
    // Center 0,0 is in middle of SVG.
    // SVG viewBox x,y,w,h.
    // We want 0,0 to be center. so -w/2, -h/2.

    return (
        <div className="flex justify-center items-center p-8">
            <svg width={800} height={600} viewBox={`-${width / 2} -${height / 2} ${width} ${height}`}>
                <g>
                    {cells.map((hex) => {
                        const dist = hexDistance(hex, gameState.player.position);
                        const isValidMove = dist === 1;
                        const isTargeted = gameState.enemies.some(e => e.intentPosition && hexEquals(e.intentPosition, hex));
                        const isStairs = hexEquals(hex, gameState.stairsPosition);
                        const isLava = gameState.lavaPositions.some(lp => hexEquals(lp, hex));
                        const isShrine = gameState.shrinePosition && hexEquals(hex, gameState.shrinePosition);

                        const handleClick = () => {
                            if (dist === 1) {
                                onMove(hex);
                            } else if (dist === 2 && gameState.upgrades.includes('LEAP')) {
                                onLeap(hex);
                            } else if (gameState.hasSpear && dist > 1 && dist <= 4) {
                                onThrowSpear(hex);
                            }
                        };

                        return (
                            <HexTile
                                key={`${hex.q},${hex.r}`}
                                hex={hex}
                                onClick={handleClick}
                                isCenter={hex.q === 0 && hex.r === 0}
                                isValidMove={isValidMove || (dist === 2 && gameState.upgrades.includes('LEAP'))}
                                isTargeted={isTargeted}
                                isStairs={isStairs}
                                isLava={isLava}
                                isShrine={isShrine}
                            />
                        );
                    })}
                </g>
                <g>
                    {/* Spear on ground */}
                    {gameState.spearPosition && (
                        <Entity entity={{
                            id: 'spear',
                            type: 'enemy', // Using enemy type just to reuse component for now
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
