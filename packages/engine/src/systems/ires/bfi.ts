import type { Actor, WeightClass } from '../../types';
import { extractTrinityStats } from '../combat/combat-calculator';
import { resolveIresRuleset } from './config';

export type IresArmorTier = 'Light' | 'Medium' | 'Heavy';

const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));

export const resolveIresArmorTier = (weightClass?: WeightClass): IresArmorTier => {
    if (weightClass === 'Light') return 'Light';
    if (weightClass === 'Heavy' || weightClass === 'Anchored' || weightClass === 'OuterWall') return 'Heavy';
    return 'Medium';
};

export const resolveIresWeightModifier = (weightClass?: WeightClass): { bfi: number; movementSpark: number; tier: IresArmorTier } => {
    const tier = resolveIresArmorTier(weightClass);
    if (tier === 'Light') return { bfi: -1, movementSpark: -5, tier };
    if (tier === 'Heavy') return { bfi: 2, movementSpark: 15, tier };
    return { bfi: 0, movementSpark: 0, tier };
};

export const resolveBaseBfi = (actor: Actor): number => {
    const instinct = Math.max(0, Number(extractTrinityStats(actor).instinct || 0));
    return clamp(6 - Math.floor(instinct / 5), 2, 10);
};

export const resolveEffectiveBfi = (actor: Actor): number =>
    clamp(resolveBaseBfi(actor) + resolveIresWeightModifier(actor.weightClass).bfi, 0, 10);

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
): number => getFibonacciValue(resolveEffectiveBfi(actor) + Math.max(0, actionCountThisTurn), ruleset);
