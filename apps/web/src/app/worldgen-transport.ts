import type {
  GameState,
  FloorTheme,
  StartRunCompileContext,
  TransitionCompileContext,
} from '@hop/engine';

export interface SanitizedSkillCarryover {
  id: string;
  currentCooldown: number;
  activeUpgrades: string[];
  upgrades: string[];
}

export interface SanitizedCompanionCarryover {
  id: string;
  type: string;
  subtype?: string;
  position: { q: number; r: number; s: number };
  hp: number;
  maxHp: number;
  factionId: string;
  companionOf?: string;
}

export const sanitizeSkillCarryover = (
  activeSkills: GameState['player']['activeSkills']
): SanitizedSkillCarryover[] =>
  activeSkills.map((skill) => ({
    id: skill.id,
    currentCooldown: skill.currentCooldown ?? 0,
    activeUpgrades: [...(skill.activeUpgrades || [])],
    upgrades: [...(skill.upgrades || [])]
  }));

export const sanitizeCompanionCarryover = (
  companions: GameState['companions'] | undefined
): SanitizedCompanionCarryover[] =>
  (companions || []).map((companion) => ({
    id: companion.id,
    type: companion.type,
    subtype: companion.subtype,
    position: {
      q: companion.position.q,
      r: companion.position.r,
      s: companion.position.s
    },
    hp: companion.hp,
    maxHp: companion.maxHp,
    factionId: companion.factionId,
    companionOf: companion.companionOf
  }));

export const assertStructuredCloneSafeWorldgenPayload = <T>(payload: T): T => {
  if (!import.meta.env.DEV || typeof structuredClone !== 'function') {
    return payload;
  }
  try {
    structuredClone(payload);
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Worldgen payload failed structured clone validation';
    throw new Error(`Worldgen payload is not structured-clone safe: ${message}`);
  }
};

export const buildStartRunCompileContext = (context: StartRunCompileContext): StartRunCompileContext =>
  assertStructuredCloneSafeWorldgenPayload({
    ...context
  });

export const buildTransitionCompileContext = (
  gameState: GameState,
  includeDebug: boolean
): TransitionCompileContext =>
  assertStructuredCloneSafeWorldgenPayload({
    floor: gameState.floor + 1,
    initialSeed: gameState.initialSeed,
    rngSeed: gameState.rngSeed,
    mapSize: { width: gameState.gridWidth, height: gameState.gridHeight },
    mapShape: gameState.mapShape || 'diamond',
    themeId: gameState.theme as FloorTheme | undefined,
    contentThemeId: (gameState.contentTheme || gameState.theme) as FloorTheme | undefined,
    playerCarryover: {
      hp: gameState.player.hp,
      maxHp: gameState.player.maxHp,
      upgrades: [...gameState.upgrades],
      activeSkills: sanitizeSkillCarryover(gameState.player.activeSkills),
      archetype: gameState.player.archetype,
      kills: gameState.kills,
      environmentalKills: gameState.environmentalKills,
      turnsSpent: gameState.turnsSpent,
      hazardBreaches: gameState.hazardBreaches,
      combatScoreEvents: [...(gameState.combatScoreEvents || [])],
      dailyRunDate: gameState.dailyRunDate,
      runObjectives: [...(gameState.runObjectives || [])]
    },
    ruleset: gameState.ruleset as Record<string, unknown> | undefined,
    runTelemetry: gameState.runTelemetry,
    generationState: gameState.generationState!,
    migratingCompanions: sanitizeCompanionCarryover(gameState.companions),
    includeDebug
  });
