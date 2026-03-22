import { describe, expect, it } from 'vitest';
import { SkillRegistry, createActiveSkill, generateInitialState, pointToKey, type Point } from '@hop/engine';
import {
  resolveBoardPreviewGhost,
  type BoardEnginePreviewGhost,
} from '../components/game-board/useBoardTargetingPreview';

const hex = (q: number, r: number): Point => ({ q, r, s: -q - r });

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
      movementSkillByTargetKey: new Map([[pointToKey(moveTarget), 'BASIC_MOVE']]),
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
      movementSkillByTargetKey: new Map(),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set(),
    });

    expect(preview).toBe(override);
  });

  it('uses the resolved movement skill path instead of a guessed straight-line dash', () => {
    const gameState = generateInitialState(1, 'board-preview-ghost-path-resolution');
    const playerPos = hex(4, 4);
    const blocker = hex(5, 4);
    const target = hex(6, 4);
    const detour = hex(5, 3);

    gameState.player.position = playerPos;
    gameState.player.previousPosition = playerPos;
    gameState.player.speed = 3;
    gameState.enemies = [];
    gameState.visibility = undefined;
    gameState.player.activeSkills = [
      createActiveSkill('BASIC_MOVE'),
      createActiveSkill('DASH'),
    ].filter(Boolean) as typeof gameState.player.activeSkills;

    for (const tile of [playerPos, blocker, target, detour]) {
      gameState.tiles.set(pointToKey(tile), {
        position: tile,
        baseId: 'STONE',
        traits: new Set(tile === blocker ? ['BLOCKS_MOVEMENT'] : []),
        effects: [],
      });
    }

    const preview = resolveBoardPreviewGhost({
      gameState,
      playerPos,
      selectedSkillId: null,
      showMovementRange: true,
      hoveredTile: target,
      movementTargetSet: new Set([pointToKey(target)]),
      movementSkillByTargetKey: new Map([[pointToKey(target), 'BASIC_MOVE']]),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set(),
    });

    expect(preview).not.toBeNull();
    expect(preview?.path.at(-1)).toEqual(target);
    expect(preview?.path.length).toBeGreaterThan(2);
    expect(preview?.path.some(step => pointToKey(step) === pointToKey(blocker))).toBe(false);
  });

  it('does not use neighbor fallback in strict target/path parity mode', () => {
    const gameState = generateInitialState(1, 'board-preview-ghost-strict-fallback');
    const playerPos = gameState.player.position;
    const hovered = hex(playerPos.q + 1, playerPos.r);

    const preview = resolveBoardPreviewGhost({
      gameState,
      playerPos,
      selectedSkillId: null,
      showMovementRange: true,
      hoveredTile: hovered,
      movementTargetSet: new Set(),
      movementSkillByTargetKey: new Map(),
      hasPrimaryMovementSkills: false,
      fallbackNeighborSet: new Set([pointToKey(hovered)]),
      strictTargetPathParityV1Enabled: true,
    });

    expect(preview).toBeNull();
  });
});
