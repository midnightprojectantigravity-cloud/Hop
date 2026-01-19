import React, { useMemo } from 'react';
import type { GameState, Point } from '@hop/engine';
import { hexToPixel, getHexLine, hexAdd, scaleVector, hexEquals, isHexInRectangularGrid, DIRECTIONS, TILE_SIZE, getMovementRange, COMPOSITIONAL_SKILLS, getSkillRange } from '@hop/engine';

interface PreviewOverlayProps {
    gameState: GameState;
    selectedSkillId: string | null;
    showMovementRange: boolean;
}

export const PreviewOverlay: React.FC<PreviewOverlayProps> = ({ gameState, selectedSkillId, showMovementRange }) => {
    const playerPos = gameState.player.position;

    const movementTiles = useMemo(() => {
        if (!showMovementRange) return [] as Point[];
        const isSkirmisher = gameState.player.archetype === 'SKIRMISHER';
        if (isSkirmisher) {
            // Skirmisher basic move IS the dash range
            const range = 4;
            const valid: Point[] = [];
            for (let d = 0; d < 6; d++) {
                for (let i = 1; i <= range; i++) {
                    const p = hexAdd(playerPos, scaleVector(d, i));
                    if (!isHexInRectangularGrid(p, gameState.gridWidth, gameState.gridHeight)) break;
                    const isWall = gameState.wallPositions?.some(w => hexEquals(w, p));
                    if (isWall) break;
                    valid.push(p);
                }
            }
            return valid;
        }
        const movePoints = (gameState.player.movementSpeed ?? 1);
        return getMovementRange(gameState, playerPos, movePoints);
    }, [gameState, showMovementRange, playerPos]);

    const threatTiles = useMemo(() => {
        // Adjacent 6 tiles representing auto-attack reach
        const tiles: Point[] = [];
        for (const d of DIRECTIONS) {
            const p = hexAdd(playerPos, d);
            if (isHexInRectangularGrid(p, gameState.gridWidth, gameState.gridHeight)) tiles.push(p);
        }
        return tiles;
    }, [playerPos, gameState.gridWidth, gameState.gridHeight]);

    const skillTargets = useMemo(() => {
        if (!selectedSkillId) return [] as Array<{ p: Point; isEnemy: boolean; isWall: boolean; blocked: boolean; atMaxRange: boolean }>;
        const def = COMPOSITIONAL_SKILLS[selectedSkillId];
        const range = def?.baseVariables?.range ?? getSkillRange(gameState.player, selectedSkillId);

        // Generate axial underlay (star) and mark valid targets using skill's getValidTargets when available.
        const validSet: Point[] = def?.getValidTargets ? def.getValidTargets(gameState, playerPos) : [];

        const results: Array<{ p: Point; isEnemy: boolean; isWall: boolean; blocked: boolean; isValidTarget: boolean; isMaxRange: boolean }> = [];

        for (let d = 0; d < 6; d++) {
            for (let i = 1; i <= range; i++) {
                const p = hexAdd(playerPos, scaleVector(d, i));
                if (!isHexInRectangularGrid(p, gameState.gridWidth, gameState.gridHeight)) break;

                const isWall = !!gameState.wallPositions?.some(w => hexEquals(w, p));
                const isEnemy = !!gameState.enemies.some(e => hexEquals(e.position, p));

                // LoS check for interior (between origin and p)
                const line = getHexLine(playerPos, p);
                const interior = line.slice(1, -1);
                const interiorBlocked = interior.some(iP =>
                    gameState.wallPositions?.some(w => hexEquals(w, iP)) ||
                    gameState.enemies.some(e => hexEquals(e.position, iP))
                );

                // Determine if this tile is a valid target according to the skill
                let isValidTarget = false;
                if (def?.getValidTargets) {
                    isValidTarget = validSet.some(v => hexEquals(v, p));
                } else {
                    // fallback rules (keep axial semantics): shield -> enemies only, grapple -> enemies or walls
                    if (selectedSkillId === 'SHIELD_THROW') isValidTarget = isEnemy;
                    else isValidTarget = isEnemy || isWall;
                }

                results.push({ p, isEnemy, isWall, blocked: interiorBlocked, isValidTarget, isMaxRange: i === range });

                if (isWall || isEnemy) break; // stop ray at wall or enemy
            }
        }

        return results;
    }, [gameState, selectedSkillId, playerPos]);

    return (
        <g>
            {showMovementRange && !selectedSkillId && movementTiles.map((hex) => {
                const { x, y } = hexToPixel(hex, TILE_SIZE);
                return <circle key={`mv-${hex.q}-${hex.r}`} cx={x} cy={y} r={TILE_SIZE * 0.55} fill="rgba(50,150,255,0.12)" stroke="rgba(50,150,255,0.2)" strokeWidth={1} />;
            })}

            {showMovementRange && !selectedSkillId && threatTiles.map((hex) => {
                const { x, y } = hexToPixel(hex, TILE_SIZE);
                return <circle key={`th-${hex.q}-${hex.r}`} cx={x} cy={y} r={TILE_SIZE * 0.45} fill="rgba(220,80,80,0.12)" stroke="rgba(220,80,80,0.18)" strokeWidth={1} />;
            })}

            {selectedSkillId && skillTargets.map((entry) => {
                const { p, blocked, isValidTarget, isMaxRange } = entry as any;
                const { x, y } = hexToPixel(p, TILE_SIZE);

                return (
                    <g key={`sk-${p.q}-${p.r}`}>
                        {/* Underlay: soft white path, dim if blocked */}
                        <circle cx={x} cy={y} r={TILE_SIZE * 0.45} fill={blocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'} />

                        {/* Valid target highlight: only when this tile is a valid target and not blocked */}
                        {isValidTarget && !blocked && (
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.62} fill={'none'} stroke={'rgba(220,50,50,0.95)'} strokeWidth={isMaxRange ? 3 : 1.5} />
                        )}

                        {/* Blocked valid target indicator (dashed outline) */}
                        {isValidTarget && blocked && (
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.62} fill="none" stroke="rgba(100,100,100,0.4)" strokeDasharray="4 3" strokeWidth={2} />
                        )}
                    </g>
                );
            })}
        </g>
    );
};

export default PreviewOverlay;
