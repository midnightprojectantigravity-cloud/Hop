import { describe, it, expect } from 'vitest';
import { gameReducer } from '../logic';
import { createActiveSkill, SkillRegistry } from '../skillRegistry';
import { applyEffects } from '../systems/effect-engine';
import { advanceInitiative, removeFromQueue } from '../systems/initiative';
import { executePassiveWithdrawal } from '../skills/withdrawal';
import { createMockState, p, placeTile } from './test_utils';
import type { Actor, GameState } from '../types';

describe('Tightening regressions', () => {
  it('does not skip the next actor when removing the current actor from initiative queue', () => {
    const baseState: GameState = createMockState();
    baseState.player.id = 'player';
    baseState.player.speed = 100;
    baseState.enemies = [
      { ...baseState.player, id: 'enemyA', type: 'enemy', factionId: 'enemy', speed: 10, hp: 1, maxHp: 1 },
      { ...baseState.player, id: 'enemyB', type: 'enemy', factionId: 'enemy', speed: 9, hp: 1, maxHp: 1 }
    ];
    baseState.initiativeQueue = {
      entries: [
        { actorId: 'player', initiative: 100, hasActed: true, turnStartPosition: p(0, 0) },
        { actorId: 'enemyA', initiative: 10, hasActed: false },
        { actorId: 'enemyB', initiative: 9, hasActed: false }
      ],
      currentIndex: 1,
      round: 1
    };

    const queue = removeFromQueue(baseState.initiativeQueue, 'enemyA');
    const advanced = advanceInitiative({ ...baseState, enemies: [baseState.enemies[1]], initiativeQueue: queue });
    expect(advanced.actorId).toBe('enemyB');
    expect(advanced.newRound).toBe(false);
  });

  it('basic move reaches a valid target through allied occupancy without short-stopping', () => {
    const state = createMockState();
    state.player.position = p(4, 4);
    state.player.previousPosition = p(4, 4);
    const ally: Actor = {
      ...state.player,
      id: 'ally-1',
      type: 'enemy',
      subtype: 'skeleton',
      factionId: 'player',
      position: p(5, 4),
      previousPosition: p(5, 4),
      hp: 1,
      maxHp: 1
    };
    state.enemies = [ally];
    placeTile(state, p(4, 4), [], 'STONE');
    placeTile(state, p(5, 4), [], 'STONE');
    placeTile(state, p(6, 4), [], 'STONE');

    const skill = SkillRegistry.get('BASIC_MOVE')!;
    const execution = skill.execute(state, state.player, p(6, 4), []);
    expect(execution.consumesTurn).toBe(true);

    const next = applyEffects(state, execution.effects, { sourceId: state.player.id });
    expect(next.player.position).toEqual(p(6, 4));
  });

  it('absorb fire movement can pass through lava and finish at the chosen tile', () => {
    const state = createMockState();
    state.player.position = p(4, 4);
    state.player.previousPosition = p(4, 4);
    state.player.hp = 1;
    if (!state.player.activeSkills.some(s => s.id === 'ABSORB_FIRE')) {
      const absorb = createActiveSkill('ABSORB_FIRE');
      if (absorb) state.player.activeSkills = [...state.player.activeSkills, absorb];
    }

    placeTile(state, p(4, 4), [], 'STONE');
    placeTile(state, p(5, 4), ['HAZARDOUS', 'LAVA', 'LIQUID'] as any, 'LAVA');
    placeTile(state, p(6, 4), [], 'STONE');

    const skill = SkillRegistry.get('BASIC_MOVE')!;
    const execution = skill.execute(state, state.player, p(6, 4), []);
    expect(execution.consumesTurn).toBe(true);

    const next = applyEffects(state, execution.effects, { sourceId: state.player.id });
    expect(next.player.position).toEqual(p(6, 4));
    expect(next.player.hp).toBeGreaterThan(0);
  });

  it('rejects upgrade selections that were not offered by shrine options', () => {
    const state = createMockState({
      gameStatus: 'choosing_upgrade',
      pendingStatus: { status: 'choosing_upgrade', shrineOptions: ['EXTRA_HP'] },
      shrineOptions: ['EXTRA_HP']
    });

    const next = gameReducer(state, { type: 'SELECT_UPGRADE', payload: 'POWER_STRIKE' });
    expect(next.upgrades).not.toContain('POWER_STRIKE');
    expect(next.gameStatus).toBe('choosing_upgrade');
  });

  it('rejects offered skill upgrades when the player does not own that skill', () => {
    const state = createMockState({
      gameStatus: 'choosing_upgrade',
      pendingStatus: { status: 'choosing_upgrade', shrineOptions: ['POWER_STRIKE'] },
      shrineOptions: ['POWER_STRIKE']
    });
    state.player.activeSkills = state.player.activeSkills.filter(s => s.id !== 'BASIC_ATTACK');

    const next = gameReducer(state, { type: 'SELECT_UPGRADE', payload: 'POWER_STRIKE' });
    expect(next.upgrades).not.toContain('POWER_STRIKE');
    expect(next.gameStatus).toBe('choosing_upgrade');
  });

  it('applies offered extra hp and clears pending upgrade state', () => {
    const state = createMockState({
      gameStatus: 'choosing_upgrade',
      pendingStatus: { status: 'choosing_upgrade', shrineOptions: ['EXTRA_HP'] },
      shrineOptions: ['EXTRA_HP']
    });

    const next = gameReducer(state, { type: 'SELECT_UPGRADE', payload: 'EXTRA_HP' });
    expect(next.upgrades).toContain('EXTRA_HP');
    expect(next.gameStatus).toBe('playing');
    expect(next.pendingStatus).toBeUndefined();
  });

  it('withdrawal hair-trigger does not add cooldown on passive trigger', () => {
    const state = createMockState();
    state.player.archetype = 'HUNTER';
    state.player.activeSkills = [
      {
        ...(createActiveSkill('WITHDRAWAL') as any),
        activeUpgrades: ['HAIR_TRIGGER'],
        currentCooldown: 0
      }
    ];
    state.enemies = [
      {
        ...state.player,
        id: 'foe-1',
        type: 'enemy',
        factionId: 'enemy',
        position: p(5, 4),
        previousPosition: p(5, 4),
        hp: 3,
        maxHp: 3,
        activeSkills: []
      }
    ];

    const result = executePassiveWithdrawal(state, state.player.id, p(5, 4));
    expect(result.effects.some(e => e.type === 'ModifyCooldown' && e.skillId === 'WITHDRAWAL')).toBe(false);
  });

  it('spear recall upgrade auto-retrieves after throw', () => {
    const state = createMockState();
    state.player.position = p(4, 4);
    state.player.previousPosition = p(4, 4);
    state.enemies = [
      {
        ...state.player,
        id: 'foe-1',
        type: 'enemy',
        factionId: 'enemy',
        subtype: 'footman',
        position: p(5, 4),
        previousPosition: p(5, 4),
        hp: 1,
        maxHp: 1,
        activeSkills: []
      }
    ];

    const skill = SkillRegistry.get('SPEAR_THROW')!;
    const execution = skill.execute(state, state.player, p(5, 4), ['RECALL']);
    expect(execution.effects.some(e => e.type === 'SpawnItem')).toBe(true);
    expect(execution.effects.some(e => e.type === 'PickupSpear')).toBe(true);
  });

  it('vampiric basic attack heals the attacker on kill', () => {
    const state = createMockState();
    state.player.position = p(4, 4);
    state.player.previousPosition = p(4, 4);
    state.player.hp = 1;
    const enemy: Actor = {
      ...state.player,
      id: 'foe-1',
      type: 'enemy',
      factionId: 'enemy',
      subtype: 'footman',
      position: p(5, 4),
      previousPosition: p(5, 4),
      hp: 1,
      maxHp: 1,
      activeSkills: []
    };
    state.enemies = [enemy];

    const attack = SkillRegistry.get('BASIC_ATTACK')!;
    const execution = attack.execute(state, state.player, enemy.position, ['VAMPIRIC']);
    const next = applyEffects(state, execution.effects, { sourceId: state.player.id, targetId: enemy.id });
    expect(next.player.hp).toBeGreaterThan(1);
  });

  it('kinetic tri-trap upgrades are encoded into placed trap effects', () => {
    const state = createMockState();
    state.player.position = p(4, 4);
    const trapSkill = SkillRegistry.get('KINETIC_TRI_TRAP')!;
    const execution = trapSkill.execute(state, state.player, undefined, ['VOLATILE_CORE', 'TRAP_CHAIN_REACTION', 'QUICK_RELOAD']);

    const trapEffects = execution.effects.filter(e => e.type === 'PlaceTrap');
    expect(trapEffects.length).toBeGreaterThan(0);
    for (const effect of trapEffects as any[]) {
      expect(effect.volatileCore).toBe(true);
      expect(effect.chainReaction).toBe(true);
      expect(effect.resetCooldown).toBe(1);
    }
  });
});
