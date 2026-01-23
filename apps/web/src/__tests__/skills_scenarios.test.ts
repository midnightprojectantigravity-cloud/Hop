import { describe, test, expect } from 'vitest';
import { generateInitialState, gameReducer } from '@hop/engine';
import type { Point } from '@hop/engine';

const makeSkillStub = (id: string) => ({
  id,
  name: id,
  description: '',
  slot: 'offensive',
  cooldown: 3,
  currentCooldown: 0,
  range: 3,
  upgrades: [] as string[],
  activeUpgrades: [] as string[],
});

describe('Compositional Skill Scenarios', () => {
  test('Lava Hook Interruption', () => {
    const state = generateInitialState(1, 'test-seed');
    state.enemies = [];
    state.lavaPositions = [];
    state.wallPositions = [];

    // Place player at (4,10)
    state.player.position = { q: 4, r: 10, s: -14 } as Point;
    state.player.previousPosition = state.player.position;
    state.player.activeSkills = [makeSkillStub('GRAPPLE_HOOK') as any];

    // Spawn enemy at (4,6)
    const enemyPos = { q: 4, r: 6, s: -10 } as Point;
    state.enemies.push({ id: 'E1', type: 'enemy', subtype: 'footman', position: enemyPos, previousPosition: enemyPos, hp: 2, maxHp: 2 } as any);

    // Lava at (4,8)
    state.lavaPositions.push({ q: 4, r: 8, s: -12 } as Point);

    const next = gameReducer(state, { type: 'USE_SKILL', payload: { skillId: 'GRAPPLE_HOOK', target: enemyPos } });

    const enemyGone = next.enemies.length === 0;
    const msgOk = next.message.some(m => typeof m === 'string' && m.includes('pulled into lava'));
    if (!msgOk) console.log('Lava Hook Fail Messages:', next.message);
    expect(enemyGone).toBe(true);
    expect(msgOk).toBe(true);
  });

  test('Shield Retrieval via Hook', () => {
    const state = generateInitialState(1, 'test-seed-2');
    state.enemies = [];
    state.lavaPositions = [];
    state.wallPositions = [];

    // Place player at (4,10)
    state.player.position = { q: 4, r: 10, s: -14 } as Point;
    state.player.previousPosition = state.player.position;
    state.player.activeSkills = [makeSkillStub('GRAPPLE_HOOK') as any];
    state.hasShield = false;

    // Place shield item on ground at (4,6) (Distance 4 from 4,10)
    state.shieldPosition = { q: 4, r: 6, s: -10 } as Point;

    const target = { q: 4, r: 6, s: -10 } as Point;
    const next = gameReducer(state, { type: 'USE_SKILL', payload: { skillId: 'GRAPPLE_HOOK', target } });

    // Player should have picked up shield and gained BULWARK_CHARGE
    const hasShield = next.hasShield === true;
    const noShieldOnGround = typeof next.shieldPosition === 'undefined';
    const hasBulwark = next.player.activeSkills?.some(s => s.id === 'BULWARK_CHARGE');
    const pickedMsg = next.message.some(m => typeof m === 'string' && m.includes('Picked up your shield'));
    if (!pickedMsg) console.log('Shield Hook Fail Messages:', next.message);

    expect(hasShield).toBe(true);
    expect(noShieldOnGround).toBe(true);
    expect(hasBulwark).toBe(true);
    expect(pickedMsg).toBe(true);
  });
});
