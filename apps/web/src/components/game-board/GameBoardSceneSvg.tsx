import React from 'react';
import type { ActionResourcePreview, Actor, GameState, IresTurnProjection, Point, SynapseThreatPreview } from '@hop/engine';
import type { VisualAssetManifest } from '../../visual/asset-manifest';
import { DevRenderProfiler } from '../../app/perf/dev-render-profiler';
import PreviewOverlay from '../PreviewOverlay';
import { JuiceManager } from '../JuiceManager';
import type { BoardEventDigest } from './board-event-digest';
import { BiomeBackdropLayer } from './BiomeBackdropLayer';
import { InteractionTilesLayer, type BoardDecal, type InteractionTileModel } from './InteractionTilesLayer';
import { RoutePathLayer } from './RoutePathLayer';
import { FogOfWarLayer } from './FogOfWarLayer';
import { ClutterObstaclesLayer } from './ClutterObstaclesLayer';
import { EntityLayer } from './EntityLayer';
import { UiGridLayer } from './UiGridLayer';
import { ObjectiveMarkersLayer } from './ObjectiveMarkersLayer';
import { SynapseHeatmapLayer } from './SynapseHeatmapLayer';
import { SynapseUnitScoreLayer } from './SynapseUnitScoreLayer';
import { SynapseThreadOverlay } from './SynapseThreadOverlay';
import type { SynapseDeltaEntry, SynapsePulse, SynapseSelection } from '../../app/synapse';
import { VisualEchoLayer, type VisualEchoEntry } from './VisualEchoLayer';
import type { RegisterActorNodes } from './actor-node-registry';

type JuiceActorSnapshot = {
  id: string;
  position: Point;
  subtype?: string;
  assetHref?: string;
  fallbackAssetHref?: string;
};

interface GameBoardSceneSvgProps {
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
  cells: Point[];
  interactionTiles: ReadonlyArray<InteractionTileModel>;
  gameState: GameState;
  selectedSkillId: string | null;
  showMovementRange: boolean;
  hoveredTile: Point | null;
  turnFlowMode?: 'protected_single' | 'manual_chain';
  overdriveArmed?: boolean;
  resolvedEnginePreviewGhost: {
    path: Point[];
    aoe: Point[];
    hasEnemy: boolean;
    target: Point;
    ailmentDeltaLines?: string[];
    resourcePreview?: ActionResourcePreview;
    turnProjection?: IresTurnProjection;
  } | null;
  decals: ReadonlyArray<BoardDecal>;
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
  assetById: Map<string, any>;
  mountainSettingsByAssetId: Map<string, any>;
  resolveMountainSettings: (asset?: any) => any;
  entityVisualPoseById: Map<string, any>;
  biomeThemeKey: string;
  player: Actor;
  playerDefeated: boolean;
  renderedEnemies: Actor[];
  detectedOnlyEnemies: Actor[];
  dyingEntities: Actor[];
  lastSpearPath?: Point[];
  spearPosition?: Point;
  juiceActorSnapshots: Array<JuiceActorSnapshot>;
  assetManifest?: VisualAssetManifest | null;
  boardEventDigest: BoardEventDigest;
  backdropLayerProps: any;
  gridPoints: string;
  isSynapseMode: boolean;
  synapsePreview: SynapseThreatPreview | null;
  synapseSelection: SynapseSelection;
  synapsePulse: SynapsePulse;
  synapseDeltasByActorId: Record<string, SynapseDeltaEntry>;
  visualEchoes: VisualEchoEntry[];
  registerActorNodes: RegisterActorNodes;
  onSynapseInspectEntity: (actorId: string) => void;
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

const GameBoardSceneSvgBase: React.FC<GameBoardSceneSvgProps> = ({
  svgRef,
  cells,
  interactionTiles,
  gameState,
  selectedSkillId,
  showMovementRange,
  hoveredTile,
  turnFlowMode,
  overdriveArmed,
  resolvedEnginePreviewGhost,
  decals,
  depthSortedSprites,
  boardProps,
  manifestUnitToBoardScale,
  assetById,
  mountainSettingsByAssetId,
  resolveMountainSettings,
  entityVisualPoseById,
  biomeThemeKey,
  player,
  playerDefeated,
  renderedEnemies,
  detectedOnlyEnemies,
  dyingEntities,
  lastSpearPath,
  spearPosition,
  juiceActorSnapshots,
  assetManifest,
  boardEventDigest,
  backdropLayerProps,
  gridPoints,
  isSynapseMode,
  synapsePreview,
  synapseSelection,
  synapsePulse,
  synapseDeltasByActorId,
  visualEchoes,
  registerActorNodes,
  onSynapseInspectEntity,
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
    <g data-layer="interaction-preview">
      <PreviewOverlay
        gameState={gameState}
        selectedSkillId={selectedSkillId}
        showMovementRange={showMovementRange}
        hoveredTile={hoveredTile}
        turnFlowMode={turnFlowMode}
        overdriveArmed={overdriveArmed}
        enginePreviewGhost={resolvedEnginePreviewGhost}
      />
    </g>
    <DevRenderProfiler id="board:InteractionTilesLayer">
      <InteractionTilesLayer
        tiles={interactionTiles}
        onTileClick={onTileClick}
        onTileHover={onTileHover}
        decals={decals}
      />
    </DevRenderProfiler>
    <RoutePathLayer gameState={gameState} />
    <FogOfWarLayer gameState={gameState} cells={cells} />
    <ClutterObstaclesLayer
      sprites={depthSortedSprites}
      floor={gameState.floor}
      manifestUnitToBoardScale={manifestUnitToBoardScale}
      mountainSettingsByAssetId={mountainSettingsByAssetId}
      resolveMountainSettings={resolveMountainSettings}
    />
    <SynapseHeatmapLayer
      enabled={isSynapseMode}
      preview={synapsePreview}
    />
    <DevRenderProfiler id="board:EntityLayer">
      <EntityLayer
        player={player}
        playerDefeated={playerDefeated}
        renderedEnemies={renderedEnemies}
        detectedOnlyEnemies={detectedOnlyEnemies}
        dyingEntities={dyingEntities}
        lastSpearPath={lastSpearPath}
        spearPosition={spearPosition}
        floor={gameState.floor}
        turnNumber={gameState.turnNumber}
        entityVisualPoseById={entityVisualPoseById}
        assetById={assetById}
        biomeThemeKey={biomeThemeKey}
        isSynapseMode={isSynapseMode}
        synapsePulse={synapsePulse}
        onSynapseInspectEntity={onSynapseInspectEntity}
        registerActorNodes={registerActorNodes}
      />
    </DevRenderProfiler>
    <DevRenderProfiler id="board:JuiceEffectsLayer">
      <JuiceManager
        visualEvents={gameState.visualEvents || []}
        timelineEvents={gameState.timelineEvents || []}
        simulationEvents={gameState.simulationEvents || []}
        boardEventDigest={boardEventDigest}
        actorSnapshots={juiceActorSnapshots}
        playerActorId={player.id}
        playerDefeated={playerDefeated}
        onBusyStateChange={onJuiceBusyStateChange}
        assetManifest={assetManifest}
      />
    </DevRenderProfiler>
    <SynapseUnitScoreLayer
      enabled={isSynapseMode}
      gameState={gameState}
      preview={synapsePreview}
      deltasByActorId={synapseDeltasByActorId}
    />
    <SynapseThreadOverlay
      enabled={isSynapseMode}
      gameState={gameState}
      selection={synapseSelection}
    />
    <VisualEchoLayer
      echoes={visualEchoes}
      currentTurn={gameState.turnNumber}
      enhanced={isSynapseMode}
    />
    <UiGridLayer cells={cells} gridPoints={gridPoints} />
    <ObjectiveMarkersLayer boardProps={boardProps} />
  </svg>
);

export const GameBoardSceneSvg = React.memo(GameBoardSceneSvgBase);
