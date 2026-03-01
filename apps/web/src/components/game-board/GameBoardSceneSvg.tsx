import React from 'react';
import type { GameState, Point } from '@hop/engine';
import type { VisualAssetManifest } from '../../visual/asset-manifest';
import type { CameraRect } from '../../visual/camera';
import { BiomeBackdropLayer } from './BiomeBackdropLayer';
import { InteractionTilesLayer } from './InteractionTilesLayer';
import { ClutterObstaclesLayer } from './ClutterObstaclesLayer';
import { EntityLayer } from './EntityLayer';
import { UiGridLayer } from './UiGridLayer';
import { ObjectiveMarkersLayer } from './ObjectiveMarkersLayer';

interface GameBoardSceneSvgProps {
    svgRef: React.MutableRefObject<SVGSVGElement | null>;
    renderedViewBox: CameraRect;
    cells: Point[];
    gameState: GameState;
    selectedSkillId: string | null;
    showMovementRange: boolean;
    hoveredTile: Point | null;
    resolvedEnginePreviewGhost: {
        path: Point[];
        aoe: Point[];
        hasEnemy: boolean;
        target: Point;
    } | null;
    tileVisualFlags: Map<string, { isWall: boolean; isLava: boolean; isFire: boolean }>;
    movementTargetSet: Set<string>;
    hasPrimaryMovementSkills: boolean;
    fallbackNeighborSet: Set<string>;
    selectedSkillTargetSet: Set<string>;
    stairsKey: string;
    shrineKey: string | null;
    mountainCoveredWallKeys: Set<string>;
    hybridInteractionLayerEnabled: boolean;
    assetById: Map<string, any>;
    decals: { id: string; position: Point; href: string; createdAt: number }[];
    depthSortedSprites: Array<{
        id: string;
        kind: 'clutter' | 'mountain' | 'stairs' | 'shrine';
        position: Point;
        asset?: any;
        renderScale: number;
        fallback?: 'stairs' | 'shrine';
    }>;
    boardProps: Array<{
        id: string;
        kind: 'stairs' | 'shrine';
        position: Point;
        asset?: any;
    }>;
    manifestUnitToBoardScale: number;
    mountainSettingsByAssetId: Map<string, any>;
    resolveMountainSettings: (asset?: any) => any;
    latestTraceByActor: Record<string, any>;
    entityVisualPoseById: Map<string, any>;
    biomeThemeKey: string;
    juiceActorSnapshots: Array<{
        id: string;
        position: Point;
        subtype?: string;
        assetHref?: string;
        fallbackAssetHref?: string;
    }>;
    assetManifest?: VisualAssetManifest | null;
    backdropLayerProps: any;
    gridPoints: string;
    onTileClick: (hex: Point) => void;
    onTileHover: (hex: Point) => void;
    onMouseLeave: () => void;
    onWheel: (e: React.WheelEvent<SVGSVGElement>) => void;
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
    onJuiceBusyStateChange: (busy: boolean) => void;
}

export const GameBoardSceneSvg: React.FC<GameBoardSceneSvgProps> = ({
    svgRef,
    renderedViewBox,
    cells,
    gameState,
    selectedSkillId,
    showMovementRange,
    hoveredTile,
    resolvedEnginePreviewGhost,
    tileVisualFlags,
    movementTargetSet,
    hasPrimaryMovementSkills,
    fallbackNeighborSet,
    selectedSkillTargetSet,
    stairsKey,
    shrineKey,
    mountainCoveredWallKeys,
    hybridInteractionLayerEnabled,
    assetById,
    decals,
    depthSortedSprites,
    boardProps,
    manifestUnitToBoardScale,
    mountainSettingsByAssetId,
    resolveMountainSettings,
    latestTraceByActor,
    entityVisualPoseById,
    biomeThemeKey,
    juiceActorSnapshots,
    assetManifest,
    backdropLayerProps,
    gridPoints,
    onTileClick,
    onTileHover,
    onMouseLeave,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onJuiceBusyStateChange,
}) => (
    <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${renderedViewBox.x} ${renderedViewBox.y} ${renderedViewBox.width} ${renderedViewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        className="max-h-full max-w-full"
        onMouseLeave={onMouseLeave}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: 'none' }}
    >
        <BiomeBackdropLayer
            cells={cells}
            {...backdropLayerProps}
        />
        <InteractionTilesLayer
            gameState={gameState}
            selectedSkillId={selectedSkillId}
            showMovementRange={showMovementRange}
            hoveredTile={hoveredTile}
            enginePreviewGhost={resolvedEnginePreviewGhost}
            cells={cells}
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
            onTileClick={onTileClick}
            onTileHover={onTileHover}
            decals={decals}
        />
        <ClutterObstaclesLayer
            sprites={depthSortedSprites}
            floor={gameState.floor}
            manifestUnitToBoardScale={manifestUnitToBoardScale}
            mountainSettingsByAssetId={mountainSettingsByAssetId}
            resolveMountainSettings={resolveMountainSettings}
        />
        <EntityLayer
            gameState={gameState}
            latestTraceByActor={latestTraceByActor}
            entityVisualPoseById={entityVisualPoseById}
            assetById={assetById}
            biomeThemeKey={biomeThemeKey}
            juiceActorSnapshots={juiceActorSnapshots}
            assetManifest={assetManifest}
            onJuiceBusyStateChange={onJuiceBusyStateChange}
        />
        <UiGridLayer cells={cells} gridPoints={gridPoints} />
        <ObjectiveMarkersLayer boardProps={boardProps} />
    </svg>
);
