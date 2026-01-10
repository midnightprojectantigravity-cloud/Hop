/**
 * ACTOR SYSTEM (ECS-Lite)
 * Pure functions for modifying Actor data.
 * TODO: Support component-based modifiers (e.g., actor.components.stats.strength).
 */
import type { Entity } from './types';

/** Apply damage to an actor and return a new actor object. Does not mutate input. */
export const applyDamage = (actor: Entity, amount: number): Entity => {
  let remainingDamage = amount;
  let newArmor = actor.temporaryArmor || 0;
  let newHp = actor.hp;

  if (newArmor > 0) {
    const absorbed = Math.min(newArmor, remainingDamage);
    newArmor -= absorbed;
    remainingDamage -= absorbed;
  }

  newHp = Math.max(0, newHp - remainingDamage);
  return { ...actor, hp: newHp, temporaryArmor: newArmor };
};

/** Heal an actor by amount up to maxHp. Returns new actor. */
export const applyHeal = (actor: Entity, amount: number): Entity => {
  return { ...actor, hp: Math.min(actor.maxHp, actor.hp + amount) };
};

/** Increase actor max HP (and optionally heal by same amount). */
export const increaseMaxHp = (actor: Entity, amount: number, heal: boolean = true): Entity => {
  const newMax = actor.maxHp + amount;
  const newHp = heal ? Math.min(newMax, actor.hp + amount) : actor.hp;
  return { ...actor, maxHp: newMax, hp: newHp };
};

/** Add a status effect to an actor. */
export const addStatus = (actor: Entity, type: 'stunned' | 'poisoned' | 'armored' | 'hidden', duration: number): Entity => {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
  return {
    ...actor,
    statusEffects: [...actor.statusEffects, { id, type, duration }]
  };
};

/** Remove a specific status type from an actor. */
export const removeStatus = (actor: Entity, type: string): Entity => {
  return {
    ...actor,
    statusEffects: actor.statusEffects.filter(s => s.type !== type)
  };
};

/**
 * Resolve a simple melee attack: attacker deals 1 damage to target.
 * Returns { attacker, target, messages }
 */
export const resolveMeleeAttack = (attacker: Entity, target: Entity): { attacker: Entity; target: Entity; messages: string[] } => {
  // For now attacks deal flat 1 damage (configurable later)
  const newTarget = applyDamage(target, 1);
  const messages = [`${attacker.subtype || attacker.type} hits ${target.subtype || target.type}!`];
  return { attacker: { ...attacker }, target: newTarget, messages };
};

export default { applyDamage, applyHeal, increaseMaxHp, resolveMeleeAttack };
