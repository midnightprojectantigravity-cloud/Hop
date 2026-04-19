import { describe, expect, it } from 'vitest';
import {
  compilePendingFloorArtifact,
  compileStartRunArtifact,
  gameReducer,
  generateInitialState
} from '../index';
import {
  createPendingFloorCompileSession,
  createStartRunCompileSession
} from '../generation/worker-runtime';

const runSessionToResult = (session: ReturnType<typeof createStartRunCompileSession>) => {
    while (!session.isComplete()) {
        session.step(1);
    }

    const result = session.getResult();
    if (!result) {
        throw new Error('Expected worldgen runtime session to produce a result.');
    }
    return result;
};

describe('worldgen runtime session', () => {
    it('matches sync start-run artifact compilation', () => {
        const context = {
            loadoutId: 'VANGUARD',
            mode: 'normal' as const,
            seed: 'worldgen-runtime-start',
            mapSize: { width: 9, height: 11 },
            mapShape: 'diamond' as const,
            themeId: 'void' as const,
            includeDebug: false
        };

        const sessionArtifact = runSessionToResult(createStartRunCompileSession(context)).artifact;
        const syncArtifact = compileStartRunArtifact(context);

        expect(sessionArtifact).toEqual(syncArtifact);
        expect(sessionArtifact.theme).toBe('void');
    });

    it('matches sync pending-floor artifact compilation', () => {
        const hub = gameReducer(generateInitialState(1, 'worldgen-runtime-hub'), { type: 'EXIT_TO_HUB' });
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                mode: 'normal',
                seed: 'worldgen-runtime-pending',
                themeId: 'void'
            }
        });

        const context = {
            floor: run.floor + 1,
            initialSeed: run.initialSeed,
            rngSeed: run.rngSeed,
            mapSize: { width: run.gridWidth, height: run.gridHeight },
            mapShape: run.mapShape || 'diamond',
            themeId: run.theme,
            playerCarryover: {
                hp: run.player.hp,
                maxHp: run.player.maxHp,
                upgrades: [...run.upgrades],
                activeSkills: [],
                archetype: run.player.archetype,
                kills: run.kills,
                environmentalKills: run.environmentalKills,
                turnsSpent: run.turnsSpent,
                hazardBreaches: run.hazardBreaches,
                combatScoreEvents: [...(run.combatScoreEvents || [])],
                dailyRunDate: run.dailyRunDate,
                runObjectives: [...(run.runObjectives || [])]
            },
            ruleset: run.ruleset as Record<string, unknown> | undefined,
            runTelemetry: run.runTelemetry,
            generationState: run.generationState!,
            migratingCompanions: [],
            includeDebug: false
        };

        const sessionResult = runSessionToResult(createPendingFloorCompileSession(context));
        const syncArtifact = compilePendingFloorArtifact(context);

        expect(sessionResult.artifact).toEqual(syncArtifact);
        expect(sessionResult.artifact.theme).toBe('void');
    });
});
