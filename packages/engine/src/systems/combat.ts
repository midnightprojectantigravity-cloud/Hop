/**
 * COMBAT SYSTEM
 * Manages telegraphed attacks and enemy turn resolution.
 * TODO: Fully migrate telegraphed attacks to the SkillDefinition/COMPOSITIONAL_SKILLS system.
 */
import type { GameState, Point, Entity, AtomicEffect, Actor } from '../types';
import { hexEquals, getNeighbors } from '../hex';
import { computeEnemyAction } from './ai';
import { getActorAt } from '../helpers';
import { applyAutoAttack } from '../skills/auto_attack';
import { getTurnStartNeighborIds } from './initiative';
import { SkillRegistry } from '../skillRegistry';
import { applyEffects } from './effect-engine';
import { isStunned, tickStatuses, handleStunReset } from './status';
import { SKILL_JUICE_SIGNATURES, JuiceHelpers } from './juice-manifest';
import { TileResolver } from './tile-effects';
import { UnifiedTileService } from './unified-tile-service';
import { applyDamage } from './actor';
import { createEntity } from './entity-factory';
import { addToQueue } from './initiative';

export const resolveTelegraphedAttacks = (
  state: GameState,
  playerMovedTo: Point,
  targetActorId?: string,
  stepId?: string
): { state: GameState; messages: string[] } => {
  let curState = state;
  const messages: string[] = [];

  const actorsToProcess = targetActorId
    ? state.enemies.filter(e => e.id === targetActorId)
    : state.enemies;

  const nextEnemies = [...curState.enemies];

  actorsToProcess.forEach(e => {
    const liveEnemy = curState.enemies.find(ne => ne.id === e.id);
    if (!liveEnemy) return;

    if (isStunned(liveEnemy)) {
      const idx = nextEnemies.findIndex(ne => ne.id === e.id);
      if (idx !== -1) {
        nextEnemies[idx] = { ...nextEnemies[idx], intent: undefined, intentPosition: undefined };
      }
      return;
    }
    if (liveEnemy.intent && liveEnemy.intentPosition) {
      let enemyHandled = false;
      // 1. Try to find a compositional skill that matches the intent
      const skillDef = SkillRegistry.get(liveEnemy.intent);
      const activeSkill = liveEnemy.activeSkills?.find(s => s.id === liveEnemy.intent);

      if (skillDef && activeSkill) {
        // FLEXIBLE INTENT: Reassess if player is still a valid target
        const validTargets = skillDef.getValidTargets ? skillDef.getValidTargets(curState, liveEnemy.position) : [];
        const isPlayerStillValid = validTargets.some(p => hexEquals(p, curState.player.position));

        let targetPos = liveEnemy.intentPosition;
        if (isPlayerStillValid) {
          // If player moved but is still in range/LoS, track them!
          targetPos = curState.player.position;
        } else {
          // If player is no longer valid, we should NOT execute this telegraphed attack.
          // Clearing intent lets the AI reassess during resolveSingleEnemyTurn.
          const idx = nextEnemies.findIndex(ne => ne.id === e.id);
          if (idx !== -1) {
            nextEnemies[idx] = { ...nextEnemies[idx], intent: undefined, intentPosition: undefined };
          }
          return; // Skip execution
        }

        // Execute skill AT THE REASSESSED POSITION
        const result = skillDef.execute(curState, liveEnemy, targetPos, activeSkill.activeUpgrades);
        curState = applyEffects(curState, result.effects, { sourceId: liveEnemy.id, targetId: curState.player.id, stepId });
        messages.push(...result.messages);
        enemyHandled = true;
      } else if (liveEnemy.subtype === 'bomber') {
        // ... (No changes here)
      } else if (hexEquals(liveEnemy.intentPosition, playerMovedTo)) {
        // Fallback to legacy damage if it was a basic attack intent
        curState = { ...curState, player: applyDamage(curState.player, 1) };
        const name = `${liveEnemy.subtype || 'enemy'}#${liveEnemy.id}`;
        messages.push(`${name} hit you! (HP: ${curState.player.hp}/${curState.player.maxHp})`);
        enemyHandled = true;
      }

      if (enemyHandled) {
        const idx = nextEnemies.findIndex(ne => ne.id === e.id);
        if (idx !== -1) {
          nextEnemies[idx] = { ...nextEnemies[idx], intent: undefined, intentPosition: undefined };
        }
      }
    }
  });

  curState = { ...curState, enemies: nextEnemies };
  return { state: curState, messages };
};


/**
 * Resolve a single enemy's turn logic.
 * Used by the granular initiative system.
 */
export const resolveSingleEnemyTurn = (
  state: GameState,
  enemy: Entity,
  turnStartPosition: Point
): { state: GameState; messages: string[]; isDead: boolean } => {
  let curState = state;
  let messages: string[] = [];
  let nextEnemy: Entity = enemy;
  const stunnedAppliedThisStep = (state.timelineEvents || []).some(ev =>
    ev.phase === 'STATUS_APPLY'
    && ev.type === 'ApplyStatus'
    && ev.payload?.status === 'stunned'
    && (
      ev.payload?.target === enemy.id
      || (
        typeof ev.payload?.target === 'object'
        && ev.payload?.target
        && hexEquals(ev.payload.target as Point, enemy.position)
      )
    )
  );
  const startedStunned = isStunned(enemy) || stunnedAppliedThisStep;

  // Use identity-captured neighbor IDs (set at turn start) for Auto-Attack persistence
  const persistentTargetIds = getTurnStartNeighborIds(state, enemy.id) || undefined;

  // 1. Process Bomb self-ticks
  if (enemy.subtype === 'bomb') {
    const fuse = enemy.statusEffects?.find(s => s.type === 'time_bomb');
    if (!fuse || fuse.duration <= 1) {
      messages.push("A bomb exploded!");

      // Damage all entities in 1-tile radius
      const explosionCenter = enemy.position;
      const affectedPoints = [explosionCenter, ...getNeighbors(explosionCenter)];

      // JUICE: Explosion Effects
      curState = applyEffects(curState, SKILL_JUICE_SIGNATURES.BOMB.impact(explosionCenter));
      curState = applyEffects(curState, SKILL_JUICE_SIGNATURES.BOMB.resolution(affectedPoints));

      // Damage Player
      if (affectedPoints.some(p => hexEquals(p, curState.player.position))) {
        curState = { ...curState, player: applyDamage(curState.player, 1) };
        messages.push(`You were caught in the explosion! (HP: ${curState.player.hp}/${curState.player.maxHp})`);
      }

      // Damage Enemies
      curState.enemies = curState.enemies.map(en => {
        if (en.id !== enemy.id && affectedPoints.some(p => hexEquals(p, en.position))) {
          messages.push(`${en.subtype} was hit by the explosion!`);
          return applyDamage(en, 1);
        }
        return en;
      }).filter(en => en.hp > 0);

      return { state: curState, messages, isDead: true };
    }
    nextEnemy = tickStatuses({ ...enemy, intent: undefined, intentPosition: undefined });
  } else if (isStunned(enemy)) {
    // Tick down statuses and clear intent
    nextEnemy = handleStunReset(tickStatuses(enemy));
  } else if (enemy.intent === 'Bombing' && enemy.intentPosition) {
    const occupied = getActorAt(curState, enemy.intentPosition);
    if (!occupied) {
      messages.push(`${enemy.subtype} placed a bomb.`);
      const bombId = `bomb_${enemy.id}_${state.turnNumber}`;
      const bomb: Entity = createEntity({
        id: bombId,
        type: 'enemy',
        subtype: 'bomb',
        factionId: 'enemy',
        position: enemy.intentPosition,
        speed: 10,
        skills: ['TIME_BOMB'],
        weightClass: 'Standard',
      });
      bomb.statusEffects = [
        {
          id: 'TIME_BOMB',
          type: 'time_bomb',
          duration: 2,
          tickWindow: 'END_OF_TURN'
        }
      ];
      curState = {
        ...curState,
        enemies: [...curState.enemies, bomb],
        initiativeQueue: curState.initiativeQueue ? addToQueue(curState.initiativeQueue, bomb as Actor) : curState.initiativeQueue
      };
    } else {
      messages.push(`${enemy.subtype} failed to place bomb (blocked).`);
    }
    nextEnemy = { ...enemy, intent: undefined, intentPosition: undefined };
  } else if (enemy.intent === 'Casting' && enemy.intentPosition) {
    nextEnemy = { ...enemy, intent: undefined, intentPosition: undefined };
  } else {
    // Normal AI turn
    const { entity, nextState: aiState, message } = computeEnemyAction(enemy, state.player.position, curState);
    curState = aiState;
    nextEnemy = entity;

    // Check if enemy moved
    if (!hexEquals(entity.position, enemy.position)) {
      const moveEff: AtomicEffect = {
        type: 'Displacement',
        target: 'targetActor',
        destination: entity.position,
        source: enemy.position
      };

      // Revert temporary position update to let effect engine handle it (with interceptors)
      const tempEnemy = { ...entity, position: enemy.position };
      curState = {
        ...curState,
        enemies: curState.enemies.map(e => e.id === enemy.id ? tempEnemy : e)
      };

      // Apply displacement (will trigger slides/interceptors)
      curState = applyEffects(curState, [moveEff], { targetId: enemy.id });

      // Fetch updated enemy state (including potential slide position)
      nextEnemy = curState.enemies.find(e => e.id === enemy.id) || nextEnemy;
    }

    if (message) messages.push(message);
  }

  // Update enemy in state
  curState = {
    ...curState,
    enemies: curState.enemies.map(e => e.id === enemy.id ? nextEnemy : e)
  };

  // 2. Auto Attack (Punch) - based on turn start position
  const prevNeighbors = getNeighbors(turnStartPosition);
  // Important: applyAutoAttack needs to know about the initiative context or we pass prevNeighbors
  if (!startedStunned && !isStunned(nextEnemy as Actor)) {
    const autoAttackResult = applyAutoAttack(curState, nextEnemy, prevNeighbors, turnStartPosition, persistentTargetIds);
    curState = autoAttackResult.state;
    messages.push(...autoAttackResult.messages);
  }

  // 3. Centralized Stay Check (Lava, Fire, stay effects)
  const currentTile = UnifiedTileService.getTileAt(curState, nextEnemy.position);
  const stayResult = TileResolver.processStay(nextEnemy as Actor, currentTile, curState);

  if (stayResult.effects.length > 0) {
    curState = applyEffects(curState, stayResult.effects, { targetId: enemy.id });
    if (stayResult.effects.some(e => e.type === 'Damage' && e.reason === 'lava_tick')) {
      curState = applyEffects(curState, [JuiceHelpers.lavaRipple(nextEnemy.position)]);
    }
  }
  messages.push(...stayResult.messages);

  nextEnemy = curState.enemies.find(e => e.id === enemy.id) || nextEnemy;

  const isDead = nextEnemy.hp <= 0;
  if (isDead) {
    curState = { ...curState, enemies: curState.enemies.filter(e => e.id !== enemy.id) };
  } else {
    curState = {
      ...curState,
      enemies: curState.enemies.map(e => e.id === enemy.id ? nextEnemy : e)
    };
  }

  return { state: curState, messages, isDead };
};

/** 
 * LEGACY / BATCH COMPATIBILITY: 
 * Compute next enemy states (movement/intent) given playerMovedTo and state.
 */
export const computeNextEnemies = (state: GameState): { enemies: Entity[]; nextState: GameState; messages: string[]; dyingEntities: Entity[] } => {
  let curState = state;
  const messages: string[] = [];
  const dyingEntities: Entity[] = [];

  // This is now just a wrapper that processes everyone if no queue is available,
  // but ideally gameReducer handles the queue directly.
  for (const enemy of [...state.enemies]) {
    // If enemy was already killed by a previous one in the loop
    if (!curState.enemies.find(e => e.id === enemy.id)) continue;

    const { state: s2, messages: m2, isDead } = resolveSingleEnemyTurn(curState, enemy, enemy.position);
    curState = s2;
    messages.push(...m2);
    if (isDead) dyingEntities.push(enemy);
  }

  return { enemies: curState.enemies, nextState: curState, messages, dyingEntities };
};

export default {
  resolveTelegraphedAttacks,
  computeNextEnemies,
};
