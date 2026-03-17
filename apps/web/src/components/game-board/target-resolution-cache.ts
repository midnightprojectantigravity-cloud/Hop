import {
  previewActionOutcome,
  resolveMovementPreviewPath,
  type ActionResourcePreview,
  type GameState,
  type IresTurnProjection,
  type Point,
} from '@hop/engine';

type PreviewOutcome = ReturnType<typeof previewActionOutcome>;
type MovementPreview = ReturnType<typeof resolveMovementPreviewPath>;

export type TargetResolutionCache = WeakMap<GameState, Map<string, readonly Point[]>>;

const targetResolutionCache: TargetResolutionCache = new WeakMap();
const actionPreviewCache: WeakMap<GameState, Map<string, PreviewOutcome>> = new WeakMap();
const movementPreviewCache: WeakMap<GameState, Map<string, MovementPreview>> = new WeakMap();

const pointKey = (point: Point): string => `${point.q},${point.r},${point.s}`;

const getCachedMap = <T,>(cache: WeakMap<GameState, Map<string, T>>, gameState: GameState): Map<string, T> => {
  let map = cache.get(gameState);
  if (!map) {
    map = new Map<string, T>();
    cache.set(gameState, map);
  }
  return map;
};

export const getCachedSkillTargets = ({
  gameState,
  actorId,
  skillId,
  origin,
  resolver,
}: {
  gameState: GameState;
  actorId: string;
  skillId: string;
  origin: Point;
  resolver: () => Point[];
}): readonly Point[] => {
  const cacheKey = `${actorId}:${skillId}:${pointKey(origin)}`;
  const cache = getCachedMap(targetResolutionCache, gameState);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const resolved = resolver();
  cache.set(cacheKey, resolved);
  return resolved;
};

export const getCachedActionPreviewOutcome = ({
  gameState,
  actorId,
  skillId,
  target,
  activeUpgradeIds = [],
}: {
  gameState: GameState;
  actorId: string;
  skillId: string;
  target: Point;
  activeUpgradeIds?: ReadonlyArray<string>;
}): PreviewOutcome => {
  const cacheKey = `${actorId}:${skillId}:${pointKey(target)}:${activeUpgradeIds.join(',')}`;
  const cache = getCachedMap(actionPreviewCache, gameState);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const resolved = previewActionOutcome(gameState, {
    actorId,
    skillId,
    target,
    activeUpgrades: [...activeUpgradeIds],
  });
  cache.set(cacheKey, resolved);
  return resolved;
};

export const getCachedMovementPreviewPath = ({
  gameState,
  actor,
  skillId,
  target,
}: {
  gameState: GameState;
  actor: GameState['player'];
  skillId: 'BASIC_MOVE' | 'DASH' | 'JUMP';
  target: Point;
}): MovementPreview => {
  const cacheKey = `${actor.id}:${skillId}:${pointKey(target)}`;
  const cache = getCachedMap(movementPreviewCache, gameState);
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const resolved = resolveMovementPreviewPath(gameState, actor, skillId, target);
  cache.set(cacheKey, resolved);
  return resolved;
};

export const collectUniqueSkillTargetsCached = (
  gameState: GameState,
  actorId: string,
  origin: Point,
  skillIds: ReadonlyArray<string>,
  resolverBySkillId: (skillId: string) => (() => Point[]) | null | undefined,
): Point[] => {
  const validSet = new Set<string>();
  const results: Point[] = [];

  for (const skillId of skillIds) {
    const resolver = resolverBySkillId(skillId);
    if (!resolver) continue;
    const cachedTargets = getCachedSkillTargets({
      gameState,
      actorId,
      skillId,
      origin,
      resolver,
    });
    for (const target of cachedTargets) {
      const key = pointKey(target);
      if (validSet.has(key)) continue;
      validSet.add(key);
      results.push(target);
    }
  }

  return results;
};

export type CachedPreviewSummary = {
  resourcePreview?: ActionResourcePreview;
  turnProjection?: IresTurnProjection;
};
