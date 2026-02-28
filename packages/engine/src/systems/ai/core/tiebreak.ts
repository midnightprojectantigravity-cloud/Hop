import type { GameState } from '../../../types';
import { consumeRandom, randomFromSeed } from '../../rng';
import type { AiChoiceResult, AiChoiceSource } from './types';

export interface SeededTieBreakContext {
    seed: string;
    counter: number;
}

export const chooseIndexFromSeeded = (length: number, context: SeededTieBreakContext): AiChoiceResult<undefined> => {
    if (length <= 0) return { index: 0, rngConsumption: 0 };
    const value = randomFromSeed(context.seed, context.counter);
    return {
        index: Math.floor(value * length) % length,
        rngConsumption: 1
    };
};

export const seededChoiceSource: AiChoiceSource<undefined, SeededTieBreakContext> = {
    chooseIndex: chooseIndexFromSeeded
};

export interface StateRngTieBreakContext {
    state: GameState;
}

export const chooseIndexFromStateRng = (
    length: number,
    context: StateRngTieBreakContext
): AiChoiceResult<GameState> => {
    if (length <= 0) return { index: 0, nextState: context.state, rngConsumption: 0 };
    const { value, nextState } = consumeRandom(context.state);
    return {
        index: Math.floor(value * length) % length,
        nextState,
        rngConsumption: 1
    };
};

export const stateRngChoiceSource: AiChoiceSource<GameState, StateRngTieBreakContext> = {
    chooseIndex: chooseIndexFromStateRng
};
