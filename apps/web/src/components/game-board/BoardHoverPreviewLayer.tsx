import React, { useMemo, useSyncExternalStore } from 'react';
import type { GameState, Point } from '@hop/engine';
import PreviewOverlay from '../PreviewOverlay';
import type { HoveredTileStore } from './hovered-tile-store';
import {
  resolveBoardPreviewGhost,
  type BoardEnginePreviewGhost,
} from './useBoardTargetingPreview';

interface BoardHoverPreviewLayerProps {
  hoveredTileStore: HoveredTileStore;
  gameState: GameState;
  playerPos: Point;
  selectedSkillId: string | null;
  showMovementRange: boolean;
  turnFlowMode?: 'protected_single' | 'manual_chain';
  overdriveArmed?: boolean;
  enginePreviewGhost?: BoardEnginePreviewGhost | null;
  movementTargetSet: Set<string>;
  movementSkillByTargetKey: ReadonlyMap<string, string>;
  hasPrimaryMovementSkills: boolean;
  fallbackNeighborSet: Set<string>;
  strictTargetPathParityV1Enabled?: boolean;
}

const BoardHoverPreviewLayerBase: React.FC<BoardHoverPreviewLayerProps> = ({
  hoveredTileStore,
  gameState,
  playerPos,
  selectedSkillId,
  showMovementRange,
  turnFlowMode,
  overdriveArmed,
  enginePreviewGhost,
  movementTargetSet,
  movementSkillByTargetKey,
  hasPrimaryMovementSkills,
  fallbackNeighborSet,
  strictTargetPathParityV1Enabled = false,
}) => {
  const hoveredTile = useSyncExternalStore(
    hoveredTileStore.subscribe,
    hoveredTileStore.getSnapshot,
    hoveredTileStore.getSnapshot,
  );

  const resolvedEnginePreviewGhost = useMemo(
    () =>
      resolveBoardPreviewGhost({
        gameState,
        playerPos,
        selectedSkillId,
        showMovementRange,
        hoveredTile,
        enginePreviewGhost,
        movementTargetSet,
        movementSkillByTargetKey,
        hasPrimaryMovementSkills,
        fallbackNeighborSet,
        strictTargetPathParityV1Enabled,
      }),
    [
      enginePreviewGhost,
      fallbackNeighborSet,
      gameState,
      hasPrimaryMovementSkills,
      hoveredTile,
      movementSkillByTargetKey,
      movementTargetSet,
      playerPos,
      selectedSkillId,
      showMovementRange,
      strictTargetPathParityV1Enabled,
    ],
  );

  return (
    <PreviewOverlay
      gameState={gameState}
      selectedSkillId={selectedSkillId}
      showMovementRange={showMovementRange}
      hoveredTile={hoveredTile}
      turnFlowMode={turnFlowMode}
      overdriveArmed={overdriveArmed}
      enginePreviewGhost={resolvedEnginePreviewGhost}
    />
  );
};

export const BoardHoverPreviewLayer = React.memo(BoardHoverPreviewLayerBase);
