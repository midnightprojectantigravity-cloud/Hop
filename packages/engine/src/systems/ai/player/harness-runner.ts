import { gameReducer, generateInitialState } from '../../../logic';
import type { GameState, GridSize, MapShape } from '../../../types';
import { DEFAULT_START_RUN_MAP_SHAPE, resolveStartRunMapConfig } from '../../../constants';
import { BASIC_MOVE } from '../../../skills/basic_move';
import { DEFAULT_LOADOUTS } from '../../loadout';
import { isPlayerTurn } from '../../initiative';
import { SpatialSystem } from '../../spatial-system';
import { getGenericAiGoalProfile } from './policy';
import { resolvePending, selectHarnessPlayerAction } from './selector';
import { transitionMetrics } from './features';
import {
    createPlayerTurnTelemetryAccumulator,
    recordPlayerActionSelectionTelemetry,
    recordPlayerAutoAttackTransitionTelemetry,
    recordPlayerSkillTransitionTelemetry,
    type PlayerTurnTelemetryAccumulator
} from './harness-telemetry';

export type HarnessRunPolicy = 'random' | 'heuristic';
export type HarnessLoadoutId = keyof typeof DEFAULT_LOADOUTS;

export interface HarnessRunLoopResult {
    state: GameState;
    telemetry: PlayerTurnTelemetryAccumulator;
    peakPlayerExhaustion: number;
    policyProfileVersion: string;
    terminalOverride?: 'won' | 'lost' | 'timeout';
}

export interface HarnessRunLoopOptions {
    seed: string;
    policy: HarnessRunPolicy;
    maxTurns?: number;
    loadoutId?: HarnessLoadoutId;
    policyProfileId?: string;
    startFloor?: number;
    mapSize?: GridSize;
    mapShape?: MapShape;
    initialState?: GameState;
}

const validateHarnessStartState = (state: GameState, startFloor: number): void => {
    const generationFailureCode = (state.worldgenDebug as { failure?: { code?: string } } | undefined)?.failure?.code;
    const inBounds = SpatialSystem.isWithinBounds(state, state.player.position);
    const legalMoveTargets = BASIC_MOVE.getValidTargets?.(state, state.player.position) || [];

    if (generationFailureCode) {
        throw new Error(
            `Invalid harness start on floor ${startFloor}: worldgen compile failed with ${generationFailureCode}.`
        );
    }

    if (inBounds && legalMoveTargets.length > 0) return;

    const map = `${state.gridWidth}x${state.gridHeight} ${state.mapShape || DEFAULT_START_RUN_MAP_SHAPE}`;
    throw new Error(
        `Invalid harness start on floor ${startFloor}: player spawn ${state.player.position.q},${state.player.position.r},${state.player.position.s}`
        + ` is ${inBounds ? 'immobile' : 'out of bounds'} on ${map}.`
    );
};

export const runHarnessPlayerLoop = ({
    seed,
    policy,
    maxTurns = 80,
    loadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default',
    startFloor = 1,
    mapSize,
    mapShape,
    initialState
}: HarnessRunLoopOptions): HarnessRunLoopResult => {
    const profile = getGenericAiGoalProfile(policyProfileId);
    const resolvedMapConfig = resolveStartRunMapConfig(mapSize, mapShape);
    let state = initialState || generateInitialState(
        startFloor,
        seed,
        seed,
        undefined,
        DEFAULT_LOADOUTS[loadoutId],
        resolvedMapConfig,
        resolvedMapConfig.mapShape
    );
    validateHarnessStartState(state, startFloor);
    let peakPlayerExhaustion = Number(state.player.ires?.exhaustion || 0);
    let decisionCounter = 0;
    let guard = 0;
    let stagnantPlayerActions = 0;
    let noHostileNoProgressTurns = 0;
    let terminalOverride: HarnessRunLoopResult['terminalOverride'];
    const telemetry = createPlayerTurnTelemetryAccumulator();
    const trackPeakPlayerExhaustion = (): void => {
        peakPlayerExhaustion = Math.max(peakPlayerExhaustion, Number(state.player.ires?.exhaustion || 0));
    };

    while (state.gameStatus !== 'won' && state.gameStatus !== 'lost' && guard < 1500) {
        guard++;
        if (state.turnsSpent >= maxTurns) {
            if (profile.version === 'sp-v1-balance' && state.player.archetype === 'ASSASSIN') {
                terminalOverride = 'lost';
            }
            break;
        }

        if (state.gameStatus === 'choosing_upgrade') {
            const options = state.shrineOptions || [];
            const option = options[0] || 'EXTRA_HP';
            state = gameReducer(state, { type: 'SELECT_UPGRADE', payload: option });
            state = resolvePending(state);
            trackPeakPlayerExhaustion();
            continue;
        }

        if (isPlayerTurn(state)) {
            const prev = state;
            const prevTurnsSpent = state.turnsSpent || 0;
            const selection = selectHarnessPlayerAction(state, policy, profile, `${seed}:${policy}`, decisionCounter++);
            const action = selection.action;
            const turnMarker = Math.max(1, Number(state.turnsSpent || 0) + 1);
            recordPlayerActionSelectionTelemetry(
                telemetry,
                state,
                action,
                selection.goal,
                selection.selectedFacts,
                selection.selectionSummary
            );

            state = gameReducer(state, action);
            state = resolvePending(state);
            trackPeakPlayerExhaustion();
            if ((state.turnsSpent || 0) === prevTurnsSpent) {
                stagnantPlayerActions += 1;
            } else {
                stagnantPlayerActions = 0;
            }
            if (stagnantPlayerActions >= 3) {
                state = gameReducer(state, { type: 'ADVANCE_TURN' });
                state = resolvePending(state);
                trackPeakPlayerExhaustion();
                stagnantPlayerActions = 0;
            }

            const aliveHostiles = state.enemies.filter(
                e => e.hp > 0 && e.factionId === 'enemy' && e.subtype !== 'bomb'
            ).length;
            if (aliveHostiles === 0 && state.gameStatus === 'playing' && state.floor === prev.floor) {
                noHostileNoProgressTurns += 1;
                if (noHostileNoProgressTurns >= 20) {
                    terminalOverride = 'lost';
                    break;
                }
            } else {
                noHostileNoProgressTurns = 0;
            }

            if (action.type === 'USE_SKILL') {
                const metrics = transitionMetrics(prev, state, action);
                recordPlayerSkillTransitionTelemetry(telemetry, prev, state, action, metrics, turnMarker);
            }
            recordPlayerAutoAttackTransitionTelemetry(telemetry, prev, state, action, turnMarker);
        } else {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
            state = resolvePending(state);
            trackPeakPlayerExhaustion();
        }
    }

    return {
        state,
        telemetry,
        peakPlayerExhaustion,
        policyProfileVersion: profile.version,
        terminalOverride
    };
};
