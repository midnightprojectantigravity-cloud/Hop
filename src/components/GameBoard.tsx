import React from 'react';
import type { GameState, Point } from '../game/types';
import { hexDistance, hexEquals } from '../game/hex';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import { TILE_SIZE, GRID_WIDTH, GRID_HEIGHT } from '../game/constants';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    selectedSkillId: string | null;
    showMovementRange: boolean;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onMove, selectedSkillId, showMovementRange }) => {
    // Collect all hexes from rooms (or just use gameState.rooms[0].hexes)
    const cells = gameState.rooms?.[0]?.hexes || [];

    // Find the current skill's range if one is selected
    const selectedSkill = selectedSkillId
        ? gameState.player.activeSkills?.find(s => s.id === selectedSkillId)
        : null;

    // Calculate ViewBox for the "Flat-Top Diamond" geometry
    const viewWidth = (GRID_WIDTH + 1) * 1.5 * TILE_SIZE;
    const viewHeight = (GRID_HEIGHT + (GRID_WIDTH / 2) + 1) * Math.sqrt(3) * TILE_SIZE;

    // Offset viewbox to center the leaning grid
    const offsetX = -TILE_SIZE;
    const offsetY = -TILE_SIZE;


    return (
        <div className="flex justify-center items-center p-8 bg-[#1f2937]/50 rounded-xl">
            <svg width={800} height={600} viewBox={`${offsetX} ${offsetY} ${viewWidth} ${viewHeight}`} shapeRendering="geometricPrecision">
                <g>
                    {cells.map((hex) => {
                        const dist = hexDistance(hex, gameState.player.position);
                        const isWall = gameState.wallPositions?.some(wp => hexEquals(wp, hex));

                        // Contextual Highlights:
                        // 1. If movement range toggle is on, show distance 1
                        const isMoveHighlight = showMovementRange && dist === 1;

                        // 2. If a skill is selected, show its specific range
                        let isSkillHighlight = !!(selectedSkill && dist > 0 && dist <= selectedSkill.range);

                        // Enforce straight line for Spear Throw
                        if (selectedSkill?.id === 'SPEAR_THROW') {
                            const isInLine = (hex.q === gameState.player.position.q) ||
                                (hex.r === gameState.player.position.r) ||
                                (hex.s === gameState.player.position.s);
                            isSkillHighlight = isSkillHighlight && isInLine;
                        }

                        // Final highlight state (respects walkable constraint: !isWall)
                        const showRangeHighlight = (isMoveHighlight || isSkillHighlight) && !isWall;

                        const isTargeted = gameState.enemies.some(e => e.intentPosition && hexEquals(e.intentPosition, hex));
                        const isStairs = hexEquals(hex, gameState.stairsPosition);
                        const isLava = gameState.lavaPositions.some(lp => hexEquals(lp, hex));
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
