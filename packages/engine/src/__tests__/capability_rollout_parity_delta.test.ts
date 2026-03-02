import { describe, expect, it } from 'vitest';
import { fingerprintFromState, gameReducer, generateHubState } from '../logic';
import type { GameState } from '../types';

const advanceWithWait = (state: GameState): GameState => gameReducer(state, { type: 'WAIT' });

const runTraceWithCapabilityFlag = (enabled: boolean): string[] => {
    const hub = generateHubState();
    let state = gameReducer(hub, {
        type: 'START_RUN',
        payload: {
            loadoutId: 'SKIRMISHER',
            seed: 'capability-rollout-parity-seed',
            rulesetOverrides: {
                capabilities: {
                    loadoutPassivesEnabled: enabled
                }
            }
        }
    });

    const trace: string[] = [fingerprintFromState(state)];
    for (let i = 0; i < 8; i++) {
        const next = advanceWithWait(state);
        if (next === state) break;
        state = next;
        trace.push(fingerprintFromState(state));
        if (state.gameStatus !== 'playing') break;
    }
    return trace;
};

describe('capability rollout parity delta', () => {
    it('keeps deterministic run fingerprints stable when loadout passives are toggled', () => {
        const strictBaselineTrace = runTraceWithCapabilityFlag(false);
        const capabilityEnabledTrace = runTraceWithCapabilityFlag(true);

        expect(capabilityEnabledTrace).toEqual(strictBaselineTrace);
    });
});

