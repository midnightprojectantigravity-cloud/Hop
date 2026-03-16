import type { IresMetabolicConfig, MetabolicActorState, MetabolicSimulationState, MetabolicStatProfile } from './metabolic-types';
import { resolveMetabolicDerivedStats } from './metabolic-formulas';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

export const resolveMetabolicState = (
    exhaustion: number,
    wasExhausted: boolean,
    config: IresMetabolicConfig
): { isExhausted: boolean; currentState: MetabolicActorState } => {
    let isExhausted = wasExhausted;
    if (!isExhausted && exhaustion >= config.enterExhaustedAt) {
        isExhausted = true;
    } else if (isExhausted && exhaustion < config.exitExhaustedBelow) {
        isExhausted = false;
    }
    return {
        isExhausted,
        currentState: isExhausted ? 'exhausted' : exhaustion === 0 ? 'rested' : 'base'
    };
};

export const createInitialMetabolicState = (
    config: IresMetabolicConfig,
    profile: MetabolicStatProfile
): MetabolicSimulationState => {
    const derived = resolveMetabolicDerivedStats(config, profile);
    return {
        spark: derived.maxSpark,
        maxSpark: derived.maxSpark,
        mana: derived.maxMana,
        maxMana: derived.maxMana,
        exhaustion: 0,
        isExhausted: false,
        currentState: 'rested'
    };
};

export const withResolvedMetabolicState = (
    state: MetabolicSimulationState,
    config: IresMetabolicConfig
): MetabolicSimulationState => {
    const resolved = resolveMetabolicState(state.exhaustion, state.isExhausted, config);
    return {
        ...state,
        spark: clamp(state.spark, 0, state.maxSpark),
        mana: clamp(state.mana, 0, state.maxMana),
        exhaustion: clamp(state.exhaustion, 0, 100),
        ...resolved
    };
};
