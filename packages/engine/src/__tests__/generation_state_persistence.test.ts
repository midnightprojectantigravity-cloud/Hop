import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { hydrateLoadedState } from '../logic-rules';
import { advanceGenerationStateFromCompletedFloor, compilePendingFloorArtifact } from '../generation';

describe('generation state persistence', () => {
    it('preserves exact recent outcome queue entries across hydration', () => {
        const base = generateInitialState(1, 'generation-queue-seed', 'generation-queue-seed');
        const withHistory = {
            ...base,
            turnsSpent: (base.generationState?.currentTelemetry.baselineTurnsSpent || 0) + 6,
            hazardBreaches: (base.generationState?.currentTelemetry.baselineHazardBreaches || 0) + 1,
            kills: (base.generationState?.currentTelemetry.baselineKills || 0) + 2,
            combatScoreEvents: new Array((base.generationState?.currentTelemetry.baselineCombatEventCount || 0) + 3).fill({}),
            player: {
                ...base.player,
                hp: Math.max(1, base.player.maxHp - 1)
            },
            generationState: {
                ...base.generationState!,
                recentOutcomeQueue: [
                    {
                        floorIndex: 1,
                        snapshotId: 'old-1',
                        bucketIds: {
                            completionPace: 1,
                            resourceStress: 1,
                            hazardPressure: 0,
                            controlStability: 1,
                            combatDominance: 1,
                            recoveryUse: 0
                        }
                    },
                    {
                        floorIndex: 2,
                        snapshotId: 'old-2',
                        bucketIds: {
                            completionPace: 2,
                            resourceStress: 1,
                            hazardPressure: 1,
                            controlStability: 1,
                            combatDominance: 1,
                            recoveryUse: 0
                        }
                    },
                    {
                        floorIndex: 3,
                        snapshotId: 'old-3',
                        bucketIds: {
                            completionPace: 2,
                            resourceStress: 2,
                            hazardPressure: 1,
                            controlStability: 2,
                            combatDominance: 1,
                            recoveryUse: 1
                        }
                    }
                ]
            }
        };

        const advanced = advanceGenerationStateFromCompletedFloor(withHistory);
        expect(advanced.recentOutcomeQueue).toHaveLength(3);
        expect(advanced.recentOutcomeQueue[0].snapshotId).toBe('old-2');
        expect(advanced.recentOutcomeQueue[1].snapshotId).toBe('old-3');

        const hydrated = hydrateLoadedState({
            ...withHistory,
            generationState: advanced,
            tiles: Array.from(withHistory.tiles.entries()).map(([key, tile]) => [key, {
                ...tile,
                traits: Array.from(tile.traits)
            }]) as any
        } as any);

        expect(hydrated.generationState?.recentOutcomeQueue).toEqual(advanced.recentOutcomeQueue);
        expect(hydrated.generationState?.directorEntropyKey).toEqual(advanced.directorEntropyKey);

        const buildTransitionContext = (state: typeof hydrated) => ({
            floor: state.floor + 1,
            initialSeed: state.initialSeed,
            rngSeed: state.rngSeed,
            mapSize: { width: state.gridWidth, height: state.gridHeight },
            mapShape: state.mapShape || 'diamond',
            playerCarryover: {
                hp: state.player.hp,
                maxHp: state.player.maxHp,
                upgrades: [...state.upgrades],
                activeSkills: [],
                archetype: state.player.archetype,
                kills: state.kills,
                environmentalKills: state.environmentalKills,
                turnsSpent: state.turnsSpent,
                hazardBreaches: state.hazardBreaches,
                combatScoreEvents: state.combatScoreEvents
            },
            runTelemetry: state.runTelemetry,
            generationState: state.generationState!
        });

        const compiledBeforeHydrate = compilePendingFloorArtifact(buildTransitionContext({
            ...withHistory,
            generationState: advanced
        } as any));
        const compiledAfterHydrate = compilePendingFloorArtifact(buildTransitionContext(hydrated));

        expect(compiledAfterHydrate.artifactDigest).toBe(compiledBeforeHydrate.artifactDigest);
        expect(compiledAfterHydrate.generationDelta.directorEntropyKey).toBe(compiledBeforeHydrate.generationDelta.directorEntropyKey);
    });

    it('accumulates director redline band from IRES floor telemetry deltas', () => {
        const base = generateInitialState(1, 'generation-redline-seed', 'generation-redline-seed');
        const advanced = advanceGenerationStateFromCompletedFloor({
            ...base,
            runTelemetry: {
                ...base.runTelemetry,
                exhaustionGained: 60,
                sparkBurnHpLost: 6,
                redlineActions: 3,
                exhaustedTurns: 2
            }
        });

        expect(advanced.recentOutcomeQueue).toHaveLength(1);
        expect(advanced.recentOutcomeQueue[0]?.bucketIds.resourceStress).toBe(2);
        expect(advanced.directorState.redlineBand).toBe(4);
    });
});
