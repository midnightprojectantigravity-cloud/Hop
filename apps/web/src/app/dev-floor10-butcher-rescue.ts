import {
  buildInitiativeQueue,
  createEnemyFromBestiary,
  getNeighbors,
  hexEquals,
  SpatialSystem,
  UnifiedTileService,
  type GameState,
  type Point,
} from '@hop/engine';

const FLOOR10_BUTCHER_SPAWN: Point = { q: 5, r: 2, s: -7 };
const DEFAULT_BUTCHER_ID = 'enemy_floor10_butcher';
const BUTCHER_ID_PATTERN = /butcher#([\w-]+)/i;

const resolveButcherId = (gameState: GameState): string => {
  const existing = gameState.enemies.find((enemy) => enemy.subtype === 'butcher');
  if (existing?.id) return existing.id;

  const messages = Array.isArray(gameState.message) ? [...gameState.message].reverse() : [];
  for (const entry of messages) {
    const match = String(entry).match(BUTCHER_ID_PATTERN);
    if (match?.[1]) return match[1];
  }

  return DEFAULT_BUTCHER_ID;
};

const hasOccupiedActor = (gameState: GameState, point: Point): boolean => {
  const actors = [
    gameState.player,
    ...gameState.enemies,
    ...(gameState.companions || []),
    ...(gameState.dyingEntities || [])
  ];

  return actors.some((actor) => actor?.position && hexEquals(actor.position, point));
};

const resolveButcherSpawn = (gameState: GameState): Point => {
  const candidates = [FLOOR10_BUTCHER_SPAWN, ...getNeighbors(FLOOR10_BUTCHER_SPAWN)];
  return candidates.find((point) =>
    UnifiedTileService.isWalkable(gameState, point) && !hasOccupiedActor(gameState, point)
  ) || FLOOR10_BUTCHER_SPAWN;
};

export const reviveFloor10ButcherState = (gameState: GameState): GameState | null => {
  if (gameState.gameStatus !== 'playing' || gameState.floor !== 10) {
    return null;
  }

  if (gameState.enemies.some((enemy) => enemy.subtype === 'butcher' && enemy.hp > 0)) {
    return null;
  }

  const position = resolveButcherSpawn(gameState);
  const butcher = {
    ...createEnemyFromBestiary({
      id: resolveButcherId(gameState),
      subtype: 'butcher',
      position
    }),
    previousPosition: position
  };

  const enemies = [
    ...gameState.enemies.filter((enemy) => enemy.subtype !== 'butcher'),
    butcher
  ].sort((left, right) => left.id.localeCompare(right.id));

  const baseState: GameState = {
    ...gameState,
    enemies,
    dyingEntities: (gameState.dyingEntities || []).filter((actor) => actor.subtype !== 'butcher'),
    message: [
      ...(gameState.message || []),
      '[INFO|SYSTEM] Debug: The Butcher rises again.'
    ]
  };

  return {
    ...baseState,
    occupancyMask: SpatialSystem.refreshOccupancyMask(baseState),
    initiativeQueue: buildInitiativeQueue(baseState)
  };
};
