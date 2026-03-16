import type { IresRulesetConfig, SkillResourceProfile } from '../../types';
import { DEFAULT_IRES_RULESET } from './config';
import {
    DEFAULT_IRES_METABOLIC_CONFIG
} from './metabolic-config';
import {
    resolveMetabolicPrimaryCost,
    resolveMetabolicPrimaryResource,
    resolveMetabolicActionProfile
} from './metabolic-action-catalog';
import type { IresMetabolicConfig, MetabolicActionClassId } from './metabolic-types';

const toLegacyProfile = (
    config: IresMetabolicConfig,
    actionId: MetabolicActionClassId
): Partial<SkillResourceProfile> => {
    const action = config.actionCatalog[actionId];
    const actionProfile = resolveMetabolicActionProfile(config, action);
    return {
        primaryResource: resolveMetabolicPrimaryResource(action),
        primaryCost: resolveMetabolicPrimaryCost(config, action),
        baseStrain: actionProfile.baseExhaustion,
        countsAsMovement: action.countsAsMovement,
        countsAsAction: action.countsAsAction
    };
};

export const resolveLegacyIresRulesetFromMetabolic = (
    config: IresMetabolicConfig = DEFAULT_IRES_METABOLIC_CONFIG
): Partial<IresRulesetConfig> => ({
    enabled: true,
    version: DEFAULT_IRES_RULESET.version,
    sparkRecoveryPerTurn: Math.round(config.sparkRecoveryFormula.base),
    manaRecoveryPerTurn: Math.round(config.manaRecoveryFormula.base),
    restExhaustionClear: config.waitExhaustionBonus,
    travelModeEnabled: config.travelMode.enabled,
    travelMovementOnly: config.travelMode.movementOnly,
    travelSparkRecovery: config.travelMode.sparkRecovery,
    travelManaRecovery: config.travelMode.manaRecovery,
    travelExhaustionClear: config.travelMode.exhaustionClear,
    enterExhaustedAt: config.enterExhaustedAt,
    exitExhaustedBelow: config.exitExhaustedBelow,
    sparkBurnHpPct: config.sparkBurnHpPct,
    restedSparkBonus: DEFAULT_IRES_RULESET.restedSparkBonus,
    restedCritBonusPct: DEFAULT_IRES_RULESET.restedCritBonusPct,
    fibonacciTable: [...(config.metabolicTaxLadder[10] || DEFAULT_IRES_RULESET.fibonacciTable)],
    metabolism: config
});

export const resolveLegacyMovementProfilesFromMetabolic = (
    config: IresMetabolicConfig = DEFAULT_IRES_METABOLIC_CONFIG
): Record<string, Partial<SkillResourceProfile>> => ({
    BASIC_MOVE: toLegacyProfile(config, 'BASIC_MOVE'),
    DASH: toLegacyProfile(config, 'DASH'),
    JUMP: toLegacyProfile(config, 'JUMP'),
    VAULT: toLegacyProfile(config, 'VAULT'),
    WITHDRAWAL: toLegacyProfile(config, 'WITHDRAWAL'),
    PHASE_STEP: toLegacyProfile(config, 'PHASE_STEP'),
    FIREWALK: toLegacyProfile(config, 'FIREWALK'),
    SHADOW_STEP: toLegacyProfile(config, 'SHADOW_STEP')
});
