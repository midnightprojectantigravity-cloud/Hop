import { describe, expect, it } from 'vitest';
import type { Actor } from '@hop/engine';
import { resolveUnitAssetId, resolveUnitFallbackAssetHref } from '../visual/asset-selectors';

const createEnemy = (
  subtype: string,
  enemyType: 'melee' | 'ranged' | 'boss' = 'melee'
): Actor => ({
  id: `enemy-${subtype}`,
  type: 'enemy',
  subtype,
  enemyType,
  position: { q: 0, r: 0, s: 0 },
  hp: 1,
  maxHp: 1,
  speed: 1,
  factionId: 'enemy',
  statusEffects: [],
  temporaryArmor: 0,
  activeSkills: [],
} as Actor);

describe('asset selectors', () => {
  it('resolves dedicated unit art ids for the current enemy roster', () => {
    expect(resolveUnitAssetId(createEnemy('footman'))).toBe('unit.enemy.footman.01');
    expect(resolveUnitAssetId(createEnemy('sprinter'))).toBe('unit.enemy.sprinter.01');
    expect(resolveUnitAssetId(createEnemy('raider'))).toBe('unit.enemy.raider.01');
    expect(resolveUnitAssetId(createEnemy('pouncer'))).toBe('unit.enemy.pouncer.01');
    expect(resolveUnitAssetId(createEnemy('shieldBearer'))).toBe('unit.enemy.shield_bearer.01');
    expect(resolveUnitAssetId(createEnemy('shield_bearer'))).toBe('unit.enemy.shield_bearer.01');
    expect(resolveUnitAssetId(createEnemy('archer', 'ranged'))).toBe('unit.enemy.archer.01');
    expect(resolveUnitAssetId(createEnemy('bomber', 'ranged'))).toBe('unit.enemy.bomber.01');
    expect(resolveUnitAssetId(createEnemy('bomb'))).toBe('unit.enemy.bomb.01');
    expect(resolveUnitAssetId(createEnemy('warlock', 'ranged'))).toBe('unit.enemy.warlock.01');
    expect(resolveUnitAssetId(createEnemy('butcher', 'boss'))).toBe('unit.enemy.butcher.01');
    expect(resolveUnitAssetId(createEnemy('sentinel', 'boss'))).toBe('unit.enemy.sentinel.01');
  });

  it('keeps svg fallbacks for new bestiary-backed enemy ids', () => {
    expect(resolveUnitFallbackAssetHref(createEnemy('sprinter'))).toBe('/assets/units/unit.enemy.footman.01.svg');
    expect(resolveUnitFallbackAssetHref(createEnemy('butcher', 'boss'))).toBe('/assets/units/unit.enemy.boss.01.svg');
    expect(resolveUnitFallbackAssetHref(createEnemy('sentinel', 'boss'))).toBe('/assets/units/unit.enemy.boss.01.svg');
  });
});
