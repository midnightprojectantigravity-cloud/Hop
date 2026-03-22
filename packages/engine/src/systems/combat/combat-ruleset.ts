import type { CombatRulesetVersion, GameState, RunRulesetOverrides } from '../../types';

export const DEFAULT_COMBAT_RULESET_VERSION: CombatRulesetVersion = 'trinity_ratio_v2';

export const resolveCombatRuleset = (
    stateOrRuleset?: Pick<GameState, 'ruleset'> | GameState['ruleset'] | null
): CombatRulesetVersion => {
    const ruleset = stateOrRuleset && 'ruleset' in stateOrRuleset
        ? (stateOrRuleset as Pick<GameState, 'ruleset'>).ruleset
        : (stateOrRuleset as GameState['ruleset'] | null | undefined);
    return ruleset?.combat?.version || DEFAULT_COMBAT_RULESET_VERSION;
};

export const mergeCombatRulesetOverride = (
    base: GameState['ruleset'],
    overrides?: RunRulesetOverrides
): GameState['ruleset'] => {
    if (!overrides?.combat?.version) return base;
    return {
        ...(base || {}),
        combat: {
            version: overrides.combat.version
        }
    };
};
