import type { AilmentID } from '../../types/registry';

export type AilmentRoundMode = 'none' | 'floor' | 'round' | 'ceil';

export type AilmentVariableRef =
    | 'currentCounters'
    | 'resiliencePct'
    | 'maxHp'
    | 'body'
    | 'mind'
    | 'instinct';

export interface AilmentFormulaTerm {
    variable: AilmentVariableRef;
    coefficient: number;
}

export interface AilmentFormulaExpression {
    base: number;
    terms?: AilmentFormulaTerm[];
    min?: number;
    max?: number;
    round?: AilmentRoundMode;
}

export type AilmentStatRef =
    | 'body'
    | 'mind'
    | 'instinct'
    | 'dex'
    | 'agi'
    | 'int'
    | 'wis'
    | 'vit'
    | 'resolve';

export interface AilmentCoreStats {
    atk: AilmentStatRef;
    def: AilmentStatRef;
    scalingFactor: number;
    baseDeposit: number;
    skillMultiplierBase?: number;
}

export interface AilmentInteraction {
    target: AilmentID;
    ratio: number;
    priority: number;
    vfx?: string;
}

export interface AilmentTickBehavior {
    damage?: AilmentFormulaExpression;
    decay?: AilmentFormulaExpression;
}

export interface AilmentThreshold {
    count: number;
    effectId: string;
    message?: string;
    bonusDamage?: number;
}

export interface AilmentHardeningConfig {
    tickXpRate: number;
    shockXpRate: number;
    capPct: number;
    xpToResistance: number;
}

export interface AilmentDefinition {
    id: AilmentID;
    name: string;
    core: AilmentCoreStats;
    interactions?: AilmentInteraction[];
    tick?: AilmentTickBehavior;
    thresholds?: AilmentThreshold[];
    hardening: AilmentHardeningConfig;
}

export interface AilmentCatalog {
    version: string;
    ailments: AilmentDefinition[];
}

