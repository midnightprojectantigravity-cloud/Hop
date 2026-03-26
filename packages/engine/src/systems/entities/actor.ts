/**
 * ACTOR SYSTEM (ECS-Lite)
 * Pure functions for modifying Actor data.
 */
import type { Entity, StatusEffect } from '../../types';
import { STATUS_REGISTRY } from '../../constants';
import type { StatusID } from '../../types/registry';
import { buildBombDetonationEffects, isBombActor } from '../effects/bomb-runtime';

const buildStatusOnTick = (type: StatusID): StatusEffect['onTick'] | undefined => {
  if (type === 'time_bomb') {
    return (actor) => {
      if (!isBombActor(actor)) return [];
      const fuse = actor.statusEffects.find(status => status.type === 'time_bomb');
      if (!fuse || fuse.duration > 1) return [];
      return buildBombDetonationEffects(actor);
    };
  }
  if (type !== 'blinded') return undefined;
  return (actor) => {
    const blinded = actor.statusEffects.find(status => status.type === 'blinded');
    if (!blinded || blinded.duration > 1) return [];
    const message = actor.type === 'player'
      ? 'You are no longer blinded.'
      : `${actor.subtype || actor.id} is no longer blinded.`;
    return [{
      type: 'Juice',
      effect: 'hiddenFade',
      target: actor.id,
      intensity: 'low',
      metadata: {
        signature: 'STATE.EXPIRE.SHADOW.BLINDED',
        family: 'status',
        primitive: 'status_tick',
        phase: 'aftermath',
        element: 'shadow',
        variant: 'blinded_expire',
        targetRef: { kind: 'target_actor' },
        statusId: 'blinded'
      }
    }, {
      type: 'Message',
      text: message
    }];
  };
};

/** Apply damage with Armor Absorption logic */
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

/**
 * Add/Refresh a status effect - Crucial for Skill Power Assessment.
 * Ensures the tickWindow is explicitly set to avoid engine logic gaps.
 */
export const addStatus = (
  actor: Entity,
  type: StatusID,
  duration: number,
  stacks?: number
): Entity => {
  const metadata = STATUS_REGISTRY[type];
  const tickWindow = metadata?.tickWindow || 'END_OF_TURN';
  const id = type.toUpperCase();
  const existing = actor.statusEffects.find(s => s.id === id);

  if (existing) {
    return {
      ...actor,
      statusEffects: actor.statusEffects.map(s =>
        s.id === id
          ? {
            ...s,
            duration: Math.max(s.duration, duration),
            tickWindow,
            durationModel: s.durationModel || 'tick_window',
            stacks: stacks || s.stacks,
            onTick: buildStatusOnTick(type) || s.onTick
          }
          : s
      )
    };
  }

  const newStatus: StatusEffect = {
    id,
    type,
    duration,
    durationModel: 'tick_window',
    tickWindow,
    stacks: stacks || 1,
    onTick: buildStatusOnTick(type)
  };

  return {
    ...actor,
    statusEffects: [...actor.statusEffects, newStatus]
  };
};

/** Resolve Melee Attack - Updated for dynamic damage values */
export const resolveMeleeAttack = (attacker: Entity, target: Entity, damage: number = 1): { attacker: Entity; target: Entity; messages: string[] } => {
  const newTarget = applyDamage(target, damage);
  const targetName = target.subtype || target.type || 'target';
  const attackerName = attacker.subtype || attacker.type || 'attacker';

  const messages = [`${attackerName} attacked ${targetName}!`];
  return { attacker: { ...attacker }, target: newTarget, messages };
};

/** Heal an actor by amount up to maxHp. */
export const applyHeal = (actor: Entity, amount: number): Entity => {
  return { ...actor, hp: Math.min(actor.maxHp, actor.hp + amount) };
};

/** Increase actor max HP (and optionally heal). */
export const increaseMaxHp = (actor: Entity, amount: number, heal: boolean = true): Entity => {
  const newMax = actor.maxHp + amount;
  const newHp = heal ? Math.min(newMax, actor.hp + amount) : actor.hp;
  return { ...actor, maxHp: newMax, hp: newHp };
};

/** Remove a specific status type from an actor. */
export const removeStatus = (actor: Entity, statusId: string): Entity => {
  const targetId = statusId.toUpperCase();
  return {
    ...actor,
    statusEffects: actor.statusEffects.filter(s => s.id !== targetId)
  };
};

import type { GameState, AtomicEffect } from '../../types';

/**
 * Single source of truth for life/death state checks.
 */
export const checkVitals = (state: GameState): AtomicEffect[] => {
  const effects: AtomicEffect[] = [];
  if (state.player.hp <= 0 && state.gameStatus === 'playing') {
    effects.push({ type: 'GameOver', reason: 'PLAYER_DIED' });
  }
  return effects;
};

/**
 * Step through cooldowns for all active skills on an actor.
 */
export const tickActorSkills = (actor: Entity): Entity => {
  if (!actor.activeSkills) return actor;
  return {
    ...actor,
    activeSkills: actor.activeSkills.map(skill => ({
      ...skill,
      currentCooldown: Math.max(0, skill.currentCooldown - 1)
    }))
  };
};

/**
 * Check if an actor has a specific upgrade across any of their skills.
 */
export const hasUpgrade = (actor: Entity, upgradeId: string): boolean => {
  if (!actor.activeSkills) return false;
  return actor.activeSkills.some(s => s.activeUpgrades?.includes(upgradeId));
};

/**
 * Add an upgrade to an actor's specific skill.
 */
export const addUpgrade = (actor: Entity, skillId: string, upgradeId: string): Entity => {
  if (!actor.activeSkills) return actor;
  return {
    ...actor,
    activeSkills: actor.activeSkills.map(s => {
      if (s.id === skillId && !s.activeUpgrades.includes(upgradeId)) {
        return { ...s, activeUpgrades: [...s.activeUpgrades, upgradeId] };
      }
      return s;
    })
  };
};

export default {
  applyDamage,
  applyHeal,
  increaseMaxHp,
  resolveMeleeAttack,
  addStatus,
  removeStatus,
  checkVitals,
  tickActorSkills,
  hasUpgrade,
  addUpgrade
};
