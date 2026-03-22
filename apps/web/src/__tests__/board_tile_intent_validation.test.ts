import { describe, expect, it } from 'vitest';
import { canDispatchBoardTileIntent } from '../components/game-board/useBoardTargetingPreview';

const hex = (q: number, r: number, s: number) => ({ q, r, s });

describe('board tile intent validation', () => {
  it('blocks default clicks the engine would reject', () => {
    const allowed = canDispatchBoardTileIntent({
      tile: hex(3, 3, -6),
      playerPos: hex(0, 0, 0),
      selectedSkillId: null,
      selectedSkillTargetSet: new Set(),
      defaultPassiveSkillByTargetKey: new Map([['1,0', 'BASIC_MOVE']]),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set()
    });

    expect(allowed).toBe(false);
  });

  it('allows passive default targets that match the engine target set', () => {
    const allowed = canDispatchBoardTileIntent({
      tile: hex(1, 0, -1),
      playerPos: hex(0, 0, 0),
      selectedSkillId: null,
      selectedSkillTargetSet: new Set(),
      defaultPassiveSkillByTargetKey: new Map([['1,0', 'BASIC_MOVE']]),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set()
    });

    expect(allowed).toBe(true);
  });

  it('blocks fallback-neighbor movement when strict target/path parity is enabled', () => {
    const allowed = canDispatchBoardTileIntent({
      tile: hex(1, 0, -1),
      playerPos: hex(0, 0, 0),
      selectedSkillId: null,
      selectedSkillTargetSet: new Set(),
      defaultPassiveSkillByTargetKey: new Map(),
      hasPrimaryMovementSkills: false,
      fallbackNeighborSet: new Set(['1,0']),
      strictTargetPathParityV1Enabled: true
    });

    expect(allowed).toBe(false);
  });

  it('switches to selected-skill validation when a skill is armed', () => {
    const blocked = canDispatchBoardTileIntent({
      tile: hex(1, 0, -1),
      playerPos: hex(0, 0, 0),
      selectedSkillId: 'FIREBALL',
      selectedSkillTargetSet: new Set(['2,0']),
      defaultPassiveSkillByTargetKey: new Map([['1,0', 'BASIC_MOVE']]),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set()
    });
    const allowed = canDispatchBoardTileIntent({
      tile: hex(2, 0, -2),
      playerPos: hex(0, 0, 0),
      selectedSkillId: 'FIREBALL',
      selectedSkillTargetSet: new Set(['2,0']),
      defaultPassiveSkillByTargetKey: new Map([['1,0', 'BASIC_MOVE']]),
      hasPrimaryMovementSkills: true,
      fallbackNeighborSet: new Set()
    });

    expect(blocked).toBe(false);
    expect(allowed).toBe(true);
  });
});
