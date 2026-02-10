import React, { useMemo, useState, useEffect, useRef } from 'react';
import type { GameState, Point } from '@hop/engine';
import {
    hexDistance, hexEquals, isTileInDiamond, hexToPixel,
    TILE_SIZE, SkillRegistry, pointToKey, UnifiedTileService
} from '@hop/engine';
import { HexTile } from './HexTile';
import { Entity } from './Entity';
import PreviewOverlay from './PreviewOverlay';
import { JuiceManager } from './JuiceManager';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    onBusyStateChange?: (busy: boolean) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ gameState, onMove, selectedSkillId, showMovementRange, onBusyStateChange }) => {
    const [isShaking, setIsShaking] = useState(false);
    const [hoveredTile, setHoveredTile] = useState<Point | null>(null);
    const traceCacheRef = useRef<Record<string, any>>({});

    // Filter cells based on dynamic diamond geometry
    const cells = useMemo(() => {
        let hexes = gameState.rooms?.[0]?.hexes;

        // Fallback: If rooms are missing, generate the full diamond grid
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

    const latestTraceByActor = useMemo(() => {
        const out: Record<string, any> = { ...traceCacheRef.current };
        for (const ev of gameState.visualEvents || []) {
            if (ev.type !== 'kinetic_trace') continue;
            const trace = ev.payload;
            if (trace?.actorId) {
                out[trace.actorId] = trace;
            }
        }
        return out;
    }, [gameState.visualEvents]);

    useEffect(() => {
        const next = { ...traceCacheRef.current };
        for (const ev of gameState.visualEvents || []) {
            if (ev.type !== 'kinetic_trace') continue;
            const trace = ev.payload;
            if (trace?.actorId) {
                next[trace.actorId] = trace;
            }
        }
        traceCacheRef.current = next;
    }, [gameState.visualEvents]);

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
                    <PreviewOverlay
                        gameState={gameState}
                        selectedSkillId={selectedSkillId}
                        showMovementRange={showMovementRange}
                        hoveredTile={hoveredTile}
                    />
                    {cells.map((hex) => {
                        // FIXED: Use pointToKey for O(1) lookup in the Unified Tile Service
                        const tileKey = pointToKey(hex);

                        // Trait-based detection via UnifiedTileService
                        const traits = UnifiedTileService.getTraitsAt(gameState, hex);
                        const isWall = traits.has('BLOCKS_MOVEMENT') && traits.has('BLOCKS_LOS');
                        const isLava = traits.has('LAVA') || (traits.has('HAZARDOUS') && traits.has('LIQUID'));
                        const isFire = traits.has('FIRE');

                        const dist = hexDistance(hex, gameState.player.position);

                        // Movement Highlights
                        let isMoveHighlight = false;
                        if (showMovementRange && !selectedSkillId) {
                            const movementSkillIds = ['BASIC_MOVE', 'DASH'];
                            for (const id of movementSkillIds) {
                                if (gameState.player.activeSkills.some(s => s.id === id)) {
                                    const def = SkillRegistry.get(id);
                                    if (def?.getValidTargets) {
                                        const validTargets = def.getValidTargets(gameState, gameState.player.position);
                                        if (validTargets.some(v => hexEquals(v, hex))) {
                                            isMoveHighlight = true;
                                            break;
                                        }
                                    }
                                }
                            }

                            if (!isMoveHighlight && dist === 1 && !isWall) {
                                const hasPrimarySkills = gameState.player.activeSkills.some(s => ['BASIC_MOVE', 'DASH'].includes(s.id));
                                if (!hasPrimarySkills) isMoveHighlight = true;
                            }
                        }

                        // Skill Highlights
                        let isSkillHighlight = false;
                        if (selectedSkillId) {
                            const def = SkillRegistry.get(selectedSkillId);
                            if (def?.getValidTargets) {
                                const validTargets = def.getValidTargets(gameState, gameState.player.position);
                                isSkillHighlight = validTargets.some(v => hexEquals(v, hex));
                            }
                        }

                        const showRangeHighlight = isSkillHighlight || isMoveHighlight;
                        const isTargeted = gameState.enemies.some(e => e.intentPosition && hexEquals(e.intentPosition, hex));
                        const isStairs = hexEquals(hex, gameState.stairsPosition);
                        const isShrine = gameState.shrinePosition && hexEquals(hex, gameState.shrinePosition);

                        return (
                            <HexTile
                                key={tileKey}
                                hex={hex}
                                onClick={() => onMove(hex)}
                                isValidMove={showRangeHighlight}
                                isTargeted={isTargeted}
                                isStairs={isStairs}
                                isLava={isLava}
                                isFire={isFire}
                                isShrine={isShrine}
                                isWall={isWall}
                                onMouseEnter={setHoveredTile}
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
                        } as any} isSpear={true} />
                    )}

                    <Entity entity={gameState.player} movementTrace={latestTraceByActor[gameState.player.id]} />
                    {gameState.enemies.map(e => <Entity key={e.id} entity={e} movementTrace={latestTraceByActor[e.id]} />)}
                    {gameState.dyingEntities?.map(e => <Entity key={`dying-${e.id}-${gameState.turnNumber}`} entity={e} isDying={true} movementTrace={latestTraceByActor[e.id]} />)}

                    <JuiceManager
                        visualEvents={gameState.visualEvents || []}
                        timelineEvents={gameState.timelineEvents || []}
                        onBusyStateChange={onBusyStateChange}
                    />
                </g>
            </svg>
        </div>
    );
};
