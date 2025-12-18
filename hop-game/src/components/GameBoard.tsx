import React from 'react';
import type { GameState, Point } from '../game/types';
import { getGridCells, hexDistance } from '../game/hex';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import { TILE_SIZE } from '../game/constants';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onMove }) => {
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
                    {cells.map((hex, i) => {
                        const dist = hexDistance(hex, gameState.player.position);
                        const isValidMove = dist === 1;

                        return (
                            <HexTile
                                key={`${hex.q},${hex.r}`}
                                hex={hex}
                                onClick={onMove}
                                isCenter={hex.q === 0 && hex.r === 0}
                                isValidMove={isValidMove}
                            />
                        );
                    })}
                </g>
                <g>
                    <Entity entity={gameState.player} />
                    {gameState.enemies.map(e => <Entity key={e.id} entity={e} />)}
                </g>
            </svg>
        </div>
    );
};
