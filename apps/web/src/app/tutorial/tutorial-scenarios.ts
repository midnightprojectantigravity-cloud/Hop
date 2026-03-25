import {
  DEFAULT_LOADOUTS,
  buildInitiativeQueue,
  generateInitialState,
  getEnemyCatalogEntry,
  recomputeVisibility,
  type GameState,
  type Point
} from '@hop/engine';
import type { TutorialStepId } from './tutorial-state-machine';

export type GuidedTutorialStep = {
  id: TutorialStepId;
  title: string;
  body: string;
  allowedActionLabel: string;
  state: GameState;
};

const adjacentHex = (origin: Point): Point => ({
  q: origin.q + 1,
  r: origin.r - 1,
  s: origin.s
});

const buildBaseTutorialState = (seed: string): GameState => {
  const base = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS.VANGUARD);
  base.turnNumber = 1;
  base.pendingFrames = [];
  base.gameStatus = 'playing';
  return base;
};

const buildMovementTutorialState = (): GameState => {
  const state = buildBaseTutorialState('guided-tutorial-movement');
  state.enemies = [];
  state.companions = [];
  state.initiativeQueue = buildInitiativeQueue(state);
  return recomputeVisibility(state);
};

const buildAttackTutorialState = (): GameState => {
  const state = buildBaseTutorialState('guided-tutorial-attack');
  const playerPos = state.player.position;
  const pos = adjacentHex(playerPos);
  const enemyStats = getEnemyCatalogEntry('footman')?.bestiary.stats;
  state.enemies = [{
    id: 'tutorial_footman',
    type: 'enemy',
    subtype: 'footman',
    position: pos,
    previousPosition: pos,
    hp: Math.max(3, enemyStats?.hp ?? 6),
    maxHp: Math.max(3, enemyStats?.maxHp ?? 6),
    enemyType: enemyStats?.type ?? 'melee',
    statusEffects: [],
    temporaryArmor: 0,
    activeSkills: [],
    speed: enemyStats?.speed ?? 1,
    factionId: 'enemy'
  } as GameState['enemies'][number]];
  state.companions = [];
  state.initiativeQueue = buildInitiativeQueue(state);
  return recomputeVisibility(state);
};

const buildWaitTutorialState = (): GameState => {
  const state = buildBaseTutorialState('guided-tutorial-wait');
  const playerPos = state.player.position;
  const pos = adjacentHex(playerPos);
  const enemyStats = getEnemyCatalogEntry('archer')?.bestiary.stats;
  state.enemies = [{
    id: 'tutorial_archer',
    type: 'enemy',
    subtype: 'archer',
    position: pos,
    previousPosition: pos,
    hp: Math.max(2, enemyStats?.hp ?? 4),
    maxHp: Math.max(2, enemyStats?.maxHp ?? 4),
    enemyType: enemyStats?.type ?? 'ranged',
    statusEffects: [],
    temporaryArmor: 0,
    activeSkills: [],
    speed: enemyStats?.speed ?? 1,
    factionId: 'enemy'
  } as GameState['enemies'][number]];
  state.companions = [];
  state.initiativeQueue = buildInitiativeQueue(state);
  return recomputeVisibility(state);
};

const GUIDED_TUTORIAL_STEPS: Record<TutorialStepId, GuidedTutorialStep> = {
  movement: {
    id: 'movement',
    title: 'Step 1: Move',
    body: 'Tap a reachable tile to move. This teaches tile selection and movement range first.',
    allowedActionLabel: 'Move to a tile',
    state: buildMovementTutorialState()
  },
  attack: {
    id: 'attack',
    title: 'Step 2: Attack',
    body: 'Select an attack skill, then tap the nearby enemy. Watch the board resolve the action and enemy response.',
    allowedActionLabel: 'Use an attack skill',
    state: buildAttackTutorialState()
  },
  wait: {
    id: 'wait',
    title: 'Step 3: Wait',
    body: 'Use Wait to end your turn safely when you do not want to commit another action.',
    allowedActionLabel: 'Press Wait',
    state: buildWaitTutorialState()
  }
};

export const getGuidedTutorialStep = (stepId: TutorialStepId): GuidedTutorialStep => GUIDED_TUTORIAL_STEPS[stepId];
