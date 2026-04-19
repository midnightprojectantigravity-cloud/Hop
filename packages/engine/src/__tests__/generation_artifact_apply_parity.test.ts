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
    theme: state.theme,
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

const normalizeHazardTileDigest = (digest: string): string =>
    digest.replace(/:LAVA\b/g, ':HAZARD').replace(/:TOXIC\b/g, ':HAZARD');

const summarizeArtifact = (artifact: ReturnType<typeof compileStartRunArtifact>) => ({
    floor: artifact.floor,
    gridWidth: artifact.gridWidth,
    gridHeight: artifact.gridHeight,
    mapShape: artifact.mapShape,
    playerSpawn: pointToKey(artifact.playerSpawn),
    stairsPosition: pointToKey(artifact.stairsPosition),
    shrinePosition: artifact.shrinePosition ? pointToKey(artifact.shrinePosition) : undefined,
    enemySpawns: [...artifact.enemySpawns]
        .map(enemy => `${enemy.id}:${enemy.subtype}:${pointToKey(enemy.position)}`)
        .sort(),
    rooms: [...artifact.rooms]
        .map(room => `${room.id}:${room.type}:${pointToKey(room.center)}`)
        .sort(),
    pathNetwork: {
        mainLandmarkIds: artifact.pathNetwork.landmarks.filter(landmark => landmark.onPath).map(landmark => landmark.id).sort(),
        hiddenLandmarkIds: artifact.pathNetwork.landmarks.filter(landmark => !landmark.onPath).map(landmark => landmark.id).sort(),
        tacticalTileCount: artifact.pathNetwork.tacticalTileKeys.length,
        visualTileCount: artifact.pathNetwork.visualTileKeys.length
    },
    tileDigest: normalizeHazardTileDigest(
        Array.from(artifact.tileBaseIds)
            .map((code, index) => `${index}:${code}`)
            .join('|')
    ),
    theme: artifact.theme,
    contentTheme: artifact.contentTheme
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
            mapShape: hub.mapShape,
            themeId: 'void'
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
                seed,
                themeId: 'void'
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
            mapShape: seededHub.mapShape,
            themeId: 'void'
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
                seed: 'artifact-fog-reset-seed',
                themeId: 'void'
            }
        });

        expect(artifactApplied.visibility?.playerFog.exploredTileKeys).not.toContain(staleExploredKey);
        expect(artifactApplied.visibility).toEqual(direct.visibility);
    });

    it('keeps the same arcade floor structure while swapping inferno hazards for void hazards', () => {
        const seed = 'artifact-biome-split-seed';
        const mapSize = { width: 9, height: 11 };
        const mapShape = 'diamond' as const;

        const infernoArtifact = compileStartRunArtifact({
            loadoutId: 'VANGUARD',
            mode: 'normal',
            seed,
            mapSize,
            mapShape,
            themeId: 'inferno',
            contentThemeId: 'inferno'
        });

        const voidArtifact = compileStartRunArtifact({
            loadoutId: 'HUNTER',
            mode: 'normal',
            seed,
            mapSize,
            mapShape,
            themeId: 'void',
            contentThemeId: 'inferno'
        });

        expect(summarizeArtifact(infernoArtifact).theme).toBe('inferno');
        expect(summarizeArtifact(infernoArtifact).contentTheme).toBe('inferno');
        expect(summarizeArtifact(voidArtifact).theme).toBe('void');
        expect(summarizeArtifact(voidArtifact).contentTheme).toBe('inferno');

        const normalizedInferno = {
            ...summarizeArtifact(infernoArtifact),
            theme: undefined,
            contentTheme: undefined
        };
        const normalizedVoid = {
            ...summarizeArtifact(voidArtifact),
            theme: undefined,
            contentTheme: undefined
        };

        expect(normalizedVoid).toEqual(normalizedInferno);
    });
});
