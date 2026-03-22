import { describe, expect, it } from 'vitest';
import {
  buildResolvedSkillTargetMap,
  generateInitialState,
  pointToKey,
  previewActionOutcome,
  SkillRegistry
} from '@hop/engine';
import {
  getCachedActionPreviewOutcome,
  getCachedSkillTargets
} from '../components/game-board/target-resolution-cache';

describe('target cache parity with engine', () => {
  it('matches cached skill targets with direct engine target map for movement skills', () => {
    const state = generateInitialState(1, 'web-target-cache-engine-parity');
    const origin = state.player.position;
    const skillIds = (['BASIC_MOVE', 'DASH'] as const)
      .filter(id => state.player.activeSkills.some(skill => skill.id === id));

    const direct = buildResolvedSkillTargetMap(state, origin, skillIds);
    const cachedPairs = new Map<string, string>();

    for (const skillId of skillIds) {
      const def = SkillRegistry.get(skillId)!;
      const targets = getCachedSkillTargets({
        gameState: state,
        actorId: state.player.id,
        skillId,
        origin,
        resolver: () => def.getValidTargets!(state, origin)
      });
      for (const target of targets) {
        const key = pointToKey(target);
        if (!cachedPairs.has(key)) cachedPairs.set(key, skillId);
      }
    }

    expect(Array.from(cachedPairs.entries()).sort()).toEqual(Array.from(direct.entries()).sort());
  });

  it('matches cached action preview status with direct engine preview status', () => {
    const state = generateInitialState(1, 'web-preview-cache-engine-parity');
    const moveTarget = SkillRegistry.get('BASIC_MOVE')!.getValidTargets!(state, state.player.position)[0]!;

    const cached = getCachedActionPreviewOutcome({
      gameState: state,
      actorId: state.player.id,
      skillId: 'BASIC_MOVE',
      target: moveTarget
    });
    const direct = previewActionOutcome(state, {
      actorId: state.player.id,
      skillId: 'BASIC_MOVE',
      target: moveTarget
    });

    expect(cached.ok).toBe(direct.ok);
    expect(cached.reason || '').toBe(direct.reason || '');
  });
});
