import type { GameState, Point, Entity } from './types';
import { hexEquals, hexDistance } from './hex';
import { computeEnemyAction } from './enemyAI';
import { applyDamage } from './actor';
// RNG helpers available if needed in future (consumeRandom, nextIdFromState)

/** Resolve telegraphed attacks: enemies that had intentPosition equal to player's moved-to hex. */
export const resolveTelegraphedAttacks = (state: GameState, playerMovedTo: Point): { player: Entity; messages: string[] } => {
  let player = state.player;
  const messages: string[] = [];

  state.enemies.forEach(e => {
    if (e.intentPosition && hexEquals(e.intentPosition, playerMovedTo)) {
      if (e.subtype === 'bomber') {
        // Bomber creates a bomb instead of direct damage
        messages.push(`${e.subtype} threw a bomb!`);
        // Bomb will be added during computeNextEnemies to avoid modifying state during forEach
      } else {
        player = applyDamage(player, 1);
        messages.push(`Hit by ${e.subtype}! (HP: ${player.hp}/${player.maxHp})`);
      }
    }
  });

  return { player, messages };
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

/** Compute next enemy states (movement/intent) given playerMovedTo and state.
 * Returns { enemies, nextState } where nextState has an updated rngCounter if randomness was consumed.
 */
export const computeNextEnemies = (state: GameState, playerMovedTo: Point): { enemies: Entity[]; nextState: GameState; messages: string[]; dyingEntities: Entity[] } => {
  let curState = state;
  const nextEnemies: Entity[] = [];
  const dyingEntities: Entity[] = [];
  const messages: string[] = [];

  // Initialize occupied positions with current player and all current enemies
  // (We'll update these as we iterate to prevent stacking)
  let occupiedCurrentTurn: Point[] = [state.player.position, ...state.enemies.map(e => e.position)];
  curState = { ...curState, occupiedCurrentTurn };

  // 1. Process existing bombs and telegraphed bomb spawns
  for (const bt of curState.enemies) {
    if (bt.subtype === 'bomb') {
      const timer = (bt.actionCooldown ?? 1) - 1;
      if (timer <= 0) {
        // Explode!
        messages.push("A bomb exploded!");
        if (hexDistance(bt.position, state.player.position) <= 1) {
          curState = { ...curState, player: applyDamage(curState.player, 1) };
          messages.push(`You were caught in the explosion! (HP: ${curState.player.hp}/${curState.player.maxHp})`);
        }
        continue;
      }
      nextEnemies.push({ ...bt, actionCooldown: timer });
      continue;
    }

    let nextEnemy: Entity;
    if (bt.isStunned) {
      nextEnemy = { ...bt, isStunned: false, intentPosition: undefined, intent: undefined };
    } else if (bt.intent === 'Bombing' && bt.intentPosition) {
      // BOMBER SPECIAL: If it just finished its telegraph, it spawns the bomb AND STAYS STILL
      messages.push(`${bt.subtype} placed a bomb.`);
      nextEnemies.push({
        id: `bomb_${bt.id}_${state.turn}`,
        type: 'enemy',
        subtype: 'bomb',
        position: bt.intentPosition,
        hp: 1,
        maxHp: 1,
        actionCooldown: 2, // 2 turn fuse
      });
      // The enemy stays at its current position and clears intent
      nextEnemy = { ...bt, intent: undefined, intentPosition: undefined };
    } else if (bt.intent === 'Casting' && bt.intentPosition) {
      // WARLOCK SPECIAL: If it just finished its telegraph, it resolves attack and stays still
      // (Adding this for consistency if we add warlock damage later, currently warlock just telegraphs)
      // For now, let's keep it simple: if it has a telegraphed intent being resolved, it's its action.
      nextEnemy = { ...bt, intent: undefined, intentPosition: undefined };
    } else {
      // Normal AI turn
      const { entity: moveResult, nextState: s2, message: aiMsg } = computeEnemyAction(bt, playerMovedTo, curState);
      curState = s2;
      nextEnemy = moveResult;
      if (aiMsg) messages.push(aiMsg);
    }

    // Update occupied positions for future enemies in this turn
    occupiedCurrentTurn = occupiedCurrentTurn.filter(p => !hexEquals(p, bt.position)); // Remove old pos
    occupiedCurrentTurn.push(nextEnemy.position); // Add new pos

    // SEQUENTIAL RESOLUTION: Update curState with the results of this specific enemy's turn
    // This ensures physical/state changes (like moving or randomness consumption) 
    // are visible to the next enemy in the list.
    const updatedEnemiesInState = curState.enemies.map(e => e.id === bt.id ? nextEnemy : e);
    curState = { ...curState, enemies: updatedEnemiesInState, occupiedCurrentTurn };

    // Footman passive punch: if player stayed adjacent
    if (nextEnemy.subtype === 'footman' && hexDistance(nextEnemy.position, playerMovedTo) === 1 && hexDistance(nextEnemy.position, state.player.position) === 1) {
      curState = { ...curState, player: applyDamage(curState.player, 1) };
      messages.push(`Footman punched you! (HP: ${curState.player.hp}/${curState.player.maxHp})`);
    }

    const { enemy: afterLava, messages: lavaMsgs } = applyLavaToEnemy(nextEnemy, curState);
    messages.push(...lavaMsgs);
    if (afterLava.hp > 0) {
      nextEnemies.push(afterLava);
    } else {
      dyingEntities.push(afterLava);
      // Remove from curState as well to prevent next enemies from seeing it
      curState = { ...curState, enemies: curState.enemies.filter(e => e.id !== afterLava.id) };
    }
  }

  // Clear internal tracking before returning
  const finalState = { ...curState, occupiedCurrentTurn: undefined };
  return { enemies: nextEnemies, nextState: finalState, messages, dyingEntities };
};

export default {
  resolveTelegraphedAttacks,
  applyLavaToEnemy,
  computeNextEnemies,
};
