import type { GameState, Point, Entity } from './types';
import { hexEquals } from './hex';
import { computeEnemyAction } from './enemyAI';
import { applyDamage } from './actor';
// RNG helpers available if needed in future (consumeRandom, nextIdFromState)

/** Resolve telegraphed attacks: enemies that had intentPosition equal to player's moved-to hex. */
export const resolveTelegraphedAttacks = (state: GameState, playerMovedTo: Point): { player: Entity; messages: string[] } => {
  let player = state.player;
  const messages: string[] = [];

  state.enemies.forEach(e => {
    if (e.intentPosition && hexEquals(e.intentPosition, playerMovedTo)) {
      // Use applyDamage helper so damage logic is centralized
      player = applyDamage(player, 1);
      messages.push(`Hit by ${e.subtype}!`);
    }
  });

  return { player, messages };
};

/** Apply lava damage to an actor (enemy). Returns a new Entity with hp adjusted. */
export const applyLavaToEnemy = (enemy: Entity, state: GameState): Entity => {
  if (state.lavaPositions.some(lp => hexEquals(lp, enemy.position))) {
    return applyDamage(enemy, 1);
  }
  return enemy;
};

/** Compute next enemy states (movement/intent) given playerMovedTo and state.
 * Returns { enemies, nextState } where nextState has an updated rngCounter if randomness was consumed.
 */
export const computeNextEnemies = (state: GameState, playerMovedTo: Point): { enemies: Entity[]; nextState: GameState } => {
  let curState = state;
  const nextEnemies: Entity[] = [];
  for (const bt of curState.enemies) {
    let nextEnemy: Entity;
    if (bt.isStunned) {
      // Stunned enemies skip turn and clear stun
      nextEnemy = { ...bt, isStunned: false, intentPosition: undefined, intent: undefined };
    } else {
      // computeEnemyAction now may consume RNG and return an updated state
      const { entity: moveResult, nextState } = computeEnemyAction(bt, playerMovedTo, curState);
      curState = nextState;
      nextEnemy = moveResult;
    }

    const afterLava = applyLavaToEnemy(nextEnemy, curState);
    if (afterLava.hp > 0) nextEnemies.push(afterLava);
  }

  return { enemies: nextEnemies, nextState: curState };
};

export default {
  resolveTelegraphedAttacks,
  applyLavaToEnemy,
  computeNextEnemies,
};
