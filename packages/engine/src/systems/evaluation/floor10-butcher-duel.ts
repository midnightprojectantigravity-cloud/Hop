import { resolveStartRunMapConfig } from '../../constants';
import { createHex } from '../../hex';
import { generateInitialState } from '../../logic';
import type { Actor, GameState, GridSize, MapShape } from '../../types';
import { buildInitiativeQueue } from '../initiative';
import { DEFAULT_LOADOUTS } from '../loadout';
import { SpatialSystem } from '../spatial-system';
import { recomputeVisibilityFromScratch } from '../visibility';
import { runHarnessSimulationBatch } from './harness-batch';
import { simulateHarnessRunDetailed } from './harness-simulation';
import type {
    ArchetypeLoadoutId,
    BotPolicy,
    RunResult,
    SimulatedRunDetailed
} from './harness-types';

const FLOOR10_DUEL_PLAYER_START = createHex(4, 5);
const FLOOR10_DUEL_BUTCHER_START = createHex(5, 2);

const withGoal = (actor: Actor, goal: 'engage' | 'explore' | 'recover'): Actor => ({
    ...actor,
    behaviorState: {
        overlays: [...(actor.behaviorState?.overlays || [])],
        anchorActorId: actor.behaviorState?.anchorActorId,
        anchorPoint: actor.behaviorState?.anchorPoint,
        goal
    }
});

export const buildFloor10ButcherDuelState = (
    seed: string,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    mapSize?: GridSize,
    mapShape?: MapShape
): GameState => {
    const resolvedMapConfig = resolveStartRunMapConfig(mapSize, mapShape);
    const base = generateInitialState(
        10,
        seed,
        seed,
        undefined,
        DEFAULT_LOADOUTS[loadoutId],
        resolvedMapConfig,
        resolvedMapConfig.mapShape
    );
    const butcher = base.enemies.find(enemy => enemy.subtype === 'butcher' && enemy.hp > 0);
    if (!butcher) {
        throw new Error('Failed to build Floor 10 Butcher duel: missing live butcher spawn.');
    }

    const seeded: GameState = {
        ...base,
        player: withGoal({
            ...base.player,
            position: FLOOR10_DUEL_PLAYER_START,
            previousPosition: FLOOR10_DUEL_PLAYER_START
        }, 'engage'),
        enemies: base.enemies.map(enemy => withGoal(
            enemy.id === butcher.id
                ? {
                    ...enemy,
                    position: FLOOR10_DUEL_BUTCHER_START,
                    previousPosition: FLOOR10_DUEL_BUTCHER_START
                }
                : enemy,
            'engage'
        )),
        shrinePosition: undefined,
        stairsPosition: FLOOR10_DUEL_PLAYER_START,
        intentPreview: undefined,
        visibility: undefined,
        initiativeQueue: undefined
    };

    const withQueue = {
        ...seeded,
        initiativeQueue: buildInitiativeQueue(seeded),
        occupancyMask: SpatialSystem.refreshOccupancyMask(seeded)
    };

    return recomputeVisibilityFromScratch(withQueue);
};

export const simulateFloor10ButcherDuelDetailed = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    mapSize?: GridSize,
    mapShape?: MapShape
): SimulatedRunDetailed => {
    const duelState = buildFloor10ButcherDuelState(seed, loadoutId, mapSize, mapShape);
    return simulateHarnessRunDetailed(seed, policy, maxTurns, loadoutId, policyProfileId, 10, mapSize, mapShape, duelState);
};

export const simulateFloor10ButcherDuel = (
    seed: string,
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    mapSize?: GridSize,
    mapShape?: MapShape
): RunResult =>
    simulateFloor10ButcherDuelDetailed(seed, policy, maxTurns, loadoutId, policyProfileId, mapSize, mapShape).run;

export const runFloor10ButcherDuelBatch = (
    seeds: string[],
    policy: BotPolicy,
    maxTurns = 80,
    loadoutId: ArchetypeLoadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    mapSize?: GridSize,
    mapShape?: MapShape
): RunResult[] =>
    runHarnessSimulationBatch(
        { seeds },
        seed => simulateFloor10ButcherDuel(seed, policy, maxTurns, loadoutId, policyProfileId, mapSize, mapShape)
    );
