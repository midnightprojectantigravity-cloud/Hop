import { describe, expect, it } from 'vitest';
import { gameReducer, generateInitialState, pointToKey } from '../index';
import { resolvePendingStateAction } from '../logic-rules';
import { compilePendingFloorArtifact, compileStartRunArtifact } from '../generation';

const summarizeState = (state: ReturnType<typeof generateInitialState>) => ({
    floor: state.floor,
    gameStatus: state.gameStatus,
    gridWidth: state.gridWidth,
    gridHeight: state.gridHeight,
    mapShape: state.mapShape,
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
        : undefined,
    visibility: state.visibility
        ? {
            visibleTileKeys: [...state.visibility.playerFog.visibleTileKeys],
            exploredTileKeys: [...state.visibility.playerFog.exploredTileKeys],
            visibleActorIds: [...state.visibility.playerFog.visibleActorIds],
            detectedActorIds: [...state.visibility.playerFog.detectedActorIds],
        }
        : undefined
});

describe('worldgen artifact application parity', () => {
    it('matches START_RUN reducer output when applying a compiled start-run artifact', () => {
        const hub = gameReducer(generateInitialState(1, 'artifact-start-hub'), { type: 'EXIT_TO_HUB' });
        const seed = 'artifact-start-run-seed';

        const artifact = compileStartRunArtifact({
            loadoutId: 'VANGUARD',
            mode: 'normal',
            seed,
            mapSize: { width: hub.gridWidth, height: hub.gridHeight },
            mapShape: hub.mapShape
        });

        const artifactApplied = gameReducer(hub, {
            type: 'APPLY_WORLDGEN_ARTIFACT',
            payload: artifact
        });
        const direct = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                mode: 'normal',
                seed
            }
        });

        expect(summarizeState(artifactApplied)).toEqual(summarizeState(direct));
    });

    it('matches sync pending-floor resolution when applying a compiled transition artifact', () => {
        const hub = gameReducer(generateInitialState(1, 'artifact-pending-hub'), { type: 'EXIT_TO_HUB' });
        const run = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                mode: 'normal',
                seed: 'artifact-pending-run-seed'
            }
        });

        const completedFloor = {
            ...run,
            turnsSpent: (run.turnsSpent || 0) + 6,
            hazardBreaches: (run.hazardBreaches || 0) + 1,
            kills: (run.kills || 0) + 2,
            combatScoreEvents: [...(run.combatScoreEvents || []), {} as any, {} as any] as any,
            player: {
                ...run.player,
                hp: Math.max(1, run.player.maxHp - 1)
            },
            runTelemetry: {
                ...run.runTelemetry,
                damageTaken: run.runTelemetry.damageTaken + 2,
                controlIncidents: run.runTelemetry.controlIncidents + 1
            },
            pendingStatus: {
                status: 'playing' as const
            },
            pendingFrames: []
        };

        const artifact = compilePendingFloorArtifact({
            floor: completedFloor.floor + 1,
            initialSeed: completedFloor.initialSeed,
            rngSeed: completedFloor.rngSeed,
            mapSize: { width: completedFloor.gridWidth, height: completedFloor.gridHeight },
            mapShape: completedFloor.mapShape || 'diamond',
            playerCarryover: {
                hp: completedFloor.player.hp,
                maxHp: completedFloor.player.maxHp,
                upgrades: [...completedFloor.upgrades],
                activeSkills: [],
                archetype: completedFloor.player.archetype,
                kills: completedFloor.kills,
                environmentalKills: completedFloor.environmentalKills,
                turnsSpent: completedFloor.turnsSpent,
                hazardBreaches: completedFloor.hazardBreaches,
                combatScoreEvents: completedFloor.combatScoreEvents
            },
            runTelemetry: completedFloor.runTelemetry,
            generationState: completedFloor.generationState!
        });

        const artifactApplied = gameReducer(completedFloor, {
            type: 'APPLY_WORLDGEN_ARTIFACT',
            payload: artifact
        });
        const direct = resolvePendingStateAction(completedFloor, { generateInitialState });

        expect(summarizeState(artifactApplied)).toEqual(summarizeState(direct));
    });

    it('clears prior fog exploration when applying a compiled start-run artifact', () => {
        const hub = gameReducer(generateInitialState(1, 'artifact-fog-reset-hub'), { type: 'EXIT_TO_HUB' });
        const staleExploredKey = '999,999';
        const seededHub = {
            ...hub,
            visibility: {
                ...(hub.visibility || {
                    playerFog: {
                        visibleTileKeys: [],
                        exploredTileKeys: [],
                        visibleActorIds: [],
                        detectedActorIds: []
                    },
                    enemyAwarenessById: {}
                }),
                playerFog: {
                    ...(hub.visibility?.playerFog || {
                        visibleTileKeys: [],
                        exploredTileKeys: [],
                        visibleActorIds: [],
                        detectedActorIds: []
                    }),
                    exploredTileKeys: [
                        staleExploredKey,
                        ...(hub.visibility?.playerFog.exploredTileKeys || [])
                    ]
                }
            }
        };

        const artifact = compileStartRunArtifact({
            loadoutId: 'VANGUARD',
            mode: 'normal',
            seed: 'artifact-fog-reset-seed',
            mapSize: { width: seededHub.gridWidth, height: seededHub.gridHeight },
            mapShape: seededHub.mapShape
        });

        const artifactApplied = gameReducer(seededHub, {
            type: 'APPLY_WORLDGEN_ARTIFACT',
            payload: artifact
        });
        const direct = gameReducer(hub, {
            type: 'START_RUN',
            payload: {
                loadoutId: 'VANGUARD',
                mode: 'normal',
                seed: 'artifact-fog-reset-seed'
            }
        });

        expect(artifactApplied.visibility?.playerFog.exploredTileKeys).not.toContain(staleExploredKey);
        expect(artifactApplied.visibility).toEqual(direct.visibility);
    });
});
