import type { IresMetabolicConfig } from './metabolic-types';

export const DEFAULT_METABOLIC_TAX_LADDER: IresMetabolicConfig['metabolicTaxLadder'] = {
    12: [34, 72, 116, 170],
    11: [29, 63, 102, 150],
    10: [25, 55, 89, 135],
    9: [21, 45, 72, 109],
    8: [16, 34, 55, 84],
    7: [12, 25, 40, 61],
    6: [8, 18, 34, 55]
};

const sortNumeric = (left: number, right: number): number => left - right;

export const resolveMetabolicBfiBounds = (
    ladder: IresMetabolicConfig['metabolicTaxLadder']
): { min: number; max: number } => {
    const keys = Object.keys(ladder).map(Number).sort(sortNumeric);
    return {
        min: keys[0] ?? 0,
        max: keys[keys.length - 1] ?? 0
    };
};

export const resolveMetabolicTaxRow = (
    ladder: IresMetabolicConfig['metabolicTaxLadder'],
    effectiveBfi: number
): number[] => {
    const keys = Object.keys(ladder).map(Number).sort(sortNumeric);
    if (keys.length === 0) return [0];
    let selectedKey = keys[0]!;
    for (const key of keys) {
        if (effectiveBfi >= key) {
            selectedKey = key;
        }
    }
    return [...(ladder[selectedKey] || [0])];
};

export const resolveMetabolicTax = (
    ladder: IresMetabolicConfig['metabolicTaxLadder'],
    effectiveBfi: number,
    actionIndex: number
): number => {
    const row = resolveMetabolicTaxRow(ladder, effectiveBfi);
    const boundedIndex = Math.max(0, Math.floor(actionIndex));
    return row[Math.min(boundedIndex, row.length - 1)] || 0;
};
