import { describe, expect, it } from 'vitest';
import {
  compilePendingFloorArtifact,
  compileStartRunArtifact,
  gameReducer,
  generateInitialState,
  pointToKey
} from '@hop/engine';
import { resolvePendingStateAction } from '@hop/engine/logic-rules';
import {
  buildStartRunCompileContext,
  buildTransitionCompileContext,
} from '../app/worldgen-transport';
import {
  buildStartRunPayload,
  DEFAULT_START_RUN_MAP_SHAPE,
  DEFAULT_START_RUN_MAP_SIZE,
} from '../app/start-run-overrides';

const summarizeState = (state: ReturnType<typeof generateInitialState>) => ({
  floor: state.floor,
  gameStatus: state.gameStatus,
  map: {
    width: state.gridWidth,
    height: state.gridHeight,
    shape: state.mapShape
  },
  theme: state.theme,
  contentTheme: state.contentTheme,
  player: {
    position: pointToKey(state.player.position),
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    archetype: state.player.archetype,
    skills: state.player.activeSkills.map(skill => skill.id).sort()
  },
  stairsPosition: state.stairsPosition ? pointToKey(state.stairsPosition) : undefined,
  shrinePosition: state.shrinePosition ? pointToKey(state.shrinePosition) : undefined,
  enemies: state.enemies
    .map(enemy => `${enemy.id}:${enemy.subtype || 'none'}:${pointToKey(enemy.position)}:${enemy.hp}`)
    .sort(),
  rooms: (state.rooms || [])
    .map(room => `${room.id}:${room.type}:${pointToKey(room.center)}`)
    .sort(),
  tileDigest: Array.from(state.tiles.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, tile]) => `${key}:${tile.baseId}`)
    .join('|'),
  generation: {
    artifactDigest: state.generationState?.artifactDigest,
    directorEntropyKey: state.generationState?.directorEntropyKey,
    recentOutcomeQueue: state.generationState?.recentOutcomeQueue,
    moduleIds: state.generationState?.currentFloorSummary?.moduleIds || [],
    sceneId: state.generationState?.currentFloorSummary?.sceneSignature.sceneId,
    pathSummary: state.generationState?.currentFloorSummary?.pathSummary
  },
  generatedPaths: state.generatedPaths
    ? {
        mainLandmarkIds: state.generatedPaths.landmarks.filter(landmark => landmark.onPath).map(landmark => landmark.id).sort(),
        hiddenLandmarkIds: state.generatedPaths.landmarks.filter(landmark => !landmark.onPath).map(landmark => landmark.id).sort(),
        tacticalTileCount: state.generatedPaths.tacticalTileKeys.length,
        visualTileCount: state.generatedPaths.visualTileKeys.length
      }
    : undefined
});

describe('worldgen worker parity', () => {
  it('matches sync START_RUN when using the web transport compile context', () => {
    const hub = gameReducer(generateInitialState(1, 'web-worker-parity-hub'), { type: 'EXIT_TO_HUB' });
    const payload = buildStartRunPayload({
      loadoutId: 'VANGUARD',
      mode: 'normal',
      seed: 'web-worker-parity-start',
      mapSize: DEFAULT_START_RUN_MAP_SIZE,
      mapShape: DEFAULT_START_RUN_MAP_SHAPE,
      themeId: 'void',
      contentThemeId: 'inferno'
    });

    const context = buildStartRunCompileContext({
      loadoutId: payload.loadoutId,
      mode: payload.mode,
      seed: payload.seed,
      date: payload.date,
      mapSize: payload.mapSize,
      mapShape: payload.mapShape,
      themeId: payload.themeId,
      contentThemeId: payload.contentThemeId,
      generationSpec: payload.generationSpec,
      includeDebug: false
    });

    const artifact = compileStartRunArtifact(context);
    const artifactApplied = gameReducer(hub, {
      type: 'APPLY_WORLDGEN_ARTIFACT',
      payload: artifact
    });
    const direct = gameReducer(hub, {
      type: 'START_RUN',
      payload
    });

    expect(summarizeState(artifactApplied)).toEqual(summarizeState(direct));
  });

  it('matches sync pending resolution when using the web transport transition context', () => {
    const hub = gameReducer(generateInitialState(1, 'web-worker-parity-pending-hub'), { type: 'EXIT_TO_HUB' });
    const run = gameReducer(hub, {
      type: 'START_RUN',
      payload: {
        loadoutId: 'VANGUARD',
        mode: 'normal',
        seed: 'web-worker-parity-pending-run'
      }
    });

    const completedFloor = {
      ...run,
      turnsSpent: (run.turnsSpent || 0) + 7,
      hazardBreaches: (run.hazardBreaches || 0) + 1,
      kills: (run.kills || 0) + 2,
      combatScoreEvents: [...(run.combatScoreEvents || []), {} as any, {} as any] as any,
      player: {
        ...run.player,
        hp: Math.max(1, run.player.maxHp - 2)
      },
      runTelemetry: {
        ...run.runTelemetry,
        damageTaken: run.runTelemetry.damageTaken + 3,
        controlIncidents: run.runTelemetry.controlIncidents + 1
      },
      pendingStatus: {
        status: 'playing' as const
      },
      pendingFrames: []
    };

    const context = buildTransitionCompileContext(completedFloor, false);
    const artifact = compilePendingFloorArtifact(context);
    const artifactApplied = gameReducer(completedFloor, {
      type: 'APPLY_WORLDGEN_ARTIFACT',
      payload: artifact
    });
    const direct = resolvePendingStateAction(completedFloor, { generateInitialState });

    expect(summarizeState(artifactApplied)).toEqual(summarizeState(direct));
  });
});
