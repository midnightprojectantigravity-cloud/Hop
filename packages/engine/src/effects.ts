import type { GameState, Actor, AtomicEffect, Point, Skill } from './types';

export interface EffectExecutionResult {
  state: GameState;
  messages: string[];
  interrupted?: boolean; // whether execution was interrupted (e.g., actor died in lava)
  logs?: string[]; // optional developer logs for test assertions
}

const pointEquals = (a?: Point, b?: Point) => !!a && !!b && a.q === b.q && a.r === b.r && a.s === b.s;

const isWall = (state: GameState, p: Point) => (state.wallPositions || []).some(w => pointEquals(w, p));

const isLava = (state: GameState, p: Point) => (state.lavaPositions || []).some(l => pointEquals(l, p));

const actorAt = (state: GameState, p: Point) => {
  if (pointEquals(state.player.position, p)) return state.player;
  return (state.enemies || []).find(e => pointEquals(e.position, p));
};

const occupyTile = (state: GameState, p: Point) => {
  state.occupiedCurrentTurn = state.occupiedCurrentTurn || [];
  state.occupiedCurrentTurn.push(p);
};

const removeEnemyById = (state: GameState, id: string) => {
  state.enemies = (state.enemies || []).filter(e => e.id !== id);
};

export function executeAtomicEffects(stateIn: GameState, actor: Actor, effects: AtomicEffect[], targetPoint?: Point): EffectExecutionResult {
  const state = { ...stateIn } as GameState;
  state.occupiedCurrentTurn = state.occupiedCurrentTurn || [];
  const messages: string[] = [];
  const logs: string[] = [];

  const getActorBySpecifier = (spec: 'self' | 'targetActor') => {
    if (spec === 'self') return actor;
    if (spec === 'targetActor') {
      if (!targetPoint) return undefined;
      return actorAt(state, targetPoint as Point) as Actor | undefined;
    }
    return undefined;
  };

  const moveActorTo = (a: Actor, dest: Point) => {
    // Wall blocks
    if (isWall(state, dest)) {
      logs.push(`move-blocked-wall:${a.id}`);
      return { moved: false, reason: 'wall' };
    }
    // Occupied -> stacking prevention
    const occ = actorAt(state, dest);
    if (occ && occ.id !== a.id) {
      logs.push(`move-blocked-occupied:${a.id}->${occ.id}`);
      return { moved: false, reason: 'occupied', occupant: occ };
    }
    // perform move
    if (state.player.id === a.id) state.player = { ...state.player, position: dest };
    else state.enemies = (state.enemies || []).map(e => e.id === a.id ? { ...e, position: dest } : e);
    occupyTile(state, dest);
    // lava check
    if (isLava(state, dest)) {
      // actor dies / removed
      if (a.type === 'enemy') removeEnemyById(state, a.id);
      else state.player.hp = 0;
      logs.push(`actor-in-lava:${a.id}`);
      return { moved: true, diedInLava: true };
    }
    return { moved: true };
  };

  for (const eff of effects) {
    if (eff.type === 'Message') {
      messages.push(eff.text);
      logs.push(`msg:${eff.text}`);
      continue;
    }

    if (eff.type === 'Juice') {
      // small mapping for animations
      if (eff.effect === 'spearTrail' && eff.path) state.lastSpearPath = eff.path;
      if (eff.effect === 'shake') state.isShaking = true;
      continue;
    }

    if (eff.type === 'SpawnItem') {
      // limited to spear/shield for now
      if (eff.itemType === 'spear') state.spearPosition = eff.position;
      if (eff.itemType === 'shield') state.shieldPosition = eff.position;
      logs.push(`spawn:${eff.itemType}@${eff.position.q},${eff.position.r}`);
      continue;
    }

    if (eff.type === 'Damage') {
      if (eff.target === 'targetActor' && targetPoint) {
        const t = actorAt(state, targetPoint);
        if (t) {
          if (t.type === 'enemy') {
            state.enemies = (state.enemies || []).map(e => e.id === t.id ? { ...e, hp: Math.max(0, e.hp - eff.amount) } : e);
            logs.push(`damage:${t.id}:${eff.amount}`);
            // remove dead enemies immediately
            state.enemies = (state.enemies || []).filter(e => e.hp > 0);
          } else if (t.type === 'player') {
            state.player.hp = Math.max(0, state.player.hp - eff.amount);
            logs.push(`damage:player:${eff.amount}`);
          }
        }
      } else if (typeof eff.target === 'object') {
        // point-based area
        const t = actorAt(state, eff.target as Point);
        if (t) {
          if (t.type === 'enemy') state.enemies = (state.enemies || []).map(e => e.id === t.id ? { ...e, hp: Math.max(0, e.hp - eff.amount) } : e);
          else state.player.hp = Math.max(0, state.player.hp - eff.amount);
        }
      }
      continue;
    }

    if (eff.type === 'ApplyStatus') {
      let t: Actor | undefined;

      if (eff.target === 'targetActor') {
        if (targetPoint) {
          t = actorAt(state, targetPoint);
          logs.push(`trace:status-targetActor-at-${targetPoint.q},${targetPoint.r}`);
        } else {
          logs.push(`trace:status-failed-no-targetPoint`);
        }
      } else {
        // eff.target is a Point
        const p = eff.target as Point;
        t = actorAt(state, p);
        logs.push(`trace:status-point-at-${p.q},${p.r}`);
      }

      if (t) {
        logs.push(`trace:status-applying-${eff.status}-to-${t.id}`);
        // Add status effect entry instead of boolean flag
        if (t.type === 'enemy') {
          state.enemies = (state.enemies || []).map(e => e.id === t?.id ? ({ ...e, statusEffects: (e.statusEffects || []).concat([{ id: `${e.id}-${eff.status}`, type: eff.status as any, duration: eff.duration }]) }) : e);
        } else {
          state.player = { ...state.player, statusEffects: (state.player.statusEffects || []).concat([{ id: `${state.player.id}-${eff.status}`, type: eff.status as any, duration: eff.duration }]) } as any;
        }
        logs.push(`status:${t.id}:${eff.status}`);
      } else {
        // This is likely why you don't see the stun!
        logs.push(`trace:status-no-actor-found-at-target`);
      }
      continue;
    }

    if (eff.type === 'Displacement') {
      const targetActor = getActorBySpecifier(eff.target);
      if (!targetActor) {
        logs.push('displacement-no-target');
        continue;
      }
      const dest = eff.destination;
      const res = moveActorTo(targetActor, dest);
        if (res.diedInLava) {
        messages.push(`
${targetActor.type === 'enemy' ? 'Enemy' : 'Player'} consumed by Lava.`.trim());
        logs.push(`died-by-lava:${targetActor.id}`);
        return { state, messages, interrupted: true, logs };
      }
      if (!res.moved && res.reason === 'wall') {
        // wall impact behavior: stun the target
          if (targetActor.type === 'enemy') {
            state.enemies = (state.enemies || []).map(e => e.id === targetActor.id ? ({ ...e, statusEffects: (e.statusEffects || []).concat([{ id: `${e.id}-stunned`, type: 'stunned', duration: 1 }]) }) : e);
          } else {
            state.player = { ...state.player, statusEffects: (state.player.statusEffects || []).concat([{ id: `${state.player.id}-stunned`, type: 'stunned', duration: 1 }]) } as any;
          }
        messages.push('Impact! Stunned.');
      }
      // occupied resolution is left to higher-level chain resolver for now
      continue;
    }

    if (eff.type === 'ModifyCooldown') {
      // find skill on actor
      const sList: Skill[] = actor.activeSkills || [];
      const sk = sList.find(s => s.id === eff.skillId);
      if (sk) {
        if (eff.setExact) sk.currentCooldown = eff.amount;
        else sk.currentCooldown = Math.max(0, (sk.currentCooldown || 0) + eff.amount);
        logs.push(`modify-cd:${sk.id}:${sk.currentCooldown}`);
      }
      continue;
    }
  }

  return { state, messages, logs };
}

export default { executeAtomicEffects };
