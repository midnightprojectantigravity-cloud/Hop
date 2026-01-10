/**
 * COMBAT SYSTEM
 * Manages telegraphed attacks and enemy turn resolution.
 * TODO: Fully migrate telegraphed attacks to the SkillDefinition/COMPOSITIONAL_SKILLS system.
 */
import type { GameState, Point, Entity, AtomicEffect } from './types';
import { hexEquals, hexDistance, getNeighbors } from './hex';
import { computeEnemyAction } from './enemyAI';
import { applyDamage } from './actor';
import { applyAutoAttack } from './skills/auto_attack';
import { COMPOSITIONAL_SKILLS } from './skillRegistry';
import { applyEffects } from './effectEngine';
import { isStunned } from './helpers';
// RNG helpers available if needed in future (consumeRandom, nextIdFromState)

export const resolveTelegraphedAttacks = (state: GameState, playerMovedTo: Point, targetActorId?: string): { state: GameState; messages: string[] } => {
  let curState = state;
  const messages: string[] = [];

  const actorsToProcess = targetActorId
    ? state.enemies.filter(e => e.id === targetActorId)
    : state.enemies;

  const nextEnemies = [...curState.enemies];

  actorsToProcess.forEach(e => {
    if (e.intent && e.intentPosition) {
      let enemyHandled = false;
      // 1. Try to find a compositional skill that matches the intent
      const skillDef = COMPOSITIONAL_SKILLS[e.intent];
      const activeSkill = e.activeSkills?.find(s => s.id === e.intent);

      if (skillDef && activeSkill) {
        // Execute skill AT THE INTENDED POSITION
        // We pass curState which has the player at playerMovedTo
        const result = skillDef.execute(curState, e, e.intentPosition, activeSkill.activeUpgrades);
        curState = applyEffects(curState, result.effects, { targetId: curState.player.id });
        messages.push(...result.messages);
        enemyHandled = true;
      } else if (e.subtype === 'bomber') {
        // Bomber logic is handled in resolveSingleEnemyTurn / computeNextEnemies
      } else if (hexEquals(e.intentPosition, playerMovedTo)) {
        // Fallback to legacy damage if it was a basic attack intent
        curState = { ...curState, player: applyDamage(curState.player, 1) };
        messages.push(`Hit by ${e.subtype}! (HP: ${curState.player.hp}/${curState.player.maxHp})`);
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

/** Apply lava damage to an actor (enemy). Returns a new Entity with hp adjusted and messages. */
export const applyLavaToEnemy = (enemy: Entity, state: GameState): { enemy: Entity; messages: string[] } => {
  const messages: string[] = [];
  if (state.lavaPositions.some(lp => hexEquals(lp, enemy.position))) {
    const name = enemy.subtype ? enemy.subtype.charAt(0).toUpperCase() + enemy.subtype.slice(1) : 'Enemy';
    messages.push(`${name} fell into Lava!`);
    return { enemy: applyDamage(enemy, 99), messages }; // Instant kill
  }
  return { enemy, messages };
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

  // 1. Process Bomb self-ticks
  if (enemy.subtype === 'bomb') {
    const timer = (enemy.actionCooldown ?? 1) - 1;
    if (timer <= 0) {
      messages.push("A bomb exploded!");
      if (hexDistance(enemy.position, state.player.position) <= 1) {
        curState = { ...curState, player: applyDamage(curState.player, 1) };
        messages.push(`You were caught in the explosion! (HP: ${curState.player.hp}/${curState.player.maxHp})`);
      }
      return { state: curState, messages, isDead: true };
    }
    nextEnemy = { ...enemy, actionCooldown: timer };
  } else if (isStunned(enemy)) {
    // Tick down stun
    const nextStatuses = enemy.statusEffects.map(s => s.type === 'stunned' ? { ...s, duration: s.duration - 1 } : s).filter(s => s.duration !== 0);
    nextEnemy = { ...enemy, statusEffects: nextStatuses, intentPosition: undefined, intent: undefined };
  } else if (enemy.intent === 'Bombing' && enemy.intentPosition) {
    messages.push(`${enemy.subtype} placed a bomb.`);
    const bombId = `bomb_${enemy.id}_${state.turn}`;
    const bomb: Entity = {
      id: bombId,
      type: 'enemy',
      subtype: 'bomb',
      position: enemy.intentPosition,
      hp: 1,
      maxHp: 1,
      actionCooldown: 2,
      statusEffects: [],
      temporaryArmor: 0,
      activeSkills: [],
    };
    curState = { ...curState, enemies: [...curState.enemies, bomb] };
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
  const autoAttackResult = applyAutoAttack(curState, nextEnemy, prevNeighbors);
  curState = autoAttackResult.state;
  messages.push(...autoAttackResult.messages);

  // 3. Lava Check
  const { enemy: afterLava, messages: lavaMsgs } = applyLavaToEnemy(nextEnemy, curState);
  messages.push(...lavaMsgs);

  const isDead = afterLava.hp <= 0;
  if (isDead) {
    curState = { ...curState, enemies: curState.enemies.filter(e => e.id !== enemy.id) };
  } else {
    curState = {
      ...curState,
      enemies: curState.enemies.map(e => e.id === enemy.id ? afterLava : e)
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
  applyLavaToEnemy,
  computeNextEnemies,
};
