import React, { useMemo, useState, useEffect, useLayoutEffect } from 'react';
import type { GameState, Point, SimulationEvent, StateMirrorSnapshot } from '@hop/engine';
import {
    isTileInDiamond, hexToPixel,
    TILE_SIZE
} from '@hop/engine';
import { CameraZoomControls } from './game-board/CameraZoomControls';
import { JuiceTraceOverlay } from './game-board/JuiceTraceOverlay';
import { GameBoardSceneSvg } from './game-board/GameBoardSceneSvg';
import { useBoardInteractions } from './game-board/useBoardInteractions';
import { useBoardCamera } from './game-board/useBoardCamera';
import { useBoardDepthSprites } from './game-board/useBoardDepthSprites';
import { useBoardBiomeVisuals } from './game-board/useBoardBiomeVisuals';
import { useBoardTargetingPreview } from './game-board/useBoardTargetingPreview';
import { useBoardEventEffects } from './game-board/useBoardEventEffects';
import { useBoardActorVisuals } from './game-board/useBoardActorVisuals';
import { useBoardJuicePresentation } from './game-board/useBoardJuicePresentation';
import { useMovementTracePlayback } from './game-board/useMovementTracePlayback';
import type {
    VisualAssetManifest,
    VisualBlendMode
} from '../visual/asset-manifest';
import {
    type CameraInsetsPx,
    type CameraRect,
    CAMERA_ZOOM_PRESETS,
} from '../visual/camera';

interface GameBoardProps {
    gameState: GameState;
    onMove: (hex: Point) => void;
    selectedSkillId: string | null;
    showMovementRange: boolean;
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
    } | null;
    cameraSafeInsetsPx?: Partial<CameraInsetsPx>;
}

const getHexPoints = (size: number): string => {
    const points: string[] = [];
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        points.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
    }
    return points.join(' ');
};

export const GameBoard: React.FC<GameBoardProps> = ({
    gameState,
    onMove,
    selectedSkillId,
    showMovementRange,
    onBusyStateChange,
    assetManifest,
    biomeDebug,
    onSimulationEvents,
    onMirrorSnapshot,
    enginePreviewGhost,
    cameraSafeInsetsPx,
}) => {
    type BoardDecal = { id: string; position: Point; href: string; createdAt: number };
    const [hoveredTile, setHoveredTile] = useState<Point | null>(null);
    const [juiceBusy, setJuiceBusy] = useState(false);
    const [decals, setDecals] = useState<BoardDecal[]>([]);
    const playerPos = gameState.player.position;

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
    const {
        svgRef,
        boardViewportRef,
        zoomPreset,
        isCameraPanning,
        setIsCameraPanning,
        cameraPanOffsetRef,
        isCameraPanningRef,
        isPinchingRef,
        suppressTileClickUntilRef,
        activePointersRef,
        dragStateRef,
        pinchStateRef,
        cancelCameraAnimation,
        animateCameraToTarget,
        updatePanFromWorldDelta,
        setZoomPresetAnimated,
        renderedViewBox,
    } = useBoardCamera({
        baseViewBox,
        playerWorld,
        playerPosition: playerPos,
        floor: gameState.floor,
        cameraSafeInsetsPx,
    });

    const {
        latestTraceByActor,
        movementTargetSet,
        hasPrimaryMovementSkills,
        stairsKey,
        shrineKey,
        fallbackNeighborSet,
        selectedSkillTargetSet,
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
        handleResetView,
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
        zoomPreset,
        setHoveredTile,
        setIsCameraPanning,
        cameraPanOffsetRef,
        isCameraPanningRef,
        isPinchingRef,
        suppressTileClickUntilRef,
        activePointersRef,
        dragStateRef,
        pinchStateRef,
        animateCameraToTarget,
        updatePanFromWorldDelta,
        setZoomPresetAnimated,
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

    const { movementBusy, resetMovementPlayback } = useMovementTracePlayback({
        visualEvents: gameState.visualEvents,
        turnNumber: gameState.turnNumber,
        actorPositionById,
        svgRef,
        cancelCameraAnimation,
    });

    useEffect(() => {
        onBusyStateChange?.(movementBusy || juiceBusy);
    }, [movementBusy, juiceBusy, onBusyStateChange]);

    useLayoutEffect(() => {
        // Floor transitions remount board data in one reducer step; clear any in-flight
        // animation side-effects so actor visuals always rebind to new floor positions.
        cancelCameraAnimation();
        resetMovementPlayback();
        resetBoardEventEffects();
        resetBoardJuicePresentation();
    }, [gameState.floor, cancelCameraAnimation, resetMovementPlayback, resetBoardEventEffects, resetBoardJuicePresentation]);
    const gridPoints = useMemo(() => getHexPoints(TILE_SIZE - 1), []);

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
                    renderedViewBox={renderedViewBox}
                    cells={cells}
                    gameState={gameState}
                    selectedSkillId={selectedSkillId}
                    showMovementRange={showMovementRange}
                    hoveredTile={hoveredTile}
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
                    latestTraceByActor={latestTraceByActor}
                    entityVisualPoseById={entityVisualPoseById}
                    biomeThemeKey={biomeThemeKey}
                    juiceActorSnapshots={juiceActorSnapshots}
                    assetManifest={assetManifest}
                    backdropLayerProps={backdropLayerProps}
                    gridPoints={gridPoints}
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
                presets={CAMERA_ZOOM_PRESETS}
                activePreset={zoomPreset}
                onSelectPreset={setZoomPresetAnimated}
                onResetView={handleResetView}
            />
        </div>
    );
};
