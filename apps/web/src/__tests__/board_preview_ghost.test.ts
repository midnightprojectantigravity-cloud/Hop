import { describe, expect, it } from 'vitest';
import { SkillRegistry, generateInitialState, pointToKey } from '@hop/engine';
import {
  resolveBoardPreviewGhost,
  type BoardEnginePreviewGhost,
} from '../components/game-board/useBoardTargetingPreview';

describe('resolveBoardPreviewGhost', () => {
  it('resolves a movement preview for a valid hovered move tile', () => {
    const gameState = generateInitialState(1, 'board-preview-ghost-move');
    const playerPos = gameState.player.position;
    const moveTarget = SkillRegistry.get('BASIC_MOVE')!.getValidTargets!(gameState, playerPos)[0]!;

    const preview = resolveBoardPreviewGhost({
      gameState,
      playerPos,
      selectedSkillId: null,
      showMovementRange: true,
      hoveredTile: moveTarget,
      movementTargetSet: new Set([pointToKey(moveTarget)]),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set(),
    });

    expect(preview).not.toBeNull();
    expect(preview?.target).toEqual(moveTarget);
    expect(preview?.path[0]).toEqual(playerPos);
    expect(preview?.path.at(-1)).toEqual(moveTarget);
  });

  it('prefers an upstream engine preview ghost when provided', () => {
    const gameState = generateInitialState(1, 'board-preview-ghost-upstream');
    const playerPos = gameState.player.position;
    const override: BoardEnginePreviewGhost = {
      path: [playerPos],
      aoe: [],
      hasEnemy: false,
      target: playerPos,
    };

    const preview = resolveBoardPreviewGhost({
      gameState,
      playerPos,
      selectedSkillId: null,
      showMovementRange: true,
      hoveredTile: null,
      enginePreviewGhost: override,
      movementTargetSet: new Set(),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set(),
    });

    expect(preview).toBe(override);
  });
});
