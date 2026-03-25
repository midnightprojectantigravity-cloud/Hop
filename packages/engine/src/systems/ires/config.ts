import type { GameState, IresRulesetConfig } from '../../types';

export const DEFAULT_IRES_RULESET: IresRulesetConfig = {
    enabled: true,
    version: 'ires-v2',
    sparkRecoveryPerTurn: 25,
    manaRecoveryPerTurn: 5,
    restExhaustionClear: 25,
    sparkPoolFormula: {
        base: 144,
        bodyScale: 3.2,
        mindScale: 0,
        instinctScale: 0,
        rounding: 'round',
        min: 144
    },
    sparkRecoveryFlatFormula: {
        base: 8,
        bodyScale: 0.3,
        mindScale: 0,
        instinctScale: 0,
        rounding: 'round',
        min: 6
    },
    sparkRecoveryPctFormula: {
        base: 0.06,
        bodyScale: 0.0015,
        mindScale: 0,
        instinctScale: 0,
        rounding: 'none',
        min: 0.05,
        max: 0.12
    },
    restedEnterSparkRatio: 0.8,
    restedExitSparkBelow: 0.5,
    exhaustedEnterSparkRatio: 0.2,
    exhaustedExitSparkAbove: 0.5,
    sparkRecoveryStateMultipliers: {
        rested: 2,
        base: 1,
        exhausted: 0.5
    },
    travelModeEnabled: true,
    travelMovementOnly: true,
    travelSparkRecovery: 25,
    travelManaRecovery: 5,
    travelExhaustionClear: 0,
    enterExhaustedAt: 80,
    exitExhaustedBelow: 50,
    sparkBurnHpPct: 0.15,
    restedSparkBonus: 0,
    restedCritBonusPct: 10,
    fibonacciTable: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89],
    travelSuppressesSparkBurn: true
};

export const resolveIresRuleset = (
    ruleset?: GameState['ruleset']
): IresRulesetConfig => {
    const merged = {
        ...DEFAULT_IRES_RULESET,
        ...(ruleset?.ires || {})
    };
    return {
        ...merged,
        travelSparkRecovery: ruleset?.ires?.travelSparkRecovery ?? merged.sparkRecoveryPerTurn,
        travelManaRecovery: ruleset?.ires?.travelManaRecovery ?? merged.manaRecoveryPerTurn,
        travelExhaustionClear: ruleset?.ires?.travelExhaustionClear ?? merged.restExhaustionClear,
        fibonacciTable: [...(ruleset?.ires?.fibonacciTable || DEFAULT_IRES_RULESET.fibonacciTable)]
    };
};

export const withResolvedIresRuleset = <T extends Pick<GameState, 'ruleset'>>(state: T): T => ({
    ...state,
    ruleset: {
        ...(state.ruleset || {}),
        ires: resolveIresRuleset(state.ruleset)
    }
});
