import { describe, it, expect } from 'vitest';
import { applyDamage, resolveMeleeAttack } from '@hop/engine/actor';
import type { Entity } from '@hop/engine/types';

describe('Actor combat primitives', () => {
  it('applyDamage reduces hp but not below 0', () => {
    const actor = { id: 'a', type: 'enemy', position: { q: 0, r: 0, s: 0 }, hp: 2, maxHp: 2 } as Entity;
    const after = applyDamage(actor, 1);
    expect(after.hp).toBe(1);
    const dead = applyDamage(after, 5);
    expect(dead.hp).toBe(0);
  });

  it('resolveMeleeAttack deals 1 damage', () => {
    const a = { id: 'atk', type: 'enemy', position: { q: 0, r: 0, s: 0 }, hp: 3, maxHp: 3, subtype: 'footman' } as Entity;
    const t = { id: 'tgt', type: 'player', position: { q: 1, r: 0, s: -1 }, hp: 2, maxHp: 2 } as Entity;
    const res = resolveMeleeAttack(a, t);
    expect(res.target.hp).toBe(1);
    expect(res.messages.length).toBeGreaterThan(0);
  });
});
