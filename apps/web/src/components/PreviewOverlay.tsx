import React, { useMemo } from 'react';
import type { GameState, Point } from '@hop/engine';
import {
    hexToPixel, getHexLine, hexAdd, scaleVector, isHexInRectangularGrid,
    TILE_SIZE, SkillRegistry, getSkillRange, pointToKey,
    getSkillAoE, UnifiedTileService
} from '@hop/engine';

interface PreviewOverlayProps {
    gameState: GameState;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    hoveredTile: Point | null;
    enginePreviewGhost?: {
        path: Point[];
        aoe: Point[];
        hasEnemy: boolean;
        target: Point;
        ailmentDeltaLines?: string[];
    } | null;
}

const PreviewOverlay: React.FC<PreviewOverlayProps> = ({ gameState, selectedSkillId, showMovementRange, hoveredTile, enginePreviewGhost }) => {
    const playerPos = gameState.player.position;
    const enemyPositionSet = useMemo(() => {
        const set = new Set<string>();
        for (const e of gameState.enemies) {
            if (e.hp > 0) set.add(pointToKey(e.position));
        }
        return set;
    }, [gameState.enemies]);

    // Tier 1: Movement Selection (Base State) - Aggregate primary movement skills (Walk / Dash)
    const movementTiles = useMemo(() => {
        if (!showMovementRange || selectedSkillId) return [] as Point[];
        const playerSkillIds = new Set(gameState.player.activeSkills.map(s => s.id));

        // Define primary movement skills
        const movementSkillIds = ['BASIC_MOVE', 'DASH'] as const;
        const validSet = new Set<string>();
        const results: Point[] = [];

        movementSkillIds.forEach(id => {
            if (playerSkillIds.has(id)) {
                const def = SkillRegistry.get(id);
                if (def?.getValidTargets) {
                    const targets = def.getValidTargets(gameState, playerPos);
                    targets.forEach(p => {
                        const key = pointToKey(p);
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

    const movementTileSet = useMemo(() => {
        const set = new Set<string>();
        for (const p of movementTiles) set.add(pointToKey(p));
        return set;
    }, [movementTiles]);

    // Tier 2: Skill Targeting (Action State)
    const skillTargets = useMemo(() => {
        if (!selectedSkillId) return [] as Array<{ p: Point; isValidTarget: boolean; isBlocked: boolean; isWall: boolean; isEnemy: boolean }>;
        const def = SkillRegistry.get(selectedSkillId);
        const range = getSkillRange(gameState.player, selectedSkillId) || def?.baseVariables?.range || 0;
        const validTargets: Point[] = def?.getValidTargets ? def.getValidTargets(gameState, playerPos) : [];
        const validTargetSet = new Set(validTargets.map(pointToKey));

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
                    const isEnemy = enemyPositionSet.has(pointToKey(p));

                    const line = getHexLine(playerPos, p);
                    const interior = line.slice(1, -1);

                    // FIXED: Interior collision check using UnifiedTileService
                    const interiorBlocked = interior.some(iP =>
                        UnifiedTileService.isLosBlocking(gameState, iP) ||
                        enemyPositionSet.has(pointToKey(iP))
                    );

                    const isValidTarget = validTargetSet.has(pointToKey(p));

                    results.push({ p, isValidTarget, isBlocked: interiorBlocked, isWall, isEnemy });

                    if (isWall || isEnemy) break;
                }
            }
        } else {
            // For circular or arbitrary area skills (Jump, Blast, Attack, Bash, etc.)
            validTargets.forEach(p => {
                // FIXED: Map-based trait check
                const isWall = UnifiedTileService.isLosBlocking(gameState, p);
                const isEnemy = enemyPositionSet.has(pointToKey(p));
                results.push({ p, isValidTarget: true, isBlocked: false, isWall, isEnemy });
            });
        }

        return results;
    }, [gameState, selectedSkillId, playerPos, enemyPositionSet]);

    const skillTargetsByKey = useMemo(() => {
        const map = new Map<string, { p: Point; isValidTarget: boolean; isBlocked: boolean; isWall: boolean; isEnemy: boolean }>();
        for (const entry of skillTargets) {
            map.set(pointToKey(entry.p), entry);
        }
        return map;
    }, [skillTargets]);

    // Tier 3: Hover Intent (Immediate Impact)
    const intentPreview = useMemo(() => {
        if (enginePreviewGhost) return enginePreviewGhost;

        if (showMovementRange && hoveredTile && !selectedSkillId) {
            const isMoveTile = movementTileSet.has(pointToKey(hoveredTile));
            if (isMoveTile) {
                const path = getHexLine(playerPos, hoveredTile);
                return { path, aoe: [], hasEnemy: false, target: hoveredTile, ailmentDeltaLines: [] };
            }
        }

        if (!selectedSkillId || !hoveredTile) return null;

        const targetEntry = skillTargetsByKey.get(pointToKey(hoveredTile));
        if (!targetEntry || !targetEntry.isValidTarget || targetEntry.isBlocked) return null;

        const path = getHexLine(playerPos, hoveredTile);
        const aoe = getSkillAoE(gameState, selectedSkillId, playerPos, hoveredTile);
        const hasEnemy = targetEntry.isEnemy;

        return { path, aoe, hasEnemy, target: hoveredTile };
    }, [enginePreviewGhost, gameState, selectedSkillId, hoveredTile, skillTargetsByKey, movementTileSet, showMovementRange, playerPos]);

    return (
        <g pointerEvents="none">
            {/* Hover Intent only (movement/skill validity is already shown by tile highlights) */}
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
                                    stroke="rgba(255,255,255,0.9)"
                                    strokeWidth="2.25"
                                    fill="none"
                                    opacity="0.85"
                                    style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.22))' }}
                                />
                                <path
                                    d={`M ${last.x} ${last.y} L ${last.x - headSize * Math.cos(angle - Math.PI / 6)} ${last.y - headSize * Math.sin(angle - Math.PI / 6)} M ${last.x} ${last.y} L ${last.x - headSize * Math.cos(angle + Math.PI / 6)} ${last.y - headSize * Math.sin(angle + Math.PI / 6)}`}
                                    stroke="rgba(255,255,255,0.95)"
                                    strokeWidth="2"
                                    opacity="0.9"
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

                    {!intentPreview.hasEnemy && (() => {
                        const { x, y } = hexToPixel(intentPreview.target, TILE_SIZE);
                        return (
                            <circle
                                cx={x}
                                cy={y}
                                r={TILE_SIZE * 0.36}
                                fill="rgba(255,255,255,0.14)"
                                stroke="rgba(255,255,255,0.65)"
                                strokeWidth={1.5}
                            />
                        );
                    })()}

                    {!!intentPreview.ailmentDeltaLines?.length && (() => {
                        const { x, y } = hexToPixel(intentPreview.target, TILE_SIZE);
                        return (
                            <g transform={`translate(${x},${y - TILE_SIZE * 0.95})`}>
                                {intentPreview.ailmentDeltaLines!.slice(0, 2).map((line, idx) => (
                                    <text
                                        key={`ailment-delta-${idx}`}
                                        x={0}
                                        y={idx * 10}
                                        textAnchor="middle"
                                        fontSize={9}
                                        fill="#f8fafc"
                                        stroke="rgba(0,0,0,0.6)"
                                        strokeWidth={1.6}
                                        paintOrder="stroke"
                                        style={{ fontWeight: 700 }}
                                    >
                                        {line}
                                    </text>
                                ))}
                            </g>
                        );
                    })()}

                    {/* AoE Hazard Zone */}
                    {Array.from(new Map(intentPreview.aoe.map(hex => [pointToKey(hex), hex])).values()).map((hex) => {
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
