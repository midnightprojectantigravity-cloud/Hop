import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import type { ActionResourcePreview, GameState, IresTurnProjection, Point, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import {
    isHexInRectangularGrid,
    hexToPixel,
    TILE_SIZE
} from '@hop/engine';
import { CameraZoomControls } from './game-board/CameraZoomControls';
import { JuiceTraceOverlay } from './game-board/JuiceTraceOverlay';
import { GameBoardSceneSvg } from './game-board/GameBoardSceneSvg';
import type { VisualEchoEntry } from './game-board/VisualEchoLayer';
import { useBoardInteractions } from './game-board/useBoardInteractions';
import { useBoardDepthSprites } from './game-board/useBoardDepthSprites';
import { useBoardBiomeVisuals } from './game-board/useBoardBiomeVisuals';
import { canDispatchBoardTileIntent, useBoardTargetingPreview } from './game-board/useBoardTargetingPreview';
import { useBoardEventEffects } from './game-board/useBoardEventEffects';
import { useBoardActorVisuals } from './game-board/useBoardActorVisuals';
import { useBoardJuicePresentation } from './game-board/useBoardJuicePresentation';
import { useBoardPresentationController } from './game-board/useBoardPresentationController';
import type {
    VisualAssetManifest,
    VisualBlendMode
} from '../visual/asset-manifest';
import {
    type CameraInsetsPx,
    type CameraRect,
} from '../visual/camera';
import { createCameraEnvelope } from '../visual/camera-envelope';
import { resolveSynapsePreview, type SynapseDeltaEntry, type SynapsePulse, type SynapseSelection } from '../app/synapse';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
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
}) => {
    type BoardDecal = { id: string; position: Point; href: string; createdAt: number };
    const [hoveredTile, setHoveredTile] = useState<Point | null>(null);
    const [juiceBusy, setJuiceBusy] = useState(false);
    const [decals, setDecals] = useState<BoardDecal[]>([]);
    const [visualEchoes, setVisualEchoes] = useState<VisualEchoEntry[]>([]);
    const prevActorPositionsRef = React.useRef<Map<string, Point> | null>(null);
    const resetPresentationRef = React.useRef<() => void>(() => undefined);
    const playerPos = gameState.player.position;
    const movementRange = useMemo(
        () => Math.max(1, Math.floor(Number(gameState.player.speed) || 0)),
        [gameState.player.speed]
    );

    // Filter cells based on dynamic diamond geometry
    const cells = useMemo(() => resolveBoardCells(gameState), [gameState]);

    const {
        isShaking,
        isFrozen,
        cameraKickOffsetPx,
        juiceDebugOverlayEnabled,
        juiceDebugEntries,
        entityPoseEffects,
        entityPoseNowMs,
        setEntityPoseEffects,
        setEntityPoseNowMs,
        resetBoardJuicePresentation,
    } = useBoardJuicePresentation({ gameState });

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
        movementTargetSet,
        hasPrimaryMovementSkills,
        stairsKey,
        shrineKey,
        fallbackNeighborSet,
        selectedSkillTargetSet,
        defaultPassiveTargetSet,
        resolvedEnginePreviewGhost,
    } = useBoardTargetingPreview({
        gameState,
        playerPos,
        selectedSkillId,
        showMovementRange,
        hoveredTile,
        enginePreviewGhost,
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
        deathDecalHref,
        decals,
        setDecals,
        setEntityPoseEffects,
        setEntityPoseNowMs,
        onSimulationEvents,
    });

    const {
        actorPositionById,
        juiceActorSnapshots,
        entityVisualPoseById,
    } = useBoardActorVisuals({
        gameState,
        assetById,
        entityPoseEffects,
        entityPoseNowMs,
        onMirrorSnapshot,
    });
    const {
        svgRef,
        boardViewportRef,
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

    useEffect(() => {
        resetPresentationRef.current = resetPresentation;
    }, [resetPresentation]);

    const {
        isCameraPanning,
        handleTileClick,
        handleHoverTile,
        handleBoardPointerDown,
        handleBoardPointerMove,
        handleBoardPointerUp,
        handleBoardPointerCancel,
        handleBoardWheel,
    } = useBoardInteractions({
        svgRef,
        onMove,
        canHandleTileClick: (hex) => canDispatchBoardTileIntent({
            tile: hex,
            playerPos,
            selectedSkillId,
            selectedSkillTargetSet,
            defaultPassiveTargetSet,
            hasPrimaryMovementSkills,
            fallbackNeighborSet,
        }),
        zoomMode: cameraState.zoomMode,
        setHoveredTile,
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
                <GameBoardSceneSvg
                    svgRef={svgRef}
                    cells={cells}
                    gameState={gameState}
                    selectedSkillId={selectedSkillId}
                    showMovementRange={showMovementRange}
                    hoveredTile={hoveredTile}
                    turnFlowMode={turnFlowMode}
                    overdriveArmed={overdriveArmed}
                    resolvedEnginePreviewGhost={resolvedEnginePreviewGhost}
                    tileVisualFlags={tileVisualFlags}
                    movementTargetSet={movementTargetSet}
                    hasPrimaryMovementSkills={hasPrimaryMovementSkills}
                    fallbackNeighborSet={fallbackNeighborSet}
                    selectedSkillTargetSet={selectedSkillTargetSet}
                    stairsKey={stairsKey}
                    shrineKey={shrineKey}
                    mountainCoveredWallKeys={mountainCoveredWallKeys}
                    hybridInteractionLayerEnabled={hybridInteractionLayerEnabled}
                    assetById={assetById}
                    decals={decals}
                    depthSortedSprites={depthSortedSprites}
                    boardProps={boardProps}
                    manifestUnitToBoardScale={manifestUnitToBoardScale}
                    mountainSettingsByAssetId={mountainSettingsByAssetId}
                    resolveMountainSettings={resolveMountainSettings}
                    entityVisualPoseById={entityVisualPoseById}
                    biomeThemeKey={biomeThemeKey}
                    juiceActorSnapshots={juiceActorSnapshots}
                    assetManifest={assetManifest}
                    backdropLayerProps={backdropLayerProps}
                    gridPoints={gridPoints}
                    isSynapseMode={isSynapseMode}
                    synapsePreview={synapsePreview}
                    synapseSelection={synapseSelection}
                    synapsePulse={synapsePulse}
                    synapseDeltasByActorId={synapseDeltasByActorId}
                    visualEchoes={visualEchoesEnabled ? visualEchoes : []}
                    onSynapseInspectEntity={handleSynapseInspectEntity}
                    onTileClick={handleTileClick}
                    onTileHover={handleHoverTile}
                    onMouseLeave={() => setHoveredTile(null)}
                    onWheel={handleBoardWheel}
                    onPointerDown={handleBoardPointerDown}
                    onPointerMove={handleBoardPointerMove}
                    onPointerUp={handleBoardPointerUp}
                    onPointerCancel={handleBoardPointerCancel}
                    onJuiceBusyStateChange={setJuiceBusy}
                />
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
    );
};
