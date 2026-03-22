import type { Actor, ArmorBurdenTier, WeightClass } from '../../types';
import { resolveIresRuleset } from './config';
import { DEFAULT_IRES_METABOLIC_CONFIG } from './metabolic-config';
import {
    createMetabolicProfileFromActor,
    normalizeMetabolicBurdenTier,
    resolveMetabolicDerivedStats
} from './metabolic-formulas';
import { resolveMetabolicTax } from './metabolic-tax-ladder';

export type IresArmorTier = 'None' | 'Light' | 'Medium' | 'Heavy';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const resolveLegacyMovementTier = (weightClass?: WeightClass): Exclude<IresArmorTier, 'None'> => {
    if (weightClass === 'Light') return 'Light';
    if (weightClass === 'Heavy' || weightClass === 'Anchored' || weightClass === 'OuterWall') return 'Heavy';
    return 'Medium';
};

export const resolveIresArmorTier = (
    actorOrBurdenTier?: Pick<Actor, 'armorBurdenTier' | 'weightClass'> | ArmorBurdenTier | WeightClass
): IresArmorTier => {
    if (typeof actorOrBurdenTier === 'string') {
        return normalizeMetabolicBurdenTier(actorOrBurdenTier as ArmorBurdenTier | undefined, actorOrBurdenTier as WeightClass | undefined);
    }
    return normalizeMetabolicBurdenTier(actorOrBurdenTier?.armorBurdenTier, actorOrBurdenTier?.weightClass);
};

export const resolveIresWeightModifier = (
    actorOrWeightClass?: Pick<Actor, 'armorBurdenTier' | 'weightClass'> | WeightClass
): { bfi: number; movementSpark: number; tier: IresArmorTier } => {
    const tier = resolveIresArmorTier(actorOrWeightClass as any);
    const weightClass = typeof actorOrWeightClass === 'string'
        ? actorOrWeightClass
        : actorOrWeightClass?.weightClass;
    const legacyMovementTier = resolveLegacyMovementTier(weightClass);
    const bfi = DEFAULT_IRES_METABOLIC_CONFIG.burdenBfiAdjustments[tier];
    if (legacyMovementTier === 'Light') return { bfi, movementSpark: -5, tier };
    if (legacyMovementTier === 'Heavy') return { bfi, movementSpark: 15, tier };
    return { bfi, movementSpark: 0, tier };
};

const resolveDerivedStats = (actor: Actor, ruleset?: Parameters<typeof resolveIresRuleset>[0]) => {
    const config = resolveIresRuleset(ruleset).metabolism || DEFAULT_IRES_METABOLIC_CONFIG;
    return resolveMetabolicDerivedStats(config, createMetabolicProfileFromActor(actor));
};

export const resolveBaseBfi = (actor: Actor, ruleset?: Parameters<typeof resolveIresRuleset>[0]): number =>
    resolveDerivedStats(actor, ruleset).baseBfi;

export const resolveEffectiveBfi = (actor: Actor, ruleset?: Parameters<typeof resolveIresRuleset>[0]): number =>
    resolveDerivedStats(actor, ruleset).effectiveBfi;

export const getFibonacciValue = (index: number, actorOrRuleset?: Actor | Parameters<typeof resolveIresRuleset>[0]): number => {
    const ruleset = actorOrRuleset && 'type' in actorOrRuleset
        ? resolveIresRuleset()
        : resolveIresRuleset(actorOrRuleset as any);
    const boundedIndex = clamp(index, 0, ruleset.fibonacciTable.length - 1);
    return ruleset.fibonacciTable[boundedIndex] || 0;
};

export const resolveExhaustionTax = (
    actor: Actor,
    actionCountThisTurn: number,
    ruleset?: Parameters<typeof resolveIresRuleset>[0]
): number => {
    const config = resolveIresRuleset(ruleset).metabolism || DEFAULT_IRES_METABOLIC_CONFIG;
    return resolveMetabolicTax(
        config.metabolicTaxLadder,
        resolveEffectiveBfi(actor, ruleset),
        Math.max(0, actionCountThisTurn)
    );
};
