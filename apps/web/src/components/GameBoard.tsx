import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import type { ActionResourcePreview, GameState, IresTurnProjection, Point, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import {
    isHexInRectangularGrid,
    hexToPixel,
    TILE_SIZE
} from '@hop/engine';
import { pointToKey } from '@hop/engine';
import { DevRenderProfiler } from '../app/perf/dev-render-profiler';
import { CameraZoomControls } from './game-board/CameraZoomControls';
import { JuiceTraceOverlay } from './game-board/JuiceTraceOverlay';
import { GameBoardSceneSvg } from './game-board/GameBoardSceneSvg';
import { buildBoardEventDigest } from './game-board/board-event-digest';
import { createHoveredTileStore } from './game-board/hovered-tile-store';
import type { BoardDecal, InteractionTileModel } from './game-board/InteractionTilesLayer';
import type { VisualEchoEntry } from './game-board/VisualEchoLayer';
import { useBoardInteractions } from './game-board/useBoardInteractions';
import { useBoardDepthSprites } from './game-board/useBoardDepthSprites';
import { useBoardBiomeVisuals } from './game-board/useBoardBiomeVisuals';
import { canDispatchBoardTileIntent, useBoardTargetingPreview } from './game-board/useBoardTargetingPreview';
import { useBoardEventEffects } from './game-board/useBoardEventEffects';
import { useBoardActorVisuals } from './game-board/useBoardActorVisuals';
import { useBoardJuicePresentation } from './game-board/useBoardJuicePresentation';
import { useBoardPresentationController } from './game-board/useBoardPresentationController';
import { filterVisibleByHexPosition } from './game-board/board-render-culling';
import type {
    VisualAssetManifest,
    VisualBlendMode
} from '../visual/asset-manifest';
import {
    type CameraInsetsPx,
    type CameraRect,
} from '../visual/camera';
import { createCameraEnvelope } from '../visual/camera-envelope';
import { resolveTileAssetId } from '../visual/asset-selectors';
import { resolveSynapsePreview, type SynapseDeltaEntry, type SynapsePulse, type SynapseSelection } from '../app/synapse';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point, passiveSkillId?: string) => void;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    turnFlowMode?: 'protected_single' | 'manual_chain';
    overdriveArmed?: boolean;
    onBusyStateChange?: (busy: boolean) => void;
    assetManifest?: VisualAssetManifest | null;
    biomeDebug?: {
        undercurrentOffset?: { x: number; y: number };
        crustOffset?: { x: number; y: number };
        mountainAssetPath?: string;
        mountainScale?: number;
        mountainOffset?: { x: number; y: number };
        mountainAnchor?: { x: number; y: number };
        mountainCrustBlendMode?: 'off' | VisualBlendMode;
        mountainCrustBlendOpacity?: number;
        mountainTintColor?: string;
        mountainTintBlendMode?: 'off' | VisualBlendMode;
        mountainTintOpacity?: number;
    };
    onSimulationEvents?: (events: SimulationEvent[]) => void;
    onMirrorSnapshot?: (snapshot: StateMirrorSnapshot) => void;
    enginePreviewGhost?: {
        path: Point[];
        aoe: Point[];
        hasEnemy: boolean;
        target: Point;
        ailmentDeltaLines?: string[];
        resourcePreview?: ActionResourcePreview;
        turnProjection?: IresTurnProjection;
    } | null;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
    isSynapseMode?: boolean;
    synapseSelection?: SynapseSelection;
    synapsePulse?: SynapsePulse;
    synapseDeltasByActorId?: Record<string, SynapseDeltaEntry>;
    onSynapseInspectEntity?: (actorId: string) => void;
    visualEchoesEnabled?: boolean;
    strictTargetPathParityV1Enabled?: boolean;
}

const getHexPoints = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

export const resolveBoardCells = (gameState: GameState): Point[] => {
    if (gameState.tiles.size > 0) {
        return Array.from(gameState.tiles.values())
            .map(tile => tile.position)
            .filter(hex =>
                isHexInRectangularGrid(hex, gameState.gridWidth, gameState.gridHeight, gameState.mapShape)
            );
    }

    const roomHexes = gameState.rooms?.flatMap(room => room.hexes) || [];
    if (roomHexes.length > 0) {
        return roomHexes.filter(hex =>
            isHexInRectangularGrid(hex, gameState.gridWidth, gameState.gridHeight, gameState.mapShape)
        );
    }

    const fallback: Point[] = [];
    for (let q = 0; q < gameState.gridWidth; q++) {
        for (let r = 0; r < gameState.gridHeight; r++) {
            const hex = { q, r, s: -q - r };
            if (isHexInRectangularGrid(hex, gameState.gridWidth, gameState.gridHeight, gameState.mapShape)) {
                fallback.push(hex);
            }
        }
    }
    return fallback;
};

export const GameBoard: React.FC<GameBoardProps> = ({
    gameState,
    onMove,
    selectedSkillId,
    showMovementRange,
    turnFlowMode = 'protected_single',
    overdriveArmed = false,
    onBusyStateChange,
    assetManifest,
    biomeDebug,
    onSimulationEvents,
    onMirrorSnapshot,
    enginePreviewGhost,
    cameraSafeInsetsPx,
    isSynapseMode = false,
    synapseSelection = { mode: 'empty' },
    synapsePulse = null,
    synapseDeltasByActorId = {},
    onSynapseInspectEntity,
    visualEchoesEnabled = false,
    strictTargetPathParityV1Enabled = false,
}) => {
    const [juiceBusy, setJuiceBusy] = useState(false);
    const [decals, setDecals] = useState<BoardDecal[]>([]);
    const [visualEchoes, setVisualEchoes] = useState<VisualEchoEntry[]>([]);
    const hoveredTileStore = useMemo(() => createHoveredTileStore(), []);
    const prevActorPositionsRef = React.useRef<Map<string, Point> | null>(null);
    const resetPresentationRef = React.useRef<() => void>(() => undefined);
    const playerPos = gameState.player.position;
    const movementRange = useMemo(
        () => Math.max(1, Math.floor(Number(gameState.player.speed) || 0)),
        [gameState.player.speed]
    );

    // Filter cells based on dynamic diamond geometry
    const cells = useMemo(() => resolveBoardCells(gameState), [gameState]);
    const boardTilesByKey = useMemo(
        () => new Map(cells.map((hex) => [pointToKey(hex), hex])),
        [cells]
    );
    const boardEventDigest = useMemo(() => buildBoardEventDigest({
        visualEvents: gameState.visualEvents || [],
        timelineEvents: gameState.timelineEvents || [],
        simulationEvents: gameState.simulationEvents || [],
    }), [gameState.visualEvents, gameState.timelineEvents, gameState.simulationEvents]);

    const {
        isShaking,
        isFrozen,
        cameraKickOffsetPx,
        juiceDebugOverlayEnabled,
        juiceDebugEntries,
        poseStore,
        enqueueEntityPoseEffects,
        resetBoardJuicePresentation,
    } = useBoardJuicePresentation({
        gameState,
        boardEventDigest,
    });

    // Dynamically calculate the Bounding Box of the actual hexes to maximize size
    const bounds = useMemo(() => {
        if (cells.length === 0) return { minX: 0, minY: 0, width: 100, height: 100 };

        const halfHeight = (Math.sqrt(3) * TILE_SIZE) / 2;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        cells.forEach(hex => {
            const { x, y } = hexToPixel(hex, TILE_SIZE);
            minX = Math.min(minX, x - TILE_SIZE);
            minY = Math.min(minY, y - halfHeight);
            maxX = Math.max(maxX, x + TILE_SIZE);
            maxY = Math.max(maxY, y + halfHeight);
        });

        return {
            minX,
            minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }, [cells]);

    const playerWorld = useMemo(() => {
        const { x, y } = hexToPixel(playerPos, TILE_SIZE);
        return { x, y };
    }, [playerPos]);

    const baseViewBox = useMemo<CameraRect>(() => ({
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.width,
        height: bounds.height
    }), [bounds.minX, bounds.minY, bounds.width, bounds.height]);
    const cameraEnvelope = useMemo(() => createCameraEnvelope(cells, TILE_SIZE), [cells]);
    const {
        movementSkillByTargetKey,
        movementTargetSet,
        hasPrimaryMovementSkills,
        stairsKey,
        shrineKey,
        fallbackNeighborSet,
        selectedSkillTargetSet,
        defaultPassiveSkillByTargetKey,
    } = useBoardTargetingPreview({
        gameState,
        playerPos,
        selectedSkillId,
        showMovementRange,
        strictTargetPathParityV1Enabled,
    });

    const {
        tileVisualFlags,
        assetById,
        deathDecalHref,
        manifestUnitToBoardScale,
        biomeThemeKey,
        biomeSeed,
        clutterLayer,
        wallsProfile,
        wallsThemeOverride,
        boardProps,
        resolveMountainSettings,
        hybridInteractionLayerEnabled,
        backdropLayerProps,
    } = useBoardBiomeVisuals({
        cells,
        gameState,
        bounds,
        assetManifest,
        biomeDebug,
    });
    const {
        mountainSettingsByAssetId,
        depthSortedSprites,
        mountainCoveredWallKeys,
    } = useBoardDepthSprites({
        assetManifest,
        biomeThemeKey,
        biomeSeed,
        mountainAssetPathOverride: biomeDebug?.mountainAssetPath,
        wallsMountainPath: wallsProfile?.mountainPath,
        wallsThemeMountainPath: wallsThemeOverride?.mountainPath,
        clutterLayer,
        cells,
        tileVisualFlags,
        boardProps,
        resolveMountainSettings,
    });

    const { resetBoardEventEffects } = useBoardEventEffects({
        gameState,
        boardEventDigest,
        deathDecalHref,
        decals,
        setDecals,
        enqueueEntityPoseEffects,
        onSimulationEvents,
    });

    const {
        actorPositionById,
        juiceActorSnapshots,
    } = useBoardActorVisuals({
        gameState,
        assetById,
        onMirrorSnapshot,
    });
    const {
        svgRef,
        boardViewportRef,
        registerActorNodes,
        presentationBusy,
        cameraState,
        beginManualPan,
        panByWorldDelta,
        endManualPan,
        selectZoomMode,
        recenter,
        resetPresentation,
    } = useBoardPresentationController({
        gameState,
        baseViewBox,
        cameraEnvelope,
        actorPositionById,
        playerWorld,
        movementRange,
        cameraSafeInsetsPx,
    });
    const interactionTiles = useMemo<InteractionTileModel[]>(() => (
        cells.map((hex) => {
            const tileKey = pointToKey(hex);
            const flags = tileVisualFlags.get(tileKey) || { isWall: false, isLava: false, isFire: false };
            const isWall = flags.isWall;
            const isLava = flags.isLava;
            const isFire = flags.isFire;
            const isMoveHighlight =
                (showMovementRange && !selectedSkillId && movementTargetSet.has(tileKey))
                || (
                    showMovementRange
                    && !selectedSkillId
                    && !strictTargetPathParityV1Enabled
                    && !hasPrimaryMovementSkills
                    && fallbackNeighborSet.has(tileKey)
                    && !isWall
                );
            const isSkillHighlight = !!selectedSkillId && selectedSkillTargetSet.has(tileKey);
            const renderWallTile = isWall && !mountainCoveredWallKeys.has(tileKey);
            const interactionOnly = hybridInteractionLayerEnabled && !renderWallTile;
            const isStairs = tileKey === stairsKey;
            const isShrine = shrineKey ? tileKey === shrineKey : false;
            const tileAssetId = resolveTileAssetId({
                isWall: renderWallTile,
                isLava,
                isFire,
                isStairs,
                isShrine,
                theme: gameState.theme,
            });

            return {
                key: tileKey,
                hex,
                isValidMove: isMoveHighlight || isSkillHighlight,
                isStairs,
                isLava,
                isFire,
                isShrine,
                isWall: renderWallTile,
                assetHref: interactionOnly ? undefined : assetById.get(tileAssetId)?.path,
                interactionOnly,
            };
        })
    ), [
        assetById,
        cells,
        fallbackNeighborSet,
        gameState.theme,
        hasPrimaryMovementSkills,
        hybridInteractionLayerEnabled,
        mountainCoveredWallKeys,
        movementTargetSet,
        selectedSkillId,
        selectedSkillTargetSet,
        showMovementRange,
        shrineKey,
        stairsKey,
        strictTargetPathParityV1Enabled,
        tileVisualFlags,
    ]);
    const visibleDepthSortedSprites = useMemo(
        () => filterVisibleByHexPosition(depthSortedSprites, (sprite) => sprite.position, cameraState.cullViewBox, TILE_SIZE * 4),
        [cameraState.cullViewBox, depthSortedSprites]
    );
    const visibleBoardProps = useMemo(
        () => filterVisibleByHexPosition(boardProps, (prop) => prop.position, cameraState.cullViewBox, TILE_SIZE * 3),
        [boardProps, cameraState.cullViewBox]
    );
    const visibleDecals = useMemo(
        () => filterVisibleByHexPosition(decals, (decal) => decal.position, cameraState.cullViewBox, TILE_SIZE * 3),
        [cameraState.cullViewBox, decals]
    );
    const visibleVisualEchoes = useMemo(
        () => filterVisibleByHexPosition(visualEchoes, (echo) => echo.position, cameraState.cullViewBox, TILE_SIZE * 3),
        [cameraState.cullViewBox, visualEchoes]
    );

    const visibleActorIds = useMemo(
        () => new Set(gameState.visibility?.playerFog?.visibleActorIds || []),
        [gameState.visibility?.playerFog?.visibleActorIds]
    );
    const detectedActorIds = useMemo(
        () => new Set(gameState.visibility?.playerFog?.detectedActorIds || []),
        [gameState.visibility?.playerFog?.detectedActorIds]
    );
    const hasFogVisibility = Boolean(gameState.visibility);
    const playerDefeated = gameState.gameStatus === 'lost' && gameState.player.hp <= 0;
    const renderedEnemies = useMemo(
        () => hasFogVisibility
            ? gameState.enemies.filter(enemy => visibleActorIds.has(enemy.id))
            : gameState.enemies,
        [gameState.enemies, hasFogVisibility, visibleActorIds]
    );
    const detectedOnlyEnemies = useMemo(
        () => hasFogVisibility
            ? gameState.enemies.filter(enemy => !visibleActorIds.has(enemy.id) && detectedActorIds.has(enemy.id))
            : [],
        [detectedActorIds, gameState.enemies, hasFogVisibility, visibleActorIds]
    );
    const dyingEntities = useMemo(() => gameState.dyingEntities || [], [gameState.dyingEntities]);
    const handleClearHover = React.useCallback(() => hoveredTileStore.clear(), [hoveredTileStore]);

    useEffect(() => {
        resetPresentationRef.current = resetPresentation;
    }, [resetPresentation]);

    const {
        isCameraPanning,
        handleBoardPointerDown,
        handleBoardPointerMove,
        handleBoardPointerUp,
        handleBoardPointerCancel,
        handleBoardWheel,
    } = useBoardInteractions({
        svgRef,
        boardTilesByKey,
        onMove: (hex) => onMove(hex, defaultPassiveSkillByTargetKey.get(pointToKey(hex))),
        canHandleTileClick: (hex) => canDispatchBoardTileIntent({
            tile: hex,
            playerPos,
            selectedSkillId,
            selectedSkillTargetSet,
            defaultPassiveSkillByTargetKey,
            hasPrimaryMovementSkills,
            fallbackNeighborSet,
            strictTargetPathParityV1Enabled,
        }),
        zoomMode: cameraState.zoomMode,
        setHoveredTile: hoveredTileStore.setHoveredTile,
        beginManualPan,
        panByWorldDelta,
        endManualPan,
        selectZoomMode,
        recenter,
    });

    useEffect(() => {
        if (!visualEchoesEnabled) {
            prevActorPositionsRef.current = null;
            setVisualEchoes([]);
            return;
        }
        const nextActorPositions = new Map<string, Point>();
        nextActorPositions.set(gameState.player.id, gameState.player.position);
        gameState.enemies.forEach((enemy) => {
            nextActorPositions.set(enemy.id, enemy.position);
        });
        (gameState.companions || []).forEach((companion) => {
            nextActorPositions.set(companion.id, companion.position);
        });

        const prevPositions = prevActorPositionsRef.current;
        if (!prevPositions) {
            prevActorPositionsRef.current = nextActorPositions;
            return;
        }

        const nextEchoes: VisualEchoEntry[] = [];
        nextActorPositions.forEach((position, actorId) => {
            const prev = prevPositions.get(actorId);
            if (!prev) return;
            if (prev.q === position.q && prev.r === position.r && prev.s === position.s) return;
            nextEchoes.push({
                id: `${actorId}-${gameState.turnNumber}-${prev.q}-${prev.r}-${prev.s}`,
                actorId,
                position: prev,
                expireTurn: gameState.turnNumber + 1
            });
        });

        prevActorPositionsRef.current = nextActorPositions;
        setVisualEchoes((existing) => {
            const active = existing.filter((echo) => echo.expireTurn >= gameState.turnNumber);
            return [...active, ...nextEchoes].slice(-48);
        });
    }, [
        gameState.companions,
        gameState.enemies,
        gameState.player.id,
        gameState.player.position,
        gameState.turnNumber,
        visualEchoesEnabled
    ]);

    useEffect(() => {
        onBusyStateChange?.(presentationBusy || juiceBusy);
    }, [presentationBusy, juiceBusy, onBusyStateChange]);

    useLayoutEffect(() => {
        // Floor transitions remount board data in one reducer step; clear any in-flight
        // animation side-effects so actor visuals always rebind to new floor positions.
        resetPresentationRef.current();
        resetBoardEventEffects();
        resetBoardJuicePresentation();
    }, [gameState.floor, resetBoardEventEffects, resetBoardJuicePresentation]);
    const gridPoints = useMemo(() => getHexPoints(TILE_SIZE - 1), []);
    const synapsePreview = useMemo(() => resolveSynapsePreview(gameState.intentPreview), [gameState.intentPreview]);
    const handleSynapseInspectEntity = React.useCallback((actorId: string) => {
        if (!isSynapseMode || !onSynapseInspectEntity) return;
        onSynapseInspectEntity(actorId);
    }, [isSynapseMode, onSynapseInspectEntity]);

    return (
        <DevRenderProfiler id="board:GameBoard">
            <div
                ref={boardViewportRef}
                className={`relative w-full h-full flex justify-center items-center overflow-hidden transition-transform duration-75 ${isShaking ? 'animate-shake' : ''} ${isCameraPanning ? 'cursor-grabbing' : ''}`}
            >
                <div
                    className="relative w-full h-full"
                    style={{
                        transform: `translate3d(${cameraKickOffsetPx.x}px, ${cameraKickOffsetPx.y}px, 0)`,
                        transition: 'transform 85ms ease-out',
                        willChange: cameraKickOffsetPx.x || cameraKickOffsetPx.y ? 'transform' : undefined
                    }}
                >
                    {isFrozen && (
                        <div
                            className="absolute inset-0 z-20 pointer-events-none bg-white/10"
                            style={{
                                boxShadow: 'inset 0 0 60px rgba(255,255,255,0.18)',
                                animation: 'flash 120ms ease-out'
                            }}
                        />
                    )}
                    <DevRenderProfiler id="board:GameBoardSceneSvg">
                        <GameBoardSceneSvg
                            svgRef={svgRef}
                            cells={cells}
                            interactionTiles={interactionTiles}
                            gameState={gameState}
                            selectedSkillId={selectedSkillId}
                            showMovementRange={showMovementRange}
                            turnFlowMode={turnFlowMode}
                            overdriveArmed={overdriveArmed}
                            enginePreviewGhost={enginePreviewGhost}
                            hoveredTileStore={hoveredTileStore}
                            movementTargetSet={movementTargetSet}
                            movementSkillByTargetKey={movementSkillByTargetKey}
                            hasPrimaryMovementSkills={hasPrimaryMovementSkills}
                            fallbackNeighborSet={fallbackNeighborSet}
                            strictTargetPathParityV1Enabled={strictTargetPathParityV1Enabled}
                            decals={visibleDecals}
                            depthSortedSprites={visibleDepthSortedSprites}
                            boardProps={visibleBoardProps}
                            manifestUnitToBoardScale={manifestUnitToBoardScale}
                            assetById={assetById}
                            mountainSettingsByAssetId={mountainSettingsByAssetId}
                            resolveMountainSettings={resolveMountainSettings}
                            poseStore={poseStore}
                            biomeThemeKey={biomeThemeKey}
                            player={gameState.player}
                            playerDefeated={playerDefeated}
                            renderedEnemies={renderedEnemies}
                            detectedOnlyEnemies={detectedOnlyEnemies}
                            dyingEntities={dyingEntities}
                            lastSpearPath={gameState.lastSpearPath}
                            spearPosition={gameState.spearPosition}
                            juiceActorSnapshots={juiceActorSnapshots}
                            assetManifest={assetManifest}
                            boardEventDigest={boardEventDigest}
                            backdropLayerProps={backdropLayerProps}
                            gridPoints={gridPoints}
                            isSynapseMode={isSynapseMode}
                            synapsePreview={synapsePreview}
                            synapseSelection={synapseSelection}
                            synapsePulse={synapsePulse}
                            synapseDeltasByActorId={synapseDeltasByActorId}
                            visualEchoes={visualEchoesEnabled ? visibleVisualEchoes : []}
                            registerActorNodes={registerActorNodes}
                            onSynapseInspectEntity={handleSynapseInspectEntity}
                            onMouseLeave={handleClearHover}
                            onWheel={handleBoardWheel}
                            onPointerDown={handleBoardPointerDown}
                            onPointerMove={handleBoardPointerMove}
                            onPointerUp={handleBoardPointerUp}
                            onPointerCancel={handleBoardPointerCancel}
                            onJuiceBusyStateChange={setJuiceBusy}
                        />
                    </DevRenderProfiler>
                </div>
                {import.meta.env.DEV && juiceDebugOverlayEnabled && (
                    <JuiceTraceOverlay entries={juiceDebugEntries} />
                )}
                <CameraZoomControls
                    activeMode={cameraState.zoomMode}
                    isDetached={cameraState.isDetached}
                    onSelectMode={selectZoomMode}
                    onRecenter={recenter}
                />
            </div>
        </DevRenderProfiler>
    );
};
