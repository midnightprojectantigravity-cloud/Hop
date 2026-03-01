import { evaluateAilmentFormula } from './formula';
import type { AilmentTickInput, AilmentTickOutput } from './types';

const clampCounter = (value: number): number => Math.max(0, Math.floor(value));

export const computeAilmentTick = (input: AilmentTickInput): AilmentTickOutput => {
    const damage = Math.max(0, Math.floor(evaluateAilmentFormula(input.definition.tick?.damage, input.formulaContext)));
    const decay = Math.max(0, Math.floor(evaluateAilmentFormula(input.definition.tick?.decay, input.formulaContext)));
    const nextCounters = clampCounter(input.counters - decay);
    const thresholdEffects = (input.definition.thresholds || [])
        .filter(th => nextCounters >= th.count)
        .map(th => th.effectId);
    return {
        nextCounters,
        damage,
        decay,
        thresholdEffects
    };
};
