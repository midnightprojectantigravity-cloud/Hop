import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import { getStrategicPolicyProfile } from '../systems/ai/strategic-policy';
import {
    selectByOnePlySimulation as selectByOnePlySimulationLegacy
} from '../systems/evaluation/balance-harness';
import {
    selectByOnePlySimulation as selectByOnePlySimulationShared
} from '../systems/ai/player/selector';
import { chooseStrategicIntent } from '../systems/ai/player/policy';

describe('player selector parity sample', () => {
    it('shared selector matches legacy harness selector on sampled states', () => {
        const profile = getStrategicPolicyProfile('sp-v1-default');
        const samples = [
            { floor: 1, seed: 'player-sel-a', simSeed: 'psa', counter: 0 },
            { floor: 3, seed: 'player-sel-b', simSeed: 'psb', counter: 2 },
            { floor: 5, seed: 'player-sel-c', simSeed: 'psc', counter: 4 },
            { floor: 2, seed: 'player-sel-necro', simSeed: 'psn', counter: 1, loadout: 'NECROMANCER' as const },
        ];

        for (const sample of samples) {
            const state = generateInitialState(sample.floor, sample.seed, sample.seed);
            const strategicIntent = chooseStrategicIntent(state, profile);
            const legacy = selectByOnePlySimulationLegacy(state, strategicIntent, profile, sample.simSeed, sample.counter);
            const shared = selectByOnePlySimulationShared(state, strategicIntent, profile, sample.simSeed, sample.counter);
            expect(shared, `${sample.floor}:${sample.seed}`).toEqual(legacy);
        }
    });
});
