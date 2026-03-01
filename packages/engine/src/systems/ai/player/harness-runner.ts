import { gameReducer, generateInitialState } from '../../../logic';
import type { GameState } from '../../../types';
import { DEFAULT_LOADOUTS } from '../../loadout';
import { isPlayerTurn } from '../../initiative';
import { getStrategicPolicyProfile } from '../strategic-policy';
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
    policyProfileVersion: string;
    terminalOverride?: 'won' | 'lost' | 'timeout';
}

export interface HarnessRunLoopOptions {
    seed: string;
    policy: HarnessRunPolicy;
    maxTurns?: number;
    loadoutId?: HarnessLoadoutId;
    policyProfileId?: string;
}

export const runHarnessPlayerLoop = ({
    seed,
    policy,
    maxTurns = 80,
    loadoutId = 'VANGUARD',
    policyProfileId = 'sp-v1-default'
}: HarnessRunLoopOptions): HarnessRunLoopResult => {
    const profile = getStrategicPolicyProfile(policyProfileId);
    let state = generateInitialState(1, seed, seed, undefined, DEFAULT_LOADOUTS[loadoutId]);
    let decisionCounter = 0;
    let guard = 0;
    let stagnantPlayerActions = 0;
    let noHostileNoProgressTurns = 0;
    let terminalOverride: HarnessRunLoopResult['terminalOverride'];
    const telemetry = createPlayerTurnTelemetryAccumulator();

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
            continue;
        }

        if (isPlayerTurn(state)) {
            const prev = state;
            const prevTurnsSpent = state.turnsSpent || 0;
            const selection = selectHarnessPlayerAction(state, policy, profile, `${seed}:${policy}`, decisionCounter++);
            const action = selection.action;
            recordPlayerActionSelectionTelemetry(telemetry, action, selection.strategicIntent);

            state = gameReducer(state, action);
            state = resolvePending(state);
            if ((state.turnsSpent || 0) === prevTurnsSpent) {
                stagnantPlayerActions += 1;
            } else {
                stagnantPlayerActions = 0;
            }
            if (stagnantPlayerActions >= 3) {
                state = gameReducer(state, { type: 'ADVANCE_TURN' });
                state = resolvePending(state);
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
                recordPlayerSkillTransitionTelemetry(telemetry, prev, state, action, metrics);
            }
            recordPlayerAutoAttackTransitionTelemetry(telemetry, prev, state, action);
        } else {
            state = gameReducer(state, { type: 'ADVANCE_TURN' });
            state = resolvePending(state);
        }
    }

    return {
        state,
        telemetry,
        policyProfileVersion: profile.version,
        terminalOverride
    };
};
