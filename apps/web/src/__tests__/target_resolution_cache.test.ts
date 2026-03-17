import { describe, expect, it } from 'vitest';
import { SkillRegistry, generateInitialState } from '@hop/engine';
import {
  getCachedActionPreviewOutcome,
  getCachedSkillTargets,
} from '../components/game-board/target-resolution-cache';

describe('target resolution cache', () => {
  it('reuses skill target resolution for the same immutable game state', () => {
    const state = generateInitialState(1, 'target-cache-state');
    let calls = 0;
    const resolver = () => {
      calls += 1;
      return [state.player.position];
    };

    const first = getCachedSkillTargets({
      gameState: state,
      actorId: state.player.id,
      skillId: 'TEST_SKILL',
      origin: state.player.position,
      resolver,
    });
    const second = getCachedSkillTargets({
      gameState: state,
      actorId: state.player.id,
      skillId: 'TEST_SKILL',
      origin: state.player.position,
      resolver,
    });

    expect(first).toBe(second);
    expect(calls).toBe(1);

    const nextState = { ...state };
    getCachedSkillTargets({
      gameState: nextState,
      actorId: nextState.player.id,
      skillId: 'TEST_SKILL',
      origin: nextState.player.position,
      resolver,
    });
    expect(calls).toBe(2);
  });

  it('reuses preview outcomes for the same immutable game state', () => {
    const state = generateInitialState(1, 'preview-cache-state');
    const moveTarget = SkillRegistry.get('BASIC_MOVE')!.getValidTargets!(state, state.player.position)[0]!;

    const first = getCachedActionPreviewOutcome({
      gameState: state,
      actorId: state.player.id,
      skillId: 'BASIC_MOVE',
      target: moveTarget,
    });
    const second = getCachedActionPreviewOutcome({
      gameState: state,
      actorId: state.player.id,
      skillId: 'BASIC_MOVE',
      target: moveTarget,
    });

    expect(second).toBe(first);

    const nextState = { ...state };
    const third = getCachedActionPreviewOutcome({
      gameState: nextState,
      actorId: nextState.player.id,
      skillId: 'BASIC_MOVE',
      target: moveTarget,
    });

    expect(third).not.toBe(first);
  });
});
