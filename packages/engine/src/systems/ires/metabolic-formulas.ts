import type { Actor, WeightClass } from '../../types';
import { extractTrinityStats } from '../combat/combat-calculator';
import type {
    ClampedInstinctDiscountFormula,
    IresMetabolicConfig,
    LinearStatFormula,
    MetabolicDerivedStats,
    MetabolicStatProfile,
    MetabolicWeightClass
} from './metabolic-types';
import { resolveMetabolicBfiBounds } from './metabolic-tax-ladder';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

const applyRounding = (value: number, rounding: LinearStatFormula['rounding']): number => {
    if (rounding === 'floor') return Math.floor(value);
    if (rounding === 'ceil') return Math.ceil(value);
    if (rounding === 'round') return Math.round(value);
    return value;
};

export const normalizeMetabolicWeightClass = (weightClass?: WeightClass | MetabolicWeightClass): MetabolicWeightClass => {
    if (weightClass === 'Light') return 'Light';
    if (weightClass === 'Heavy' || weightClass === 'Anchored' || weightClass === 'OuterWall') return 'Heavy';
    return 'Standard';
};

export const evaluateLinearStatFormula = (
    formula: LinearStatFormula,
    profile: Pick<MetabolicStatProfile, 'body' | 'mind' | 'instinct'>
): number => {
    const raw = formula.base
        + (formula.bodyScale * profile.body)
        + (formula.mindScale * profile.mind)
        + (formula.instinctScale * profile.instinct);
    const rounded = applyRounding(raw, formula.rounding);
    return clamp(
        rounded,
        formula.min ?? Number.NEGATIVE_INFINITY,
        formula.max ?? Number.POSITIVE_INFINITY
    );
};

export const evaluateClampedInstinctDiscount = (
    formula: ClampedInstinctDiscountFormula,
    profile: Pick<MetabolicStatProfile, 'instinct'>
): number => clamp(
    formula.baseMultiplier + (formula.instinctScale * profile.instinct),
    formula.minMultiplier,
    formula.maxMultiplier
);

export const resolveMetabolicDerivedStats = (
    config: IresMetabolicConfig,
    profile: MetabolicStatProfile
): MetabolicDerivedStats => {
    const baseBfi = evaluateLinearStatFormula(config.baseBfiFormula, profile);
    const { min, max } = resolveMetabolicBfiBounds(config.metabolicTaxLadder);
    const effectiveBfi = clamp(
        baseBfi + config.weightBfiAdjustments[profile.weightClass],
        min,
        max
    );
    return {
        maxSpark: evaluateLinearStatFormula(config.sparkPoolFormula, profile),
        maxMana: evaluateLinearStatFormula(config.manaPoolFormula, profile),
        sparkRecoveryPerTurn: evaluateLinearStatFormula(config.sparkRecoveryFormula, profile),
        manaRecoveryPerTurn: evaluateLinearStatFormula(config.manaRecoveryFormula, profile),
        baseBfi,
        effectiveBfi,
        sparkEfficiencyMultiplier: evaluateClampedInstinctDiscount(config.sparkEfficiencyFormula, profile),
        exhaustionBleedByState: {
            rested: evaluateLinearStatFormula(config.exhaustionBleedByState.rested, profile),
            base: evaluateLinearStatFormula(config.exhaustionBleedByState.base, profile),
            exhausted: evaluateLinearStatFormula(config.exhaustionBleedByState.exhausted, profile)
        }
    };
};

export const createMetabolicProfileFromActor = (actor: Actor): MetabolicStatProfile => {
    const stats = extractTrinityStats(actor);
    return {
        id: actor.id,
        label: actor.id,
        body: Number(stats.body || 0),
        mind: Number(stats.mind || 0),
        instinct: Number(stats.instinct || 0),
        weightClass: normalizeMetabolicWeightClass(actor.weightClass)
    };
};
