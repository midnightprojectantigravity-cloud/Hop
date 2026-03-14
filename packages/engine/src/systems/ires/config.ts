import type { GameState, IresRulesetConfig } from '../../types';

export const DEFAULT_IRES_RULESET: IresRulesetConfig = {
    enabled: true,
    version: 'ires-v1',
    sparkRecoveryPerTurn: 25,
    manaRecoveryPerTurn: 5,
    restExhaustionClear: 25,
    travelModeEnabled: true,
    travelMovementOnly: true,
    travelSparkRecovery: 25,
    travelManaRecovery: 5,
    travelExhaustionClear: 25,
    enterExhaustedAt: 80,
    exitExhaustedBelow: 50,
    sparkBurnHpPct: 0.15,
    restedSparkBonus: 10,
    restedCritBonusPct: 10,
    fibonacciTable: [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89]
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
