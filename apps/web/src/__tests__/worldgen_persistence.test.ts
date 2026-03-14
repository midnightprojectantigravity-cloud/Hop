import { describe, expect, it } from 'vitest';
import {
  advanceGenerationStateFromCompletedFloor,
  compilePendingFloorArtifact,
  generateInitialState,
} from '@hop/engine';
import {
  hydratePersistedGameState,
  serializePersistedGameState,
} from '../app/use-persisted-game-state';
import { buildTransitionCompileContext } from '../app/worldgen-transport';

describe('worldgen persistence', () => {
  it('strips worldgenDebug while preserving recentOutcomeQueue and directorEntropyKey across save/load', () => {
    const base = generateInitialState(1, 'web-persist-seed', 'web-persist-seed');
    const completedFloor = {
      ...base,
      turnsSpent: (base.turnsSpent || 0) + 5,
      hazardBreaches: (base.hazardBreaches || 0) + 1,
      kills: (base.kills || 0) + 2,
      combatScoreEvents: [...(base.combatScoreEvents || []), {} as any, {} as any] as any,
      player: {
        ...base.player,
        hp: Math.max(1, base.player.maxHp - 1)
      },
      runTelemetry: {
        ...base.runTelemetry,
        damageTaken: base.runTelemetry.damageTaken + 2,
        controlIncidents: base.runTelemetry.controlIncidents + 1
      }
    };

    const advancedGenerationState = advanceGenerationStateFromCompletedFloor(completedFloor);
    const saveCandidate = {
      ...completedFloor,
      generationState: advancedGenerationState,
      worldgenDebug: {
        verificationReport: { code: 'DEBUG_ONLY' }
      } as any
    };

    const serialized = serializePersistedGameState(saveCandidate);
    expect(serialized).toBeTruthy();

    const parsed = JSON.parse(serialized!);
    expect(parsed.worldgenDebug).toBeUndefined();
    expect(parsed.generationState.recentOutcomeQueue).toEqual(advancedGenerationState.recentOutcomeQueue);
    expect(parsed.generationState.directorEntropyKey).toBe(advancedGenerationState.directorEntropyKey);
    expect(parsed.generatedPaths?.visualTileKeys?.length).toBeGreaterThan(0);

    const hydrated = hydratePersistedGameState(serialized);
    expect(hydrated.worldgenDebug).toBeUndefined();
    expect(hydrated.generationState?.recentOutcomeQueue).toEqual(advancedGenerationState.recentOutcomeQueue);
    expect(hydrated.generationState?.directorEntropyKey).toBe(advancedGenerationState.directorEntropyKey);
    expect(hydrated.generatedPaths).toEqual(saveCandidate.generatedPaths);

    const artifactBeforeHydrate = compilePendingFloorArtifact(buildTransitionCompileContext(saveCandidate, false));
    const artifactAfterHydrate = compilePendingFloorArtifact(buildTransitionCompileContext(hydrated, false));

    expect(artifactAfterHydrate.artifactDigest).toBe(artifactBeforeHydrate.artifactDigest);
    expect(artifactAfterHydrate.generationDelta.directorEntropyKey).toBe(artifactBeforeHydrate.generationDelta.directorEntropyKey);
    expect(artifactAfterHydrate.pathNetwork).toEqual(artifactBeforeHydrate.pathNetwork);
  });
});
