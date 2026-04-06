import { describe, expect, it } from 'vitest';
import { generateInitialState } from '../logic';
import {
    selectByOnePlySimulation as selectByOnePlySimulationLegacy
} from '../systems/evaluation/balance-harness';
import {
    selectByOnePlySimulation as selectByOnePlySimulationShared
} from '../systems/ai/player/selector';

describe('player selector parity sample', () => {
    it('shared selector matches legacy harness selector on sampled states', () => {
        const samples = [
            { floor: 1, seed: 'player-sel-a', simSeed: 'psa', counter: 0, goal: 'engage' as const },
            { floor: 3, seed: 'player-sel-b', simSeed: 'psb', counter: 2, goal: 'explore' as const },
            { floor: 5, seed: 'player-sel-c', simSeed: 'psc', counter: 4, goal: 'recover' as const },
            { floor: 2, seed: 'player-sel-necro', simSeed: 'psn', counter: 1, goal: 'engage' as const, loadout: 'NECROMANCER' as const },
        ];

        for (const sample of samples) {
            const state = generateInitialState(sample.floor, sample.seed, sample.seed);
            const legacy = selectByOnePlySimulationLegacy(state, sample.goal, sample.simSeed, sample.counter);
            const shared = selectByOnePlySimulationShared(state, sample.goal, sample.simSeed, sample.counter);
            expect(shared, `${sample.floor}:${sample.seed}`).toEqual(legacy);
        }
    });
});
