import React, { useMemo } from 'react';
import type { GameState, Point } from '@hop/engine';
import {
    hexToPixel, getHexLine, hexAdd, scaleVector, hexEquals, isHexInRectangularGrid,
    TILE_SIZE, COMPOSITIONAL_SKILLS, getSkillRange,
    getSkillAoE, UnifiedTileService
} from '@hop/engine';

interface PreviewOverlayProps {
    gameState: GameState;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    hoveredTile: Point | null;
}

export const PreviewOverlay: React.FC<PreviewOverlayProps> = ({ gameState, selectedSkillId, showMovementRange, hoveredTile }) => {
    const playerPos = gameState.player.position;

    // Tier 1: Movement Selection (Base State) - Aggregate primary movement skills (Walk / Dash)
    const movementTiles = useMemo(() => {
        if (!showMovementRange || selectedSkillId) return [] as Point[];

        // Define primary movement skills
        const movementSkillIds = ['BASIC_MOVE', 'DASH'];
        const validSet = new Set<string>();
        const results: Point[] = [];

        movementSkillIds.forEach(id => {
            const skill = gameState.player.activeSkills.find(s => s.id === id);
            if (skill) {
                const def = COMPOSITIONAL_SKILLS[id];
                if (def?.getValidTargets) {
                    const targets = def.getValidTargets(gameState, playerPos);
                    targets.forEach(p => {
                        const key = `${p.q},${p.r},${p.s}`;
                        if (!validSet.has(key)) {
                            validSet.add(key);
                            results.push(p);
                        }
                    });
                }
            }
        });

        // If no movement skills found (rare), fall back to BFS distance 1
        if (results.length === 0) {
            const neighbors = [
                { q: playerPos.q + 1, r: playerPos.r, s: playerPos.s - 1 },
                { q: playerPos.q + 1, r: playerPos.r - 1, s: playerPos.s },
                { q: playerPos.q, r: playerPos.r - 1, s: playerPos.s + 1 },
                { q: playerPos.q - 1, r: playerPos.r, s: playerPos.s + 1 },
                { q: playerPos.q - 1, r: playerPos.r + 1, s: playerPos.s },
                { q: playerPos.q, r: playerPos.r + 1, s: playerPos.s - 1 }
            ];
            return neighbors.filter(n => isHexInRectangularGrid(n, gameState.gridWidth, gameState.gridHeight));
        }

        return results;
    }, [gameState, showMovementRange, selectedSkillId, playerPos]);

    // Tier 2: Skill Targeting (Action State)
    const skillTargets = useMemo(() => {
        if (!selectedSkillId) return [] as Array<{ p: Point; isValidTarget: boolean; isBlocked: boolean; isWall: boolean; isEnemy: boolean }>;
        const def = COMPOSITIONAL_SKILLS[selectedSkillId];
        const range = def?.baseVariables?.range ?? getSkillRange(gameState.player, selectedSkillId);
        const validSet: Point[] = def?.getValidTargets ? def.getValidTargets(gameState, playerPos) : [];

        const results: Array<{ p: Point; isValidTarget: boolean; isBlocked: boolean; isWall: boolean; isEnemy: boolean }> = [];

        // Check if we should use axial generation or just the valid set
        const isLinear = selectedSkillId === 'DASH' || selectedSkillId === 'SPEAR_THROW' || selectedSkillId === 'SHIELD_THROW' || selectedSkillId === 'GRAPPLE_HOOK';

        if (isLinear) {
            for (let d = 0; d < 6; d++) {
                for (let i = 1; i <= range; i++) {
                    const p = hexAdd(playerPos, scaleVector(d, i));
                    if (!isHexInRectangularGrid(p, gameState.gridWidth, gameState.gridHeight)) break;

                    // FIXED: Use UnifiedTileService trait check instead of wallPositions array
                    const isWall = UnifiedTileService.isLosBlocking(gameState, p);
                    const isEnemy = !!gameState.enemies.some(e => hexEquals(e.position, p) && e.hp > 0);

                    const line = getHexLine(playerPos, p);
                    const interior = line.slice(1, -1);

                    // FIXED: Interior collision check using UnifiedTileService
                    const interiorBlocked = interior.some(iP =>
                        UnifiedTileService.isLosBlocking(gameState, iP) ||
                        gameState.enemies.some(e => e.hp > 0 && hexEquals(e.position, iP))
                    );

                    let isValidTarget = validSet.some(v => hexEquals(v, p));

                    results.push({ p, isValidTarget, isBlocked: interiorBlocked, isWall, isEnemy });

                    if (isWall || isEnemy) break;
                }
            }
        } else {
            // For circular or arbitrary area skills (Jump, Blast, Attack, Bash, etc.)
            validSet.forEach(p => {
                // FIXED: Map-based trait check
                const isWall = UnifiedTileService.isLosBlocking(gameState, p);
                const isEnemy = !!gameState.enemies.some(e => hexEquals(e.position, p) && e.hp > 0);
                results.push({ p, isValidTarget: true, isBlocked: false, isWall, isEnemy });
            });
        }

        return results;
    }, [gameState, selectedSkillId, playerPos]);

    // Tier 3: Hover Intent (Immediate Impact)
    const intentPreview = useMemo(() => {
        if (showMovementRange && hoveredTile && !selectedSkillId) {
            const isMoveTile = movementTiles.some(t => hexEquals(t, hoveredTile));
            if (isMoveTile) {
                const path = getHexLine(playerPos, hoveredTile);
                return { path, aoe: [], hasEnemy: false, target: hoveredTile };
            }
        }

        if (!selectedSkillId || !hoveredTile) return null;

        const targetEntry = skillTargets.find(t => hexEquals(t.p, hoveredTile));
        if (!targetEntry || !targetEntry.isValidTarget || targetEntry.isBlocked) return null;

        const path = getHexLine(playerPos, hoveredTile);
        const aoe = getSkillAoE(gameState, selectedSkillId, playerPos, hoveredTile);
        const hasEnemy = targetEntry.isEnemy;

        return { path, aoe, hasEnemy, target: hoveredTile };
    }, [gameState, selectedSkillId, hoveredTile, skillTargets, movementTiles, showMovementRange, playerPos]);

    return (
        <g pointerEvents="none">
            {/* Tier 1: Movement Selection */}
            {movementTiles.map((hex) => {
                const { x, y } = hexToPixel(hex, TILE_SIZE);
                return (
                    <circle
                        key={`mv-${hex.q}-${hex.r}`}
                        cx={x} cy={y}
                        r={TILE_SIZE * 0.55}
                        fill="rgba(99, 102, 241, 0.15)"
                        className="animate-soft-pulse"
                    />
                );
            })}

            {/* Tier 2: Skill Targeting */}
            {skillTargets.map((entry) => {
                const { p, isValidTarget, isBlocked } = entry;
                const { x, y } = hexToPixel(p, TILE_SIZE);
                return (
                    <g key={`sk-${p.q}-${p.r}`}>
                        <circle cx={x} cy={y} r={TILE_SIZE * 0.45} fill={isBlocked ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.04)'} />
                        {isValidTarget && !isBlocked && (
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.55} fill="none" stroke="rgba(239, 68, 68, 0.4)" strokeWidth={1.5} />
                        )}
                        {isValidTarget && isBlocked && (
                            <circle cx={x} cy={y} r={TILE_SIZE * 0.55} fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="4 2" strokeWidth={1} />
                        )}
                    </g>
                );
            })}

            {/* Tier 3: Hover Intent (Movement or Skill) */}
            {intentPreview && (
                <g>
                    {/* Path Arrow */}
                    {(() => {
                        const points = intentPreview.path.map(p => hexToPixel(p, TILE_SIZE));
                        const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

                        const last = points[points.length - 1];
                        const secondLast = points[points.length - 2] || { x: last.x - 1, y: last.y };
                        const angle = Math.atan2(last.y - secondLast.y, last.x - secondLast.x);
                        const headSize = 8;

                        return (
                            <g>
                                <path
                                    d={d}
                                    stroke="white"
                                    strokeWidth="2"
                                    fill="none"
                                    strokeDasharray="6 3"
                                    className="animate-intent-dash"
                                    opacity="0.6"
                                />
                                <path
                                    d={`M ${last.x} ${last.y} L ${last.x - headSize * Math.cos(angle - Math.PI / 6)} ${last.y - headSize * Math.sin(angle - Math.PI / 6)} M ${last.x} ${last.y} L ${last.x - headSize * Math.cos(angle + Math.PI / 6)} ${last.y - headSize * Math.sin(angle + Math.PI / 6)}`}
                                    stroke="white"
                                    strokeWidth="2"
                                    opacity="0.8"
                                />
                            </g>
                        );
                    })()}

                    {/* Impact Crosshair */}
                    {intentPreview.hasEnemy && (() => {
                        const { x, y } = hexToPixel(intentPreview.target, TILE_SIZE);
                        const r = TILE_SIZE * 0.7;
                        return (
                            <g>
                                <circle cx={x} cy={y} r={r} fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 2" />
                                <line x1={x - r} y1={y} x2={x + r} y2={y} stroke="#ef4444" strokeWidth="1" />
                                <line x1={x} y1={y - r} x2={x} y2={y + r} stroke="#ef4444" strokeWidth="1" />
                            </g>
                        );
                    })()}

                    {/* AoE Hazard Zone */}
                    {intentPreview.aoe.map((hex) => {
                        const { x, y } = hexToPixel(hex, TILE_SIZE);
                        return (
                            <circle
                                key={`aoe-${hex.q}-${hex.r}`}
                                cx={x} cy={y}
                                r={TILE_SIZE * 0.6}
                                fill="rgba(239, 68, 68, 0.2)"
                                stroke="rgba(239, 68, 68, 0.5)"
                                strokeWidth={2}
                                strokeDasharray="4 2"
                            />
                        );
                    })}
                </g>
            )}
        </g>
    );
};

export default PreviewOverlay;