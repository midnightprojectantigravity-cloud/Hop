import type { IresMetabolicConfig } from './metabolic-types';
import {
    DEFAULT_METABOLIC_ACTION_BANDS,
    DEFAULT_METABOLIC_ACTION_CATALOG
} from './metabolic-action-catalog';
import { DEFAULT_METABOLIC_TAX_LADDER } from './metabolic-tax-ladder';
import { DEFAULT_METABOLIC_WORKLOAD_CATALOG } from './metabolic-workloads';

export const DEFAULT_IRES_METABOLIC_CONFIG: IresMetabolicConfig = {
    version: 'ires-metabolism-v7',
    sparkPoolFormula: {
        base: 108,
        bodyScale: 2.4,
        mindScale: 0,
        instinctScale: 0,
        rounding: 'round',
        min: 108
    },
    sparkRecoveryFormula: {
        base: 21,
        bodyScale: 0.6,
        mindScale: 0,
        instinctScale: 0,
        rounding: 'round',
        min: 20
    },
    manaPoolFormula: {
        base: 12,
        bodyScale: 0,
        mindScale: 2.2,
        instinctScale: 0,
        rounding: 'round',
        min: 12
    },
    manaRecoveryFormula: {
        base: 3,
        bodyScale: 0,
        mindScale: 0.45,
        instinctScale: 0,
        rounding: 'round',
        min: 3
    },
    baseBfiFormula: {
        ceiling: 14,
        scaleFactor: 1.87,
        dampener: 7,
        bodyWeight: 3,
        instinctWeight: 6,
        mindWeight: 1,
        rounding: 'round',
        min: 5,
        max: 14
    },
    sparkEfficiencyFormula: {
        baseMultiplier: 1,
        instinctScale: -0.005,
        minMultiplier: 0.85,
        maxMultiplier: 1
    },
    exhaustionBleedByState: {
        rested: { base: 20, bodyScale: 0, mindScale: 0, instinctScale: 0, rounding: 'round', min: 0 },
        base: { base: 15, bodyScale: 0, mindScale: 0, instinctScale: 0, rounding: 'round', min: 0 },
        exhausted: { base: 8, bodyScale: 0, mindScale: 0, instinctScale: 0, rounding: 'round', min: 0 }
    },
    waitSparkBonus: 30,
    waitExhaustionBonus: 40,
    enterExhaustedAt: 80,
    exitExhaustedBelow: 50,
    sparkBurnHpPct: 0.15,
    immediateBurnOnRedlineCross: {
        enabled: true,
        resources: ['spark', 'mana'],
        minActionIndex: 1
    },
    burdenBfiAdjustments: {
        None: 0,
        Light: 1,
        Medium: 2,
        Heavy: 3
    },
    weightMovementSparkAdjustments: {
        Light: -5,
        Standard: 0,
        Heavy: 15
    },
    metabolicTaxLadder: DEFAULT_METABOLIC_TAX_LADDER,
    travelMode: {
        enabled: true,
        movementOnly: true,
        sparkRecovery: 25,
        manaRecovery: 5,
        exhaustionClear: 25
    },
    actionBands: DEFAULT_METABOLIC_ACTION_BANDS,
    actionCatalog: DEFAULT_METABOLIC_ACTION_CATALOG,
    workloadCatalog: DEFAULT_METABOLIC_WORKLOAD_CATALOG
};

export const cloneIresMetabolicConfig = (
    config: IresMetabolicConfig = DEFAULT_IRES_METABOLIC_CONFIG
): IresMetabolicConfig => JSON.parse(JSON.stringify(config)) as IresMetabolicConfig;
