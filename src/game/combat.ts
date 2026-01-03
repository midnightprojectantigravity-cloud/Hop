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
        messages.push(`Hit by ${e.subtype}!`);
      }
    }
  });

  return { player, messages };
};

/** Apply lava damage to an actor (enemy). Returns a new Entity with hp adjusted. */
export const applyLavaToEnemy = (enemy: Entity, state: GameState): Entity => {
  if (state.lavaPositions.some(lp => hexEquals(lp, enemy.position))) {
    return applyDamage(enemy, 99); // Instant kill
  }
  return enemy;
};

/** Compute next enemy states (movement/intent) given playerMovedTo and state.
 * Returns { enemies, nextState } where nextState has an updated rngCounter if randomness was consumed.
 */
export const computeNextEnemies = (state: GameState, playerMovedTo: Point): { enemies: Entity[]; nextState: GameState; messages: string[] } => {
  let curState = state;
  const nextEnemies: Entity[] = [];
  const messages: string[] = [];

  // 1. Process existing bombs and telegraphed bomb spawns
  for (const bt of curState.enemies) {
    if (bt.subtype === 'bomb') {
      const timer = (bt.actionCooldown ?? 1) - 1;
      if (timer <= 0) {
        // Explode!
        messages.push("A bomb exploded!");
        // Hit player if in range (same tile or adjacent depending on design, Hoplite is same tile + neighbors?)
        // Actually Hoplite bomber bomb hits target tile + all neighbors.
        if (hexDistance(bt.position, state.player.position) <= 1) {
          curState = { ...curState, player: applyDamage(curState.player, 1) };
          messages.push("You were caught in the explosion!");
        }
        // Hit other enemies? Yes
        // We'll filter them out in the next pass if they took damage
        continue;
      }
      nextEnemies.push({ ...bt, actionCooldown: timer });
      continue;
    }

    let nextEnemy: Entity;
    if (bt.isStunned) {
      nextEnemy = { ...bt, isStunned: false, intentPosition: undefined, intent: undefined };
    } else {
      const { entity: moveResult, nextState: s2 } = computeEnemyAction(bt, playerMovedTo, curState);
      curState = s2;
      nextEnemy = moveResult;

      // Handle telegraphed bomb spawn
      if (bt.intent === 'Bombing' && bt.intentPosition) {
        nextEnemies.push({
          id: `bomb_${bt.id}_${state.turn}`,
          type: 'enemy',
          subtype: 'bomb',
          position: bt.intentPosition,
          hp: 1,
          maxHp: 1,
          actionCooldown: 2, // 2 turn fuse
        });
      }
    }

    // Footman passive punch: if player stayed adjacent
    if (bt.subtype === 'footman' && hexDistance(bt.position, playerMovedTo) === 1 && hexDistance(bt.position, state.player.position) === 1) {
      curState = { ...curState, player: applyDamage(curState.player, 1) };
      messages.push(`Footman punched you!`);
    }

    const afterLava = applyLavaToEnemy(nextEnemy, curState);
    if (afterLava.hp > 0) nextEnemies.push(afterLava);
  }

  return { enemies: nextEnemies, nextState: curState, messages };
};

export default {
  resolveTelegraphedAttacks,
  applyLavaToEnemy,
  computeNextEnemies,
};
